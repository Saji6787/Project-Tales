"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth";
import { getStory, updateStoryHistory } from "@/lib/firebase/firestore";
import ReactMarkdown from "react-markdown";

export default function StoryPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showChoices, setShowChoices] = useState(true); // Toggle logic
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
           initialPrompt: story.initialPrompt 
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

  if (loading) return <div className="p-10 text-center">Loading Story...</div>;
  if (!story) return <div className="p-10 text-center">Story not found.</div>;

  const lastTurn = story.history[story.history.length - 1];
  const activeChoices = lastTurn?.role === 'ai' ? lastTurn.choices : [];

  return (
    // Main Container with fixed height to enable independent scrolling
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[#FCF5EF]">
      
      {/* LEFT: Chat Section */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth relative">
        <div className="max-w-3xl mx-auto space-y-6 pb-20">
          <div className="border-b border-[#FF7B00]/20 pb-4 mb-8">
             <h1 className="text-3xl font-extrabold text-[#FF7B00] tracking-tight">{story.title}</h1>
             <p className="text-sm font-bold text-[#FF7B00]/90 mt-2 italic">{story.initialPrompt}</p>
          </div>

          {story.history.map((turn, index) => (
            <div key={index} className={`flex ${turn.role === 'player' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] lg:max-w-[75%] p-5 rounded-2xl shadow-sm text-base leading-relaxed ${
                turn.role === 'player' 
                  ? 'bg-[#FF7B00] text-white rounded-br-none' 
                  : 'bg-white text-[#0A0A0A] border border-gray-100 rounded-bl-none'
              }`}>
                <div className={`prose prose-sm max-w-none ${
                    turn.role === 'player' 
                        ? 'prose-p:text-white prose-headings:text-white prose-strong:text-white prose-ul:text-white' 
                        : ''
                }`}>
                  <ReactMarkdown>{turn.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

          {processing && (
             <div className="flex justify-start">
               <div className="bg-white border border-gray-100 p-5 rounded-2xl rounded-bl-none animate-pulse text-gray-400 text-sm">
                 AI is writing...
               </div>
             </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* RIGHT: Choices Sidebar */}
      <div 
        className={`group
          fixed inset-y-0 right-0 z-20 w-80 bg-[#FF7B00] shadow-2xl transition-all duration-300 ease-in-out
          md:relative md:shadow-none
          ${showChoices ? 'translate-x-0 md:translate-x-0 md:w-96' : 'translate-x-full md:translate-x-0 md:w-0'}
        `}
      >
          {/* Toggle Button */}
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

          {/* Sidebar Content Wrapper (Fixed width to prevent squashing during width transition) */}
          <div className="w-80 md:w-96 h-full overflow-hidden">
             <div className="h-full overflow-y-auto p-6 flex flex-col">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 whitespace-nowrap">
                  <span>Your Choice</span>
                  {!processing && <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>}
                </h2>
                
                {!processing && activeChoices && activeChoices.length > 0 ? (
                    <div className="space-y-3">
                      {activeChoices.map((choice, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleChoice(choice)}
                          className="w-full text-left bg-white/10 hover:bg-white/20 text-white p-4 rounded-xl border border-white/20 transition-all hover:scale-[1.02] active:scale-95 backdrop-blur-sm group/btn"
                        >
                          <div className="flex items-start gap-3">
                            <span className="font-bold text-white/60 group-hover/btn:text-white transition-colors">{idx + 1}.</span>
                            <span className="font-medium text-sm md:text-base text-white">{choice}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                ) : (
                     !processing && (!activeChoices || activeChoices.length === 0) && (
                       <div className="text-white/60 text-center py-10 italic border border-white/10 rounded-xl p-4">
                         End of story or waiting for response...
                       </div>
                     )
                )}

                {processing && (
                    <div className="flex flex-col items-center justify-center flex-1 text-white/70 space-y-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                        <p className="text-sm font-medium animate-pulse">Generating story...</p>
                    </div>
                )}
             </div>
          </div>
      </div>
    </div>
  );
}
