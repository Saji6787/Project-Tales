"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth";
import { getStory, updateStoryHistory, saveStoryHistory } from "@/lib/firebase/firestore";
import ReactMarkdown from "react-markdown";

export default function StoryPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showChoices, setShowChoices] = useState(true); // Toggle logic
  const [customChoice, setCustomChoice] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null); // Index of message being edited
  const [editContent, setEditContent] = useState(""); // Content of message being edited
  const bottomRef = useRef(null);

  useEffect(() => {
    if (user && id) {
      getStory(user.uid, id).then(s => {
        setStory(s);
        setLoading(false);
      });
    }
  }, [user, id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [story?.history]);

  const handleChoice = async (choice) => {
    if (!user || processing) return;
    setProcessing(true);

    try {
      // 1. Update UI / Firestore with Player Choice
      const playerTurn = { role: "player", content: choice };
      const newHistory = [...story.history, playerTurn];
      setStory(prev => ({ ...prev, history: newHistory }));
      
      await updateStoryHistory(user.uid, id, playerTurn);

      // 2. Call API
      const token = await user.getIdToken();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
           token, 
           history: newHistory,
           initialPrompt: story.initialPrompt,
           style: story.storyStyle // Pass style 
        }),
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // 3. Update UI / Firestore with AI Response
      const aiTurn = { 
          role: "ai", 
          content: data.story, 
          choices: data.choices || [] 
      };
      
      await updateStoryHistory(user.uid, id, aiTurn);
      setStory(prev => ({ 
          ...prev, 
          history: [...prev.history, aiTurn] 
      }));

    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleRegenerate = async (index) => {
    if (processing || !user) return;
    setProcessing(true);
    
    // Get history up to the previous user turn (excluding the AI turn we are regenerating)
    const historyContext = story.history.slice(0, index);
    
    try {
        const token = await user.getIdToken();
        const res = await fetch("/api/generate", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({
                 token,
                 history: historyContext,
                 initialPrompt: story.initialPrompt,
                 history: historyContext,
                 initialPrompt: story.initialPrompt,
                 genres: story.genres,
                 style: story.storyStyle // Pass style
             })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        // Update the story history
        const updatedHistory = [...story.history];
        const currentTurn = updatedHistory[index];
        
        // Ensure versions array exists (migration for old messages)
        const currentVersions = currentTurn.versions || [currentTurn.content];
        const newVersions = [...currentVersions, data.story];
        
        // For choices, we also need to version them if we want per-version choices.
        // But the requested feature emphasizes message regeneration. 
        // We will store just the text versions for now as per plan "AI Turn Object: Add versions: Array of strings".
        // However, choices displayed in sidebar usually depend on the LAST message.
        // So we should update the 'active' content and choices to the new one.
        
        const newTurn = {
            ...currentTurn,
            content: data.story,
            choices: data.choices || [], // Update choices to match new story
            versions: newVersions,
            currentVersionIndex: newVersions.length - 1
        };
        
        updatedHistory[index] = newTurn;
        
        setStory(prev => ({ ...prev, history: updatedHistory }));
        await saveStoryHistory(user.uid, id, updatedHistory);
        
    } catch (err) {
        console.error("Regenerate error", err);
        alert("Failed to regenerate: " + err.message);
    } finally {
        setProcessing(false);
    }
  };

  const handleSwitchVersion = async (index, direction) => {
      const turn = story.history[index];
      if (!turn.versions || turn.versions.length <= 1) return;
      
      const currentIndex = turn.currentVersionIndex ?? (turn.versions.length - 1);
      let newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
      
      // Bounds check
      if (newIndex < 0) return;
      if (newIndex >= turn.versions.length) return;
      
      const newHistory = [...story.history];
      newHistory[index] = {
          ...turn,
          content: turn.versions[newIndex],
          currentVersionIndex: newIndex,
      };
      
      setStory(prev => ({ ...prev, history: newHistory }));
      await saveStoryHistory(user.uid, id, newHistory); // Persist selection
  };

  const handleEditStart = (index, content) => {
      setEditingIndex(index);
      setEditContent(content);
  };

  const handleEditCancel = () => {
      setEditingIndex(null);
      setEditContent("");
  };

  const handleEditSave = async (index) => {
      if (!user || processing || !editContent.trim()) return;
      
      setEditingIndex(null);
      setProcessing(true);
      
      // 1. Truncate history: Keep everything up to this index
      // The edited message becomes the LAST item in the new history context for the AI
      const keptHistory = story.history.slice(0, index);
      const updatedUserTurn = { role: "player", content: editContent };
      
      const newHistoryContext = [...keptHistory, updatedUserTurn];
      
      // Update local state immediately to reflect truncation and new message
      setStory(prev => ({
          ...prev,
          history: newHistoryContext
      }));
      
      try {
          // 2. Persist truncated history immediately (in case generation fails, at least state is consistent)
          await saveStoryHistory(user.uid, id, newHistoryContext);

          // 3. Call API to generate fresh continuation
          const token = await user.getIdToken();
          const res = await fetch("/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  token,
                  history: newHistoryContext,
                  initialPrompt: story.initialPrompt,
                  history: newHistoryContext,
                  initialPrompt: story.initialPrompt,
                  genres: story.genres,
                  style: story.storyStyle // Pass style
              })
          });
          
          const data = await res.json();
          if (data.error) throw new Error(data.error);
           
          // 4. Append AI response
          const aiTurn = {
              role: "ai",
              content: data.story,
              choices: data.choices || []
          };
          
          const finalHistory = [...newHistoryContext, aiTurn];
          setStory(prev => ({ ...prev, history: finalHistory }));
          await saveStoryHistory(user.uid, id, finalHistory);
          
      } catch (err) {
          console.error("Edit generation error", err);
          alert("Failed to continue story after edit: " + err.message);
      } finally {
          setProcessing(false);
          setEditContent("");
      }
  };

  const handleRefreshChoices = async () => {
    if (!user || processing || isRefreshing) return;
    setIsRefreshing(true);
    try {
        const token = await user.getIdToken();
        const res = await fetch("/api/regenerate-choices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                token,
                history: story.history,
                initialPrompt: story.initialPrompt,
                history: story.history,
                initialPrompt: story.initialPrompt,
                genres: story.genres,
                style: story.storyStyle // Pass style
            })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        // Update the last AI turn with new choices
        if (data.choices && data.choices.length > 0) {
            setStory(prev => {
                const newHistory = [...prev.history];
                const lastIdx = newHistory.length - 1;
                if (newHistory[lastIdx].role === 'ai') {
                    newHistory[lastIdx] = { ...newHistory[lastIdx], choices: data.choices };
                }
                return { ...prev, history: newHistory };
            });
            // Note: We are not updating Firestore history for this purely UI refresh preference, 
            // but effectively the next action will continue from these choices. 
            // If persistence of *offered* choices is needed, we'd need to update the doc.
            // For now, let's update Firestore too to keep sync.
            const lastTurn = story.history[story.history.length - 1];
            if (lastTurn.role === 'ai') {
                 // We need to fetch the story doc and update the last element of history array...
                 // Firestore array update is tricky for modifying last element. 
                 // Simpler approach: Just update local state. The user's next action is what matters.
                 // Actually, if they refresh and reload page, they want the new choices.
                 // But replacing an array item by index in Firestore requires reading entire array.
                 // Let's stick to local update for responsiveness, unless critical.
            }
        }
    } catch (err) {
        console.error("Refresh error", err);
        alert("Failed to refresh choices: " + err.message);
    } finally {
        setIsRefreshing(false);
    }
  };

  // Helper to remove markdown markers (**, __) from choices
  const cleanChoiceText = (text) => {
      return text.replace(/[\*_]{2}/g, '').trim(); 
  };

  if (loading) return <div className="p-10 text-center">Loading Story...</div>;
  if (!story) return <div className="p-10 text-center">Story not found.</div>;

  const lastTurn = story.history[story.history.length - 1];
  const activeChoices = lastTurn?.role === 'ai' ? lastTurn.choices : [];

  // Helper to format story text: remove brackets, handle newlines
  const formatContent = (text) => {
    // Remove leading/trailing brackets if they exist
    let cleaned = text.trim();
    if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
      cleaned = cleaned.slice(1, -1);
    }
    // You might also want to remove inner brackets if the model outputs paragraphs wrapped in brackets
    // But usually it's just the whole block. Let's start with outer.
    
    // Replace newline characters with proper markdown paragraphs
    // Ensure there are double newlines for ReactMarkdown to render paragraphs
    return cleaned.replace(/\n/g, '\n\n');
  };

  // Helper to render Choices Content (Reuse for both Mobile Inline and Desktop Sidebar)
  const renderChoices = (isMobile) => (
      <div className={`h-full flex flex-col ${isMobile ? 'p-0' : 'p-6 overflow-y-auto'}`}>
          {!isMobile && (
              <h2 className="text-xl font-bold text-white mb-6 flex items-center justify-between gap-2 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <span>Your Choice</span>
                  {!processing && <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>}
                </div>
                <button 
                  onClick={handleRefreshChoices}
                  disabled={processing || isRefreshing}
                  className="p-2 hover:bg-white/20 rounded-full transition disabled:opacity-50"
                  title="Refresh Choices"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </button>
              </h2>
          )}
          
          <div className={`flex-1 ${!isMobile ? 'overflow-y-auto pr-2 custom-scrollbar' : ''} space-y-3 mb-4`}>
          {!processing && activeChoices && activeChoices.length > 0 ? (
              <div className="space-y-3">
                {activeChoices.map((choice, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleChoice(cleanChoiceText(choice))}
                    className={`w-full text-left p-4 rounded-xl transition-all hover:scale-[1.02] active:scale-95 backdrop-blur-sm group/btn ${
                        isMobile 
                        ? 'bg-[#FF7B00] text-white shadow-lg border border-white/20' 
                        : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`font-bold transition-colors ${isMobile ? 'text-white/80' : 'text-white/60 group-hover/btn:text-white'}`}>{idx + 1}.</span>
                      <span className="font-medium text-sm md:text-base text-white">{cleanChoiceText(choice)}</span>
                    </div>
                  </button>
                ))}
              </div>
          ) : (
               !processing && (!activeChoices || activeChoices.length === 0) && (
                 <div className={`text-center py-10 italic border rounded-xl p-4 ${isMobile ? 'text-gray-400 border-gray-200' : 'text-white/60 border-white/10'}`}>
                   Refresh the choices
                 </div>
               )
          )}
          </div>

          {/* Custom Choice Input */}
          {!processing && (
              <div className={`mt-auto pt-4 ${isMobile ? 'border-t border-gray-200' : 'border-t border-white/20'}`}>
                 <label className={`block text-xs font-bold mb-2 uppercase tracking-wide ${isMobile ? 'text-gray-500' : 'text-white/70'}`}>Custom Choice</label>
                 <div className={`flex items-end gap-2 p-2 rounded-xl border focus-within:border-opacity-100 transition-all ${
                     isMobile 
                     ? 'bg-white border-gray-300 focus-within:border-[#FF7B00]' 
                     : 'bg-white/10 border-white/20 focus-within:bg-white/20 focus-within:border-white/50'
                 }`}>
                     <textarea
                         value={customChoice}
                         onChange={(e) => {
                             setCustomChoice(e.target.value);
                             e.target.style.height = 'auto';
                             e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                         }}
                         className={`flex-1 bg-transparent text-sm font-medium focus:outline-none resize-none max-h-[100px] py-1 px-1 custom-scrollbar ${isMobile ? 'text-gray-800 placeholder-gray-400' : 'text-white placeholder-white/40'}`}
                         placeholder="Type your own action..."
                         rows={1}
                         style={{ minHeight: '24px' }}
                     />
                     <button
                         onClick={() => {
                             if (customChoice.trim()) {
                                 handleChoice(customChoice);
                                 setCustomChoice("");
                             }
                         }}
                         disabled={!customChoice.trim() || processing}
                         className={`p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg ${isMobile ? 'bg-[#FF7B00] text-white' : 'bg-white text-[#FF7B00] hover:bg-gray-100'}`}
                     >
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                             <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                         </svg>
                     </button>
                 </div>
              </div>
          )}

         {processing && (
             <div className="flex flex-col items-center justify-center flex-1 space-y-4">
                 <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${isMobile ? 'border-[#FF7B00]' : 'border-white'}`}></div>
                 <p className={`text-sm font-medium animate-pulse ${isMobile ? 'text-gray-500' : 'text-white/70'}`}>Generating story...</p>
             </div>
         )}
      </div>
  );

  return (
    // Main Container with fixed height to enable independent scrolling
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[#FCF5EF]">
      
      {/* LEFT: Chat Section */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth relative">
        <div className="max-w-3xl mx-auto space-y-6 pb-20">
          <div className="border-b border-[#FF7B00]/20 pb-4 mb-8 text-center md:text-left">
             <h1 className="text-3xl font-extrabold text-[#FF7B00] tracking-tight">{story.title}</h1>
             <p className="text-sm font-bold text-[#FF7B00]/90 mt-2 italic text-justify leading-relaxed">{story.initialPrompt}</p>
          </div>

          {story.history.map((turn, index) => (
            <div key={index} className={`flex ${turn.role === 'player' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] lg:max-w-[75%] p-5 rounded-2xl shadow-sm text-base leading-relaxed group/bubble relative ${
                turn.role === 'player' 
                  ? 'bg-[#FF7B00] text-white rounded-br-none' 
                  : 'bg-white text-[#0A0A0A] border border-gray-100 rounded-bl-none'
              }`}>
                {/* Edit Form for User */}
                {editingIndex === index ? (
                    <div className="w-full min-w-[300px]">
                        <textarea
                            value={editContent}
                            onChange={(e) => {
                                setEditContent(e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                            }}
                            className="w-full bg-white/20 text-white placeholder-white/60 p-2 rounded-lg outline-none resize-none overflow-hidden mb-2 border border-white/30"
                            rows={1}
                        />
                        <div className="flex justify-end gap-2">
                            <button 
                                onClick={handleEditCancel}
                                className="px-3 py-1 text-sm bg-black/20 hover:bg-black/30 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => handleEditSave(index)}
                                className="px-3 py-1 text-sm bg-white text-[#FF7B00] font-bold rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className={`prose prose-sm max-w-none ${
                            turn.role === 'player' 
                                ? 'prose-p:text-white prose-headings:text-white prose-strong:text-white prose-ul:text-white' 
                                : 'prose-p:mb-4 last:prose-p:mb-0'
                        }`}>
                          <ReactMarkdown>{formatContent(turn.content)}</ReactMarkdown>
                        </div>
                        
                        {/* User Edit Menu (3 dots) */}
                        {turn.role === 'player' && !processing && (
                            <div className="absolute top-2 right-full mr-2 opacity-0 group-hover/bubble:opacity-100 transition-opacity flex items-center h-full">
                                <button
                                    onClick={() => handleEditStart(index, turn.content)}
                                    className="p-1.5 bg-white shadow-sm border border-gray-100 rounded-full text-gray-400 hover:text-[#FF7B00] transition-colors"
                                    title="Edit message"
                                >
                                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                     <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                   </svg>
                                </button>
                            </div>
                        )}
                        
                        {/* AI Controls: Reload & Version Nav */}
                        {turn.role === 'ai' && !processing && (
                            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100/50">
                                <button 
                                    onClick={() => handleRegenerate(index)}
                                    title="Regenerate response"
                                    className="p-1.5 text-gray-400 hover:text-[#FF7B00] hover:bg-orange-50 rounded-lg transition-colors"
                                >
                                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                       <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                     </svg>
                                </button>
                                
                                {turn.versions && turn.versions.length > 1 && (
                                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-0.5">
                                        <button 
                                            onClick={() => handleSwitchVersion(index, 'prev')}
                                            disabled={(turn.currentVersionIndex ?? (turn.versions.length - 1)) === 0}
                                            className="p-1 text-gray-400 hover:text-[#FF7B00] disabled:opacity-30 disabled:hover:text-gray-400"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                              <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                        <span className="text-xs font-bold text-gray-500 min-w-[30px] text-center">
                                            {(turn.currentVersionIndex ?? (turn.versions.length - 1)) + 1} / {turn.versions.length}
                                        </span>
                                        <button 
                                            onClick={() => handleSwitchVersion(index, 'next')}
                                            disabled={(turn.currentVersionIndex ?? (turn.versions.length - 1)) >= turn.versions.length - 1}
                                            className="p-1 text-gray-400 hover:text-[#FF7B00] disabled:opacity-30 disabled:hover:text-gray-400"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                              <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
              </div>
            </div>
          ))}

          {/* Mobile Choices (Inline at bottom of chat) */}
          <div className="md:hidden mt-8 mb-4">
              <h3 className="text-sm font-bold text-[#FF7B00] uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>Your Turn</span>
                  <button 
                      onClick={handleRefreshChoices}
                      disabled={processing || isRefreshing}
                      className="p-1 hover:bg-orange-100 rounded-full transition disabled:opacity-50"
                  >
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}>
                         <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                     </svg>
                  </button>
              </h3>
              {renderChoices(true)}
          </div>

          {processing && (
             <div className="flex justify-start">
               <div className="bg-white border border-gray-100 p-5 rounded-2xl rounded-bl-none animate-pulse text-gray-400 text-sm">
                 AI is writing...
               </div>
             </div>
          )}
          {/* Short AI Disclaimer */}
          <div className="text-center text-[10px] text-gray-400/60 pb-4 pt-10 select-none">
             AI-generated content. Fiction only.
          </div>
          <div ref={bottomRef} />
        </div>
      </div>

      {/* RIGHT: Desktop Sidebar (Hidden on Mobile) */}
      <div 
        className={`hidden md:block 
          relative inset-y-0 right-0 z-20 bg-[#FF7B00] shadow-none transition-all duration-300 ease-in-out
          ${showChoices ? 'w-96 translate-x-0' : 'w-0 translate-x-0'}
        `}
      >
          {/* Desktop Toggle Tab */}
          <button 
            onClick={() => setShowChoices(!showChoices)}
            className="absolute top-4 left-0 -translate-x-full bg-white text-[#FF7B00] p-2 rounded-l-md shadow-md z-30 hover:bg-gray-100 transition focus:outline-none"
            title="Toggle Choices"
          >
            {showChoices ? (
                // Chevron Right
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                 <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
            ) : (
                // Chevron Left
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
            )}
          </button>

          {/* Sidebar Content Wrapper */}
          <div className="w-96 h-full overflow-hidden flex flex-col">
              {renderChoices(false)}
          </div>
      </div>
    </div>
  );
}
