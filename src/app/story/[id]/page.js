"use client";
import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth";
import { getStory, updateStoryHistory, saveStoryHistory, getPersonas, updateStory } from "@/lib/firebase/firestore";
import ReactMarkdown from "react-markdown";

export default function StoryPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [story, setStory] = useState(null);
  const [activePersona, setActivePersona] = useState(null); // Add this
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showChoices, setShowChoices] = useState(true); // Toggle logic
  const [customChoice, setCustomChoice] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null); // Index of message being edited
  const [editContent, setEditContent] = useState(""); // Content of message being edited
  
  // Memory Modal State
  const [memoryModal, setMemoryModal] = useState({
      isOpen: false,
      content: null, // The chat content to summarize
      targetIndex: null, // Index of the message in history
      step: 'idle', // 'idle', 'confirm', 'processing', 'success', 'error'
      result: null, // The generated summary
      error: null
  });
  
  const bottomRef = useRef(null);

  useEffect(() => {
    if (user && id) {
      getStory(user.uid, id).then(s => {
        setStory(s);
        setLoading(false);
      });
    }
  }, [user, id]);

  // Fetch Active Persona
  useEffect(() => {
      if (user && story?.activePersonaId) {
          getPersonas(user.uid).then(personas => {
              const found = personas.find(p => p.id === story.activePersonaId);
              if (found) setActivePersona(found);
          });
      }
  }, [user, story?.activePersonaId]);

  // Scroll logic
  const isInitialLoad = useRef(true);
  const lastMessageRef = useRef(null);

  useEffect(() => {
    if (story?.history?.length > 0) {
        // On initial load, scroll to the last message (not the very bottom)
        if (isInitialLoad.current) {
            lastMessageRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
            isInitialLoad.current = false;
        } else {
            // On subsequent updates (new messages), scroll smoothly to bottom to show generation
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    } else if (story && story.history.length === 0 && !processing && !loading) {
        // Auto-start if history is empty (and we're not loading/processing)
        generateFirstMessage();
    }
    
    // Safety check: Mark initial load done once story is loaded
    if (story && loading === false && isInitialLoad.current) {
        isInitialLoad.current = false;
    }
  }, [story?.history, loading, processing]);

  const generateFirstMessage = async () => {
    if (processing || !user || !story) return;
    setProcessing(true);
    try {
        let replacementName = "User"; // Default fallback
        
        // Fetch persona for replacement (Active or Default)
        try {
            // Using getPersonas to find active or default one. 
            const { getPersonas } = await import("@/lib/firebase/firestore");
            const personas = await getPersonas(user.uid);
            
            let targetPersona = null;
            if (story.activePersonaId) {
                targetPersona = personas.find(p => p.id === story.activePersonaId);
            }
            
            // Fallback to default if active not set or not found
            if (!targetPersona) {
                targetPersona = personas.find(p => p.isDefault);
            }

            if (targetPersona) {
                replacementName = targetPersona.name;
            }
        } catch (e) {
            console.warn("Failed to fetch persona for replacement", e);
        }

        // Check if character has a pre-defined first message
        if (story.firstMessage && story.firstMessage.trim()) {
             let processedMessage = story.firstMessage;
             
             // Dynamic Replacement of [User], {User}, etc.
             const pattern = /\[User\]|\{User\}|\(User\)|\{Player\}|\[You\]|\[Player\]/gi;
             processedMessage = processedMessage.replace(pattern, replacementName);

             const aiTurn = {
                role: "ai",
                content: processedMessage,
                choices: [], // We'll assume no choices for a static greeting, or user can reply
                chapterMetadata: { number: 1, title: "Prologue" } // Default metadata
            };
            
            const newHistory = [aiTurn];
            setStory(prev => ({ ...prev, history: newHistory }));
            await saveStoryHistory(user.uid, id, newHistory);
            
            // Optionally: Generating choices for this first message would be good, 
            // but for now let's just let the user reply to the greeting.
            setProcessing(false);
            return;
        }

        const token = await user.getIdToken();
        const res = await fetch("/api/generate", {
            method: "POST",
             headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                token,
                history: [], // Empty history
                initialPrompt: story.initialPrompt,
                genres: story.genres,
                style: story.storyStyle,
                style: story.storyStyle,
                currentChapter: 1,
                activePersonaId: story.activePersonaId,
                locations: story.assets?.locations || [],
                characters: story.assets?.characters || [],
                customs: story.assets?.customs || [],
                storyType: story.type,
                storyTitle: story.title,
                memories: story.memories || []
            })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // Detect if AI added a new memory
        const prevMemories = story.memories || [];
        const newMemories = data.memories || [];
        // Find memory that is in new but not in old
        const addedMemory = newMemories.find(m => !prevMemories.includes(m));

        const aiTurn = {
            role: "ai",
            content: data.story,
            choices: data.choices || [],
            chapterMetadata: data.chapter || null,
            isMemorized: !!addedMemory,
            memoryRef: addedMemory || null
        };
        
        const newHistory = [aiTurn];
        setStory(prev => ({ ...prev, history: newHistory, memories: data.memories || [] }));
        await saveStoryHistory(user.uid, id, newHistory);
    } catch (err) {
        console.error("Failed to start story", err);
    } finally {
        setProcessing(false);
    }
  };

  // Helper to get current chapter number
  const getCurrentChapter = (historyData) => {
      // Find the last message that has chapterMetadata
      for (let i = historyData.length - 1; i >= 0; i--) {
          if (historyData[i].chapterMetadata) {
              return historyData[i].chapterMetadata.number;
          }
      }
      return 1; // Default to Chapter 1
  };

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
      const currentChapter = getCurrentChapter(newHistory);
      
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
           token, 
           history: newHistory,
           initialPrompt: story.initialPrompt,
           style: story.storyStyle, // Pass style 
           currentChapter: currentChapter,
           activePersonaId: story.activePersonaId,
           locations: story.assets?.locations || [],
           characters: story.assets?.characters || [],
           customs: story.assets?.customs || [],
           storyType: story.type,
           storyTitle: story.title,
           storyId: story.id,
           memories: story.memories || []
        }),
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // 3. Update UI / Firestore with AI Response
      
      // Detect added memory
      const prevMemories = story.memories || [];
      const newMemories = data.memories || [];
      const addedMemory = newMemories.find(m => !prevMemories.includes(m));

      const aiTurn = { 
          role: "ai", 
          content: data.story, 
          choices: data.choices || [],
          chapterMetadata: data.chapter || null,
          isMemorized: !!addedMemory,
          memoryRef: addedMemory || null
      };
      
      await updateStoryHistory(user.uid, id, aiTurn);
      setStory(prev => ({ 
          ...prev, 
          history: [...prev.history, aiTurn],
          memories: data.memories || prev.memories || []
      }));

    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleRetryLastTurn = async () => {
    if (processing || !user) return;
    setProcessing(true);
    
    try {
        const token = await user.getIdToken();
        const currentChapter = getCurrentChapter(story.history);
        
        const res = await fetch("/api/generate", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({
                 token,
                 history: story.history,
                 initialPrompt: story.initialPrompt,
                 genres: story.genres,
                 style: story.storyStyle,
                 currentChapter: currentChapter,
                 activePersonaId: story.activePersonaId,
                 locations: story.assets?.locations || [],
                 characters: story.assets?.characters || [],
                 customs: story.assets?.customs || [],
                 storyType: story.type,
                 storyTitle: story.title,
                 storyId: story.id,
                 memories: story.memories || []
             })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        const prevMemories = story.memories || [];
        const newMemories = data.memories || [];
        const addedMemory = newMemories.find(m => !prevMemories.includes(m));
        
        const aiTurn = {
           role: "ai",
           content: data.story,
           choices: data.choices || [],
           chapterMetadata: data.chapter || null,
           isMemorized: !!addedMemory,
           memoryRef: addedMemory || null
        };
        
        const newHistory = [...story.history, aiTurn];
        setStory(prev => ({ ...prev, history: newHistory, memories: data.memories || prev.memories || [] }));
        await saveStoryHistory(user.uid, id, newHistory);
        
    } catch (err) {
        console.error("Retry error", err);
        alert("Failed to retry: " + err.message);
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
        const currentChapter = getCurrentChapter(historyContext);

        const res = await fetch("/api/generate", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({
                 token,
                 history: historyContext,
                 initialPrompt: story.initialPrompt,
                 genres: story.genres,
                 style: story.storyStyle, // Pass style
                 currentChapter: currentChapter,
                 activePersonaId: story.activePersonaId,
                 locations: story.assets?.locations || [],
                 characters: story.assets?.characters || [],
                 customs: story.assets?.customs || [],
                 storyType: story.type,
                 storyTitle: story.title,
                 storyId: story.id,
                 memories: story.memories || []
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
        
        const prevMemories = story.memories || [];
        const newMemories = data.memories || [];
        const addedMemory = newMemories.find(m => !prevMemories.includes(m));

        const newTurn = {
            ...currentTurn,
            content: data.story,
            choices: data.choices || [], // Update choices to match new story
            versions: newVersions,
            currentVersionIndex: newVersions.length - 1,
            chapterMetadata: data.chapter || currentTurn.chapterMetadata, // preserve or update chapter if regenerated
            // If new memory added, flag this turn. 
            // If NOT added, we technically keep previous flag if ...currentTurn had it.
            // But we should probably prioritize the current generation's status if it adds something?
            // For now, let's just UPDATE if added.
            ...(addedMemory ? { isMemorized: true, memoryRef: addedMemory } : {})
        };
        
        updatedHistory[index] = newTurn;
        
        setStory(prev => ({ ...prev, history: updatedHistory, memories: data.memories || prev.memories || [] }));
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

  const handlePressStart = (index) => {
     // Only allow for last message
     if (index !== story.history.length - 1) return;
     
     setPressedIndex(index);
     longPressTimer.current = setTimeout(() => {
         // Debug message as requested
         // alert("Mobile Edit Mode Triggered!"); 
         
         setShowMobileEdit(true);
         setPressedIndex(null); 
         if (navigator.vibrate) navigator.vibrate(50);
     }, 400);
  };

  const handlePressEnd = () => {
     setPressedIndex(null);
     if (longPressTimer.current) {
         clearTimeout(longPressTimer.current);
     }
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
          const currentChapter = getCurrentChapter(newHistoryContext);

          const res = await fetch("/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  token,
                  history: newHistoryContext,
                  initialPrompt: story.initialPrompt,
                  genres: story.genres,
                  style: story.storyStyle, // Pass style
                  currentChapter: currentChapter,
                  currentChapter: currentChapter,
                  activePersonaId: story.activePersonaId,
                  locations: story.assets?.locations || [],
                  characters: story.assets?.characters || [],
                  activePersonaId: story.activePersonaId,
                  locations: story.assets?.locations || [],
                  characters: story.assets?.characters || [],
                  customs: story.assets?.customs || [],
                  storyType: story.type,
                  storyTitle: story.title,
                  memories: story.memories || []
              })
          });
          
          const data = await res.json();
          if (data.error) throw new Error(data.error);
           
          // 4. Append AI response
          const aiTurn = {
              role: "ai",
              content: data.story,
              choices: data.choices || [],
              chapterMetadata: data.chapter || null
          };
          
          const finalHistory = [...newHistoryContext, aiTurn];
          setStory(prev => ({ ...prev, history: finalHistory, memories: data.memories || prev.memories || [] }));
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
                genres: story.genres,
                style: story.storyStyle, // Pass style
                activePersonaId: story.activePersonaId,
                locations: story.assets?.locations || [],
                characters: story.assets?.characters || [],
                customs: story.assets?.customs || [],
                storyType: story.type,
                storyTitle: story.title
            })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        // Update the last AI turn with new choices
        if (data.choices && data.choices.length > 0) {
            setStory(prev => {
                const newHistory = [...prev.history];
                const lastIdx = newHistory.length - 1;
                if (lastIdx >= 0 && newHistory[lastIdx].role === 'ai') {
                    newHistory[lastIdx] = { ...newHistory[lastIdx], choices: data.choices };
                }
                return { ...prev, history: newHistory };
            });
        }
    } catch (err) {
        console.error("Refresh error", err);
        alert("Failed to refresh choices: " + err.message);
    } finally {
        setIsRefreshing(false);
    }
  };

  const handleAddToMemory = (content, index) => {
      const isAlreadyMemorized = story.history[index]?.isMemorized;
      
      if (isAlreadyMemorized) {
          // Open "Forget" modal
          setMemoryModal({
              isOpen: true,
              content: content,
              targetIndex: index,
              step: 'delete_confirm', // New step
              result: null,
              error: null
          });
      } else {
          // Open "Add" modal
          setMemoryModal({
              isOpen: true,
              content: content,
              targetIndex: index,
              step: 'confirm',
              result: null,
              error: null
          });
      }
  };

  const proceedMemoryGeneration = async () => {
    if (!user || !story || !memoryModal.content) return;

    setMemoryModal(prev => ({ ...prev, step: 'processing' }));

    try {
        const token = await user.getIdToken();
        const res = await fetch("/api/summarize-memory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                token,
                content: memoryModal.content
            })
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // Fetch fresh story state to ensure we have the latest memories/history
        // This prevents "resurrecting" deleted memories if local state was stale
        const freshStory = await getStory(user.uid, story.id);
        const currentMemories = freshStory?.memories || [];
        // Use fresh history but fallback to story.history if fetch fails (unlikely if authorized)
        // Note: Changing history length externally is rare while in this flow, but safer to use fresh.
        let updatedHistory = [...(freshStory?.history || story.history)];

        const newMemory = data.summary;
        // Add to story memories
        const updatedMemories = [...currentMemories, newMemory];
        
        // Mark message as memorized
        if (memoryModal.targetIndex !== null && updatedHistory[memoryModal.targetIndex]) {
            updatedHistory[memoryModal.targetIndex] = { 
                ...updatedHistory[memoryModal.targetIndex], 
                isMemorized: true,
                memoryRef: newMemory // Store the summary text to link/identify later
            };
        }

        // Update local state - merge fresh data with our updates
        setStory(prev => ({ 
            ...prev,
            ...freshStory, // sync any other changes
            memories: updatedMemories,
            history: updatedHistory
        }));
        
        // Update Firestore
        await updateStory(user.uid, story.id, { 
            memories: updatedMemories,
            history: updatedHistory
         });
        
        setMemoryModal(prev => ({ 
            ...prev, 
            step: 'success', 
            result: newMemory 
        }));

    } catch (err) {
        console.error("Failed to add memory:", err);
        setMemoryModal(prev => ({ 
            ...prev, 
            step: 'error', 
            error: err.message 
        }));
    }
  };

  const proceedForgetMemory = async () => {
      if (!user || !story || memoryModal.targetIndex === null) return;

      setMemoryModal(prev => ({ ...prev, step: 'processing' }));

      try {
        // Fetch fresh story state
        const freshStory = await getStory(user.uid, story.id);
        const currentMemories = freshStory?.memories || [];
        let updatedHistory = [...(freshStory?.history || story.history)];
        
        // Note: targetIndex is based on RENDERED history. 
        // If real history changed length (e.g. parallel session), index might be risky.
        // But for single session, it should match. Ideally use message ID.
        // For now, proceed with index assuming single session.

        const targetTurn = updatedHistory[memoryModal.targetIndex];
        if (!targetTurn) throw new Error("Message not found");

        const memoryText = targetTurn.memoryRef;
        
        // Remove from memories array
        const updatedMemories = currentMemories.filter(m => m !== memoryText);

        // Update history item
        updatedHistory[memoryModal.targetIndex] = {
            ...targetTurn,
            isMemorized: false,
            memoryRef: null
        };

        // Update local state - merge
        setStory(prev => ({ 
            ...prev, 
            ...freshStory,
            memories: updatedMemories,
            history: updatedHistory
        }));
        
        // Update Firestore
        await updateStory(user.uid, story.id, { 
            memories: updatedMemories,
            history: updatedHistory
        });

        setMemoryModal({ isOpen: false, content: null, targetIndex: null, step: 'idle', result: null, error: null });

      } catch (err) {
        console.error("Failed to forget memory:", err);
        setMemoryModal(prev => ({ 
            ...prev, 
            step: 'error', 
            error: err.message 
        }));
      }
  };

  const closeMemoryModal = () => {
      setMemoryModal({ isOpen: false, content: null, targetIndex: null, step: 'idle', result: null, error: null });
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
    return cleaned.replace(/\n/g, '\n\n');
  };

  // Helper component to highlight dialogs
  const HighlightedText = ({ children, className }) => {
      if (typeof children !== 'string') return children;
      
      const parts = children.split(/(".*?")/g);
      return parts.map((part, index) => {
          if (part.startsWith('"') && part.endsWith('"')) {
              return <span key={index} className={`${className || 'text-[#FF7B00]'} font-medium`}>{part}</span>;
          }
          return part;
      });
  };

  // Helper to render Choices Content
  const renderChoices = (isMobile) => (
      <div className={`flex flex-col ${isMobile ? 'p-0' : 'p-6 h-full'}`}>
          {!isMobile && (
              <h2 className="text-xl font-bold text-white mb-6 flex items-center justify-between gap-2 whitespace-nowrap shrink-0">
                <div className="flex items-center gap-2">
                  <span>Choose Your Path:</span>
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
          
          <div className={`flex-1 ${!isMobile ? 'overflow-y-auto pr-2 custom-scrollbar' : ''} flex flex-col`}>
              <div className={`${isMobile ? 'space-y-2 mb-2' : 'space-y-3 mb-4'}`}>
              {!processing && activeChoices && activeChoices.length > 0 ? (
                  <div className="space-y-3">
                    {activeChoices.map((choice, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleChoice(cleanChoiceText(choice))}
                        className={`w-full text-left ${isMobile ? 'p-3' : 'p-4'} rounded-xl transition-all hover:scale-[1.02] active:scale-95 backdrop-blur-sm group/btn ${
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

              {/* Custom Choice Input - Now part of the flow */}
              {!processing && (
                  <div className={`${isMobile ? 'pt-2 border-t border-gray-200 mt-2' : 'pt-4 border-t border-white/20 mt-4'}`}>
                     <label className={`block text-xs font-bold ${isMobile ? 'mb-1' : 'mb-2'} uppercase tracking-wide ${isMobile ? 'text-gray-500' : 'text-white/70'}`}>Custom Choice</label>
                     <div className={`flex items-center gap-2 p-2 rounded-xl border focus-within:border-opacity-100 transition-all ${
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
                             className={`p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg ${isMobile ? 'bg-[#FF7B00] text-white' : 'bg-white text-[#5a2e0c] hover:bg-gray-100'}`}
                         >
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                 <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                             </svg>
                         </button>
                     </div>
                  </div>
              )}
          </div>
          
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
          <div className="relative w-full mb-8 min-h-[300px] flex flex-col justify-end group rounded-[2.5rem] overflow-hidden">
              {/* Background Image */}
              {story.coverImage ? (
                  <>
                      <div 
                          className="absolute inset-0 bg-cover bg-no-repeat transition-transform duration-700 group-hover:scale-105"
                          style={{ backgroundImage: `url(${story.coverImage})`, backgroundPosition: 'center 30%' }}
                      />
                      
                      {/* Edge Fading (Blur effect) - Matching Page Background #FCF5EF */}
                      <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#FCF5EF] to-transparent z-10" />
                      <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#FCF5EF] to-transparent z-10" />
                      <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-[#FCF5EF] to-transparent z-10" />
                      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#FCF5EF] via-[#FCF5EF]/60 to-transparent z-0" />
                  </>
              ) : (
                  <div className="absolute inset-0 bg-[#FF7B00]" />
              )}
              
              {/* Content */}
              <div className="relative z-20 p-6 md:p-10">
                  <h1 className="text-4xl md:text-6xl font-black text-[#FF7B00] mb-4 tracking-tight leading-none drop-shadow-[0_2px_4px_rgba(255,255,255,0.9)]">
                      {story.title}
                  </h1>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                      {/* Story Type Tag */}
                      <span className="px-3 py-1 bg-white border border-[#FF7B00]/30 text-[#FF7B00] text-xs font-bold rounded-full uppercase tracking-wider shadow-sm">
                          {story.type === 'character' ? 'Character' : 'Adventure'}
                      </span>
                      
                      {/* Genre Tags */}
                      {story.genres?.map((genre) => (
                          <span key={genre} className="px-3 py-1 bg-[#FF7B00] text-white text-xs font-bold rounded-full uppercase tracking-wider shadow-sm">
                              {genre}
                          </span>
                      ))}
                  </div>
              </div>
          </div>
           
           {(() => {
             const lastPlayerIndex = story.history.reduce((last, turn, idx) => turn.role === 'player' ? idx : last, -1);
             
             return story.history.map((turn, index) => { 
                const isCharacterMode = story.type === 'character';
                
                return (
                 <div key={index} className="w-full">
                    {/* Chapter Divider */}
                    {turn.chapterMetadata && (
                        <div className="flex items-center justify-center py-8 my-4">
                            <div className="h-px bg-[#FF7B00]/30 w-16 md:w-32"></div>
                            <div className="px-4 text-center">
                                <span className="block text-xs font-bold text-[#FF7B00] uppercase tracking-widest mb-1">Chapter {turn.chapterMetadata.number}</span>
                                <span className="block text-xl font-serif font-bold text-[#FF7B00]">{turn.chapterMetadata.title}</span>
                            </div>
                            <div className="h-px bg-[#FF7B00]/30 w-16 md:w-32"></div>
                        </div>
                    )}

                    {/* Character Mode Layout */}
                    {isCharacterMode ? (
                        <div 
                            ref={index === story.history.length - 1 ? lastMessageRef : null}
                            className={`flex gap-4 mb-6 ${turn.role === 'player' ? 'flex-row-reverse' : 'flex-row'}`}
                        >
                            {/* Avatar (User) */}
                            {turn.role === 'player' && (
                                <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-[#FF7B00] shadow-sm bg-white">
                                    {activePersona?.photoUrl ? (
                                        <img src={activePersona.photoUrl} alt="User" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-500 font-bold text-lg">
                                            U
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Avatar (AI Only) */}
                            {turn.role === 'ai' && (
                                <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-white shadow-sm bg-white">
                                    {story.coverImage ? (
                                        <img src={story.coverImage} alt={story.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-[#FF7B00] text-white font-bold text-lg">
                                            {story.title?.[0]?.toUpperCase() || 'C'}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Content Column */}
                            <div className={`flex flex-col max-w-[85%] md:max-w-[75%] ${turn.role === 'player' ? 'items-end' : 'items-start'}`}>
                                {/* Name (AI Only) */}
                                {turn.role === 'ai' && (
                                    <span className="text-[#FF7B00] font-bold text-sm mb-1 ml-1">{story.title}</span>
                                )}

                                {/* Message Bubble/Card */}
                                <div className={`p-4 md:p-5 text-base shadow-sm relative group/bubble flex flex-col justify-center ${
                                    turn.role === 'player' 
                                        ? 'bg-[#FF7B00] text-white rounded-2xl rounded-tr-none' 
                                        : 'bg-white text-black rounded-2xl rounded-tl-none border border-gray-100'
                                }`}>
                                     {editingIndex === index && turn.role === 'player' ? (
                                         <div className="min-w-[250px]">
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
                                                 <button onClick={handleEditCancel} className="px-3 py-1 text-xs bg-black/20 hover:bg-black/30 rounded-lg text-white">Cancel</button>
                                                 <button onClick={() => handleEditSave(index)} className="px-3 py-1 text-xs bg-white text-[#FF7B00] font-bold rounded-lg hover:bg-gray-100">Save</button>
                                             </div>
                                         </div>
                                     ) : (
                                        <>
                                            <div className="prose prose-sm max-w-none prose-p:mb-2 last:prose-p:mb-0 [&>p]:mt-0">
                                                <ReactMarkdown
                                                    components={{
                                                        p: ({node, children, ...props}) => (
                                                            <p className={turn.role === 'player' ? 'text-[#5a2e0c]' : 'text-black'} {...props}>
                                                                {React.Children.map(children, child =>  
                                                                    typeof child === 'string' ? (
                                                                        <HighlightedText className={turn.role === 'player' ? 'text-white' : 'text-[#FF7B00]'}>
                                                                            {child}
                                                                        </HighlightedText>
                                                                    ) : child
                                                                )}
                                                            </p>
                                                        )
                                                    }}
                                                >
                                                    {formatContent(turn.content)}
                                                </ReactMarkdown>
                                            </div>

                                            {/* Player Message Star Button - Added inside bubble, visible on hover */}
                                            {turn.role === 'player' && !processing && (
                                                <div className="absolute top-2 right-2 opacity-0 group-hover/bubble:opacity-100 transition-opacity">
                                                     <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleAddToMemory(turn.content, index);
                                                        }}
                                                        title={turn.isMemorized ? "Saved to Memory" : "Add to Memory"}
                                                        className={`p-1 rounded-full shadow-sm ${
                                                            turn.isMemorized 
                                                                ? "bg-[#FF7B00] text-white" 
                                                                : "bg-white/20 text-white hover:bg-white/40"
                                                        }`}
                                                    >
                                                        {turn.isMemorized ? (
                                                            // Filled Star
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                                                                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                                                            </svg>
                                                        ) : (
                                                            // Outline Star
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                </div>
                                            )}

                                            {/* AI Controls (Regenerate & Version) */}
                                            {turn.role === 'ai' && !processing && (
                                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100/50 transition-opacity duration-200">
                                                     {/* Versions & Memory (Left) */}
                                                     <div className="flex items-center gap-2">
                                                         {turn.versions && turn.versions.length > 1 && (
                                                             <div className="flex items-center gap-1 text-xs text-gray-400">
                                                                 <button onClick={() => handleSwitchVersion(index, 'prev')} disabled={(turn.currentVersionIndex ?? (turn.versions.length - 1)) === 0} className="hover:text-[#FF7B00] disabled:opacity-30 px-1 py-0.5">&lt;</button>
                                                                 <span>{(turn.currentVersionIndex ?? (turn.versions.length - 1)) + 1}/{turn.versions.length}</span>
                                                                 <button onClick={() => handleSwitchVersion(index, 'next')} disabled={(turn.currentVersionIndex ?? (turn.versions.length - 1)) >= turn.versions.length - 1} className="hover:text-[#FF7B00] disabled:opacity-30 px-1 py-0.5">&gt;</button>
                                                             </div>
                                                         )}
                                                         
                                                         {/* Memory Star Button */}
                                                         <button 
                                                            onClick={() => handleAddToMemory(turn.content, index)}
                                                            title={turn.isMemorized ? "Saved to Memory" : "Add to Memory"}
                                                            className={`p-1 rounded transition-colors ${
                                                                turn.isMemorized 
                                                                    ? "text-[#FF7B00]" 
                                                                    : "text-[#FF7B00] hover:bg-orange-50 hover:text-[#e06c00]"
                                                            }`}
                                                         >
                                                             {turn.isMemorized ? (
                                                                 // Filled Star
                                                                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                                                                 </svg>
                                                             ) : (
                                                                 // Outline Star
                                                                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                                                                 </svg>
                                                             )}
                                                         </button>
                                                     </div>

                                                     {/* Regenerate (Right) */}
                                                     {index === story.history.length - 1 && (
                                                        <button onClick={() => handleRegenerate(index)} title="Regenerate" className="p-1 text-gray-400 hover:text-[#FF7B00] transition disabled:opacity-30">
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                                                        </button>
                                                     )}
                                                </div>
                                            )}
                                        </>
                                     )}

                                     {/* User Edit Button (Hover) */}
                                     {turn.role === 'player' && !processing && index === lastPlayerIndex && !editingIndex && (
                                         <button 
                                            onClick={() => handleEditStart(index, turn.content)} 
                                            className="absolute -left-8 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#FF7B00]"
                                            title="Edit"
                                         >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                                         </button>
                                     )}
                                </div>
                                {/* Retry (only for user last message) */}
                                {turn.role === 'player' && index === story.history.length - 1 && !processing && (
                                   <div className="flex justify-end mt-1">
                                       <button onClick={handleRetryLastTurn} className="text-xs text-gray-400 hover:text-[#FF7B00] flex items-center gap-1">
                                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                                           Retry
                                       </button>
                                   </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Adventure Mode Layout (Original)
                        <div 
                            ref={index === story.history.length - 1 ? lastMessageRef : null}
                            className={`flex items-end gap-2 ${turn.role === 'player' ? 'justify-end' : 'justify-start'}`}
                        >
                    {/* Retry Button for User (Only if last message and no AI response) */}
                    {turn.role === 'player' && index === story.history.length - 1 && !processing && (
                        <button 
                            onClick={handleRetryLastTurn}
                            className="p-2 mb-2 rounded-full bg-gray-100 hover:bg-[#FF7B00]/10 text-gray-400 hover:text-[#FF7B00] transition-colors shadow-sm"
                            title="Retry / Continue Story"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                        </button>
                    )}
                    <div className={`max-w-[85%] lg:max-w-[75%] p-5 rounded-2xl shadow-sm text-base leading-relaxed group/bubble relative ${
                        turn.role === 'player' 
                        ? `bg-[#FF7B00] text-white rounded-br-none ${index === lastPlayerIndex ? 'mb-6 md:mb-0' : ''}` 
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
                                
                                {/* User Edit Menu (3 dots) - Repositioned Below Bubble */}
                                {turn.role === 'player' && !processing && index === lastPlayerIndex && (
                                    <div className="absolute top-full right-0 mt-2 z-10 transition-all duration-200 opacity-100 md:opacity-0 md:group-hover/bubble:opacity-100 translate-y-0">
                                        <button
                                            onClick={() => handleEditStart(index, turn.content)}
                                            className="px-3 py-1 bg-white shadow-md border border-gray-100 rounded-lg text-xs font-bold text-gray-500 hover:text-[#FF7B00] hover:bg-gray-50 transition-colors flex items-center gap-1"
                                            title="Edit message"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                            </svg>
                                            Edit
                                        </button>
                                    </div>
                                )}
                                
                                {
                                    /* Player Message Star Button - Added below bubble */
                                    !processing && (
                                        <div className="absolute top-full right-0 mt-1 mr-1 opacity-0 group-hover/bubble:opacity-100 transition-opacity">
                                             <button 
                                                onClick={() => handleAddToMemory(turn.content, index)}
                                                title={turn.isMemorized ? "Saved to Memory" : "Add to Memory"}
                                                className={`p-1 rounded-full shadow-sm ${
                                                    turn.isMemorized 
                                                        ? "bg-white text-[#FF7B00] border border-[#FF7B00]" // Visually distinct but clean
                                                        : "bg-white text-[#FF7B00] hover:bg-orange-50"
                                                }`}
                                            >
                                                {turn.isMemorized ? (
                                                    // Filled Star
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                                                    </svg>
                                                ) : (
                                                    // Outline Star
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                    )
                                }
                                
                                {/* AI Controls: Reload & Version Nav */}
                                {turn.role === 'ai' && !processing && (
                                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100/50 justify-between">
                                        <div className="flex items-center gap-2">
                                            {/* Version Controls */}
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

                                            {/* Star / Memory Button (Show always for AI) */}
                                            <button 
                                                onClick={() => handleAddToMemory(turn.content, index)}
                                                title={turn.isMemorized ? "Saved to Memory" : "Add to Memory"}
                                                className={`p-1.5 rounded-lg transition-colors ${
                                                    turn.isMemorized 
                                                        ? "text-[#FF7B00] bg-orange-50" 
                                                        : "text-[#FF7B00] hover:text-[#e06c00] hover:bg-orange-50"
                                                }`}
                                            >
                                                {turn.isMemorized ? (
                                                     // Filled Star
                                                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                                        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                                                     </svg>
                                                ) : (
                                                    // Outline Star
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>

                                        {/* Regenerate Button (Only for latest) */}
                                        {index === story.history.length - 1 && (
                                            <button 
                                                onClick={() => handleRegenerate(index)}
                                                title="Regenerate response"
                                                className="p-1.5 text-gray-400 hover:text-[#FF7B00] hover:bg-orange-50 rounded-lg transition-colors"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
                )}
            </div>
            );
        })
          })()}

          {/* Mobile Choices (Inline at bottom of chat) */}
          <div className="md:hidden mt-8 mb-4">
              <h3 className="text-sm font-bold text-[#FF7B00] uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>Choose Your Path:</span>
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
      
      {/* Memory Modal */}
      {memoryModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">
                  {/* Header */}
                  <div className="bg-[#FF7B00] px-6 py-4 flex items-center justify-between">
                      <h3 className="text-white font-bold text-lg flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                            </svg>
                          {memoryModal.step === 'delete_confirm' ? 'Forget Memory' : 'Add to Memory'}
                      </h3>
                      {memoryModal.step !== 'processing' && (
                          <button onClick={closeMemoryModal} className="text-white/80 hover:text-white transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </button>
                      )}
                  </div>

                  {/* Body */}
                  <div className="p-6">
                       {memoryModal.step === 'confirm' && (
                          <>
                            <div className="mb-6">
                                <p className="text-gray-600 mb-2">Are you sure you want to add this chat to the character's long-term memory?</p>
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-600 italic max-h-48 overflow-y-auto custom-scrollbar">
                                    "{memoryModal.content}"
                                </div>
                                <p className="text-xs text-orange-500 mt-2 font-medium">The AI will generate a summary of this interaction.</p>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button 
                                    onClick={closeMemoryModal}
                                    className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={proceedMemoryGeneration}
                                    className="px-4 py-2 bg-[#FF7B00] hover:bg-[#e06c00] text-white font-bold rounded-xl shadow-lg shadow-orange-500/30 transition-all transform hover:scale-105"
                                >
                                    Yes, Add It
                                </button>
                            </div>
                          </>
                       )}

                       {memoryModal.step === 'delete_confirm' && (
                          <>
                            <div className="mb-6">
                                <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                    </svg>
                                </div>
                                <h4 className="text-xl font-bold text-center text-gray-800 mb-2">Forget Memory?</h4>
                                <p className="text-gray-600 text-center mb-6">
                                    Are you sure you want to remove this memory? The star will be unchecked.
                                </p>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button 
                                    onClick={closeMemoryModal}
                                    className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={proceedForgetMemory}
                                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 transition-all transform hover:scale-105"
                                >
                                    Yes, Forget It
                                </button>
                            </div>
                          </>
                       )}

                      {memoryModal.step === 'processing' && (
                          <div className="py-8 flex flex-col items-center justify-center text-center">
                              <div className="w-12 h-12 border-4 border-[#FF7B00]/20 border-t-[#FF7B00] rounded-full animate-spin mb-4"></div>
                              <p className="text-[#FF7B00] font-bold">Generating Summary...</p>
                              <p className="text-sm text-gray-400">Please wait while the AI processes your memory.</p>
                          </div>
                      )}

                      {memoryModal.step === 'success' && (
                          <div className="text-center">
                              <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                              </div>
                              <h4 className="text-xl font-bold text-gray-800 mb-2">Memory Added!</h4>
                              <div className="p-4 bg-[#FFF8F0] border border-[#FF7B00]/20 rounded-xl text-left mb-6">
                                  <span className="text-xs font-bold text-[#FF7B00] uppercase tracking-wider mb-1 block">Summary Saved</span>
                                  <p className="text-gray-700 font-medium italic">"{memoryModal.result}"</p>
                              </div>
                              <button 
                                  onClick={closeMemoryModal}
                                  className="w-full px-4 py-3 bg-gray-900 hover:bg-black text-white font-bold rounded-xl transition-colors"
                              >
                                  Close
                              </button>
                          </div>
                      )}

                      {memoryModal.step === 'error' && (
                          <div className="text-center">
                              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                                </svg>
                              </div>
                              <h4 className="text-xl font-bold text-gray-800 mb-2">Error</h4>
                              <p className="text-gray-600 mb-6">{memoryModal.error}</p>
                              <button 
                                  onClick={closeMemoryModal}
                                  className="w-full px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-colors"
                              >
                                  Close
                              </button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
