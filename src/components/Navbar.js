"use client";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { getStory, saveSlot, getSaves, deleteSaveSlot, loadSave, getPersonas, updateStory } from "@/lib/firebase/firestore";

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Story Info State
  const [storyInfo, setStoryInfo] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [activeTab, setActiveTab] = useState("info"); // "info" or "saves"
  
  // Save System State
  const [saves, setSaves] = useState([]);
  const [loadingSaves, setLoadingSaves] = useState(false);
  const [processingSave, setProcessingSave] = useState(null); // processing slot index
  const [saveMessage, setSaveMessage] = useState(""); // Notification message
  
  // Persona Tab State
  const [personas, setPersonas] = useState([]);
  const [activePersonaId, setActivePersonaId] = useState(null);
  
  // Confirmation Modal State
  const [confirmation, setConfirmation] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "neutral", // neutral, danger, warning
    onConfirm: null,
    isLoading: false
  });

  const menuRef = useRef(null);
  
  // Clear message after 3 seconds
  useEffect(() => {
      if (saveMessage) {
          const timer = setTimeout(() => setSaveMessage(""), 3000);
          return () => clearTimeout(timer);
      }
  }, [saveMessage]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch Story Info if on a specific story page
  useEffect(() => {
    const fetchStoryInfo = async () => {
        // Match /story/[id] but NOT /story/create. Allow optional trailing slash.
        const match = pathname ? pathname.match(/^\/story\/([^/]+)\/?$/) : null;
        
        if (match && match[1] !== "create" && user) {
            const storyId = match[1];
            try {
                const story = await getStory(user.uid, storyId);
                setStoryInfo(story);
            } catch (error) {
                console.error("Failed to fetch story info for navbar", error);
                setStoryInfo(null);
            }
        } else {
            setStoryInfo(null);
        }
    };
    
    fetchStoryInfo();
  }, [pathname, user]);

  // Fetch saves when switching to 'saves' tab
  useEffect(() => {
      if (activeTab === "saves" && storyInfo && user) {
          fetchSaves();
      }
  }, [activeTab, storyInfo?.id, user]);

  // Refresh story info when Memory tab is active to get latest memories
  useEffect(() => {
    if (activeTab === "memory" && storyInfo && user) {
        getStory(user.uid, storyInfo.id).then(freshStory => {
             if (freshStory) setStoryInfo(freshStory);
        }).catch(err => console.error("Failed to refresh memories", err));
    }
  }, [activeTab, storyInfo?.id, user]);

  const fetchSaves = async () => {
      console.log("fetchSaves called for story:", storyInfo?.id);
      if (!user || !storyInfo) return;
      setLoadingSaves(true);
      try {
          const slots = await getSaves(user.uid, storyInfo.id);
          console.log("Fetched slots from FireStore:", slots);
          setSaves(slots);
      } catch (err) {
          console.error("Error fetching saves:", err);
      } finally {
          setLoadingSaves(false);
      }
  };

  const handleSaveGame = async (slotIndex) => {
      console.log("Saving game initiated for slot:", slotIndex);
      if (!user || !storyInfo) {
          console.error("Missing user or storyInfo", { user, storyInfo });
          return;
      }
      setProcessingSave(slotIndex);
      try {
          // 1. Fetch LATEST story state from DB to ensure we save what's server-side
          console.log("Fetching fresh story state...");
          const freshStory = await getStory(user.uid, storyInfo.id);
          console.log("Fresh story fetched:", freshStory);
          
          if (!freshStory) throw new Error("Could not fetch latest story state");

          const slotId = `slot_${slotIndex}`;
          console.log("Saving to slot:", slotId);
          await saveSlot(user.uid, storyInfo.id, slotId, freshStory);
          console.log("Save successful!");
          
          await fetchSaves();
          setSaveMessage("Story has been saved!");
      } catch (err) {
          console.error("Save failed:", err);
          setSaveMessage("Failed to save: " + err.message);
      } finally {
          setProcessingSave(null);
      }
  };

  const closeConfirmation = () => {
      setConfirmation(prev => ({ ...prev, isOpen: false, isLoading: false }));
  };

  const executeConfirmation = async () => {
      if (!confirmation.onConfirm) return;
      
      setConfirmation(prev => ({ ...prev, isLoading: true }));
      try {
          await confirmation.onConfirm();
          closeConfirmation();
      } catch (error) {
          console.error("Confirmation action failed:", error);
          alert("Action failed: " + error.message); // Fallback alert for deeper errors
          closeConfirmation();
      }
  };

  const fetchPersonasForModal = async () => {
        if (!user) return;
        try {
            const fetchedPersonas = await getPersonas(user.uid);
            setPersonas(fetchedPersonas);
            
            // Set active persona if story has one, otherwise try to find default
            // Assuming storyInfo might have `activePersonaId` in future updates
            // For now, let's look for default one from the list if story doesn't specify
            if (storyInfo?.activePersonaId) {
                setActivePersonaId(storyInfo.activePersonaId);
            } else {
                 const defaultPersona = fetchedPersonas.find(p => p.isDefault);
                 if (defaultPersona) setActivePersonaId(defaultPersona.id);
            }
        } catch (error) {
            console.error("Failed to fetch personas", error);
        }
  };

  useEffect(() => {
      // If modal is open and tab is persona, fetch
      if (showInfoModal && activeTab === "persona") {
          fetchPersonasForModal();
      }
  }, [showInfoModal, activeTab, storyInfo?.id]); // Re-fetch if story changes or modal opens

  const handleSetPersona = async (personaId) => {
      if (!user || !storyInfo) return;
      try {
          // Optimistic update
          setActivePersonaId(personaId);
          
          // Save to story
          await updateStory(user.uid, storyInfo.id, { activePersonaId: personaId });
          
          // Also update local storyInfo state so it persists in the session
          setStoryInfo(prev => ({ ...prev, activePersonaId: personaId }));
      } catch (error) {
          console.error("Failed to set persona", error);
      }
  };

  const handleLoadGame = (slotData) => {
      if (!user || !storyInfo) return;
      
      setConfirmation({
          isOpen: true,
          title: "Load Game?",
          message: "Any unsaved progress on your current story will be lost.",
          type: "warning",
          onConfirm: async () => {
              await loadSave(user.uid, storyInfo.id, slotData);
              window.location.reload(); 
          }
      });
  };

  const handleDeleteSave = (slotId) => {
      if (!user || !storyInfo) return;

      setConfirmation({
          isOpen: true,
          title: "Delete Save?",
          message: "This action cannot be undone. The save slot will be permanently emptied.",
          type: "danger",
          onConfirm: async () => {
              await deleteSaveSlot(user.uid, storyInfo.id, slotId);
              await fetchSaves();
          }
      });
  };

  const handleLogout = async () => {
    await logout();
    setIsMenuOpen(false);
    router.push("/login"); // Redirect to logout
  };

  const handleDeleteMemory = (idx) => {
    if (!storyInfo || !user) return;
    
    setConfirmation({
        isOpen: true,
        type: 'danger',
        title: 'Forget Memory',
        message: 'Are you sure you want to remove this memory from your story? This action cannot be undone.',
        onConfirm: async () => {
             setConfirmation(prev => ({ ...prev, isLoading: true }));
             try {
                // Determine memory to remove
                const memoryToRemove = storyInfo.memories[idx];
                const updatedMemories = [...(storyInfo.memories || [])];
                updatedMemories.splice(idx, 1);
                
                // Sync with History: Unmark the specific message
                // We need to clone history to modify it
                let updatedHistory = [...(storyInfo.history || [])];
                let historyChanged = false;

                // Find the turn that has this memory reference
                updatedHistory = updatedHistory.map(turn => {
                    if (turn.memoryRef === memoryToRemove) {
                        historyChanged = true;
                        return { ...turn, isMemorized: false, memoryRef: null };
                    }
                    return turn;
                });
                
                // Update Firestore
                const updatePayload = { memories: updatedMemories };
                if (historyChanged) {
                    updatePayload.history = updatedHistory;
                }
                
                await updateStory(user.uid, storyInfo.id, updatePayload);
                
                // Update local state
                setStoryInfo(prev => ({ 
                    ...prev, 
                    memories: updatedMemories,
                    history: historyChanged ? updatedHistory : prev.history
                }));
                
                setSaveMessage("Memory forgotten.");
             } catch (err) {
                 console.error("Failed to delete memory", err);
                 setSaveMessage("Error deleting memory.");
             } finally {
                 setConfirmation({ isOpen: false, isLoading: false, title: "", message: "", onConfirm: null });
             }
        }
    });
  };

  // Helper for UI rendering
  const renderSlots = () => {
    if (loadingSaves) return <div className="text-center py-10 text-gray-400">Loading saves...</div>;
    
    return [1, 2, 3].map(slotIndex => {
        const slotId = `slot_${slotIndex}`;
        const save = saves.find(s => s.id === slotId);
        
        return (
            <div key={slotIndex} className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition hover:border-[#FF7B00]/30 hover:shadow-sm">
                {/* Slot Info */}
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm ${save ? 'bg-[#FF7B00]' : 'bg-gray-300'}`}>
                            {slotIndex}
                        </div>
                        <h4 className={`font-bold ${save ? 'text-gray-800' : 'text-gray-400'}`}>
                            {save ? save.label : "Empty Slot"}
                        </h4>
                    </div>
                    {save && (
                        <p className="text-xs text-gray-500 ml-10">
                            {save.savedAt?.seconds ? new Date(save.savedAt.seconds * 1000).toLocaleString() : 'Just now'}
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {save ? (
                        <>
                            <button 
                                onClick={() => handleLoadGame(save)}
                                disabled={processingSave !== null}
                                className="flex-1 sm:flex-none px-4 py-2 bg-[#FF7B00] text-white text-sm font-bold rounded-lg hover:bg-[#e06c00] transition disabled:opacity-50"
                            >
                                Load
                            </button>
                            
                            <button 
                                onClick={() => handleSaveGame(slotIndex)}
                                disabled={processingSave !== null}
                                className="flex-1 sm:flex-none px-3 py-2 bg-white border border-gray-300 text-gray-600 text-sm font-bold rounded-lg hover:bg-gray-100 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                title="Overwrite"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                                <span className="sm:hidden">Overwrite</span>
                            </button>

                            <button 
                                onClick={() => handleDeleteSave(slotId)}
                                disabled={processingSave !== null}
                                className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition disabled:opacity-50"
                                title="Delete Save"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={() => handleSaveGame(slotIndex)}
                            disabled={processingSave !== null}
                            className="w-full sm:w-auto px-6 py-2 bg-gray-200 text-gray-600 hover:bg-[#FF7B00] hover:text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                            </svg>
                            Save
                        </button>
                    )}
                </div>
            </div>
        );
    });
  };

  const handleNewChat = () => {
      if (!user || !storyInfo) return;
      
      setConfirmation({
          isOpen: true,
          title: "Start New Chat?",
          message: "This will definitively clear your current conversation history. You cannot undo this.",
          type: "danger",
          onConfirm: async () => {
              // Reset history to empty array
              await updateStory(user.uid, storyInfo.id, { history: [] });
              window.location.reload(); 
          }
      });
  };

  if (pathname === "/login") return null;

  return (
    <>
    <nav className="sticky top-0 z-50 bg-[#FCF5EF] text-[#0A0A0A] shadow-sm border-b border-[#0A0A0A]/5">
      <div className="container mx-auto p-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-extrabold tracking-wider text-[#FF7B00] hover:text-[#d96900] transition">
          Project Tales
        </Link>
        <div className="flex items-center space-x-4">
          
          {/* Info Button (Only shown when storyInfo is available - indicates inside story chat) */}
          {storyInfo && (
              <button 
                onClick={() => {
                    setShowInfoModal(true);
                    setActiveTab("info");
                }}
                className="p-2 text-gray-600 hover:text-[#FF7B00] transition rounded-full hover:bg-orange-50"
                title="Story Info"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
              </button>
          )}

          {user ? (
            <>
              {/* Home Icon Button */}
              <Link href="/" className="p-2 text-gray-600 hover:text-[#FF7B00] transition rounded-full hover:bg-orange-50" title="Dashboard">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.75L12 3l9 6.75V21a1.5 1.5 0 01-1.5 1.5h-4.5V13.5h-6v9H4.5A1.5 1.5 0 013 21V9.75z" />
                </svg>
              </Link>


              {/* Persona Icon Button & Menu - HIDDEN IN CHAT (when storyInfo exists) */}
              {!storyInfo && (
                <>
                  <Link href="/persona" className="p-2 text-gray-600 hover:text-[#FF7B00] transition rounded-full hover:bg-orange-50" title="Persona">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                  </Link>

                  {/* Three Dots Menu */}
                  <div className="relative" ref={menuRef}>
                    <button 
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className="p-2 text-gray-600 hover:text-gray-900 transition rounded-full hover:bg-gray-100 focus:outline-none cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
                      </svg>
                    </button>

                    {/* Dropdown Content */}
                    {isMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 text-sm font-bold flex items-center gap-2 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                          </svg>
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <Link href="/login" className="bg-[#FF7B00] text-white hover:bg-[#E06C00] px-4 py-1.5 rounded-full text-sm transition font-bold shadow-md">
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>

    {/* Info Modal */}
    {showInfoModal && storyInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
             <div 
                className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 relative"
                onClick={(e) => e.stopPropagation()}
             >
                <button 
                    onClick={() => setShowInfoModal(false)}
                    className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors z-10"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-500">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Cover Image & Header */}
                 <div className="flex-shrink-0 mb-4">
                     {storyInfo.coverImage && (
                        <div className="w-full h-32 rounded-xl overflow-hidden mb-4 shadow-md border border-gray-100 relative">
                            <img src={storyInfo.coverImage} alt={storyInfo.title} className="w-full h-full object-cover" />
                             <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-4">
                                <h2 className="text-xl font-extrabold text-white text-shadow-sm truncate">{storyInfo.title}</h2>
                             </div>
                        </div>
                     )}
                     {!storyInfo.coverImage && (
                          <h2 className="text-2xl font-extrabold text-[#FF7B00] mb-4">{storyInfo.title}</h2>
                     )}

                     {/* Tabs */}
                     <div className="flex bg-gray-100 p-1 rounded-xl">
                         <button 
                            onClick={() => setActiveTab("info")}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === "info" ? "bg-white text-[#FF7B00] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                         >
                            Story Info
                         </button>
                         <button 
                            onClick={() => setActiveTab("saves")}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === "saves" ? "bg-white text-[#FF7B00] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                         >
                            Save & Load
                         </button>
                         <button 
                            onClick={() => setActiveTab("persona")}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === "persona" ? "bg-white text-[#FF7B00] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                         >
                            Persona
                         </button>
                         <button 
                            onClick={() => setActiveTab("memory")}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === "memory" ? "bg-white text-[#FF7B00] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                         >
                            Memory
                         </button>
                     </div>
                 </div>

                {/* Tab Content */}
                <div className="overflow-y-auto custom-scrollbar -mr-2 pr-2 flex-1">
                    
                    {/* INFO TAB */}
                    {activeTab === "info" && (
                        <div className="space-y-6">
                            <div className="flex flex-wrap gap-2">
                                {storyInfo.genres?.map(g => (
                                    <span key={g} className="px-3 py-1 bg-orange-100 text-[#FF7B00] rounded-full text-xs font-bold">
                                        {g}
                                    </span>
                                ))}
                            </div>

                            <section>
                                <h3 className="text-sm font-bold uppercase text-gray-400 mb-2 tracking-wider">Premise</h3>
                                <p className="text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100 italic text-sm">
                                    &quot;{storyInfo.initialPrompt}&quot;
                                </p>
                            </section>

                            {storyInfo.assets && (
                                <>
                                    {storyInfo.assets.locations?.length > 0 && (
                                        <section>
                                            <h3 className="text-sm font-bold uppercase text-gray-400 mb-2 tracking-wider flex items-center gap-2">
                                                Locations
                                            </h3>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                {storyInfo.assets.locations.map((loc, idx) => (
                                                    <div key={idx} className="bg-white border border-gray-200 p-3 rounded-lg shadow-sm">
                                                        <div className="font-bold text-gray-800 text-sm mb-1">{loc.name}</div>
                                                        <div className="text-xs text-gray-500 line-clamp-3">{loc.description}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    {storyInfo.assets.characters?.length > 0 && (
                                        <section>
                                            <h3 className="text-sm font-bold uppercase text-gray-400 mb-2 tracking-wider flex items-center gap-2">
                                                Characters
                                            </h3>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                {storyInfo.assets.characters.map((char, idx) => (
                                                    <div key={idx} className="bg-white border border-gray-200 p-3 rounded-lg shadow-sm">
                                                        <div className="font-bold text-gray-800 text-sm mb-1">{char.name}</div>
                                                        <div className="text-xs text-gray-500 line-clamp-3">{char.description}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                    
                                    {storyInfo.assets.customs?.length > 0 && (
                                     <section>
                                         <h3 className="text-sm font-bold uppercase text-gray-400 mb-2 tracking-wider flex items-center gap-2">
                                             Customs / Items
                                         </h3>
                                         <div className="grid gap-3 sm:grid-cols-2">
                                             {storyInfo.assets.customs.map((item, idx) => (
                                                 <div key={idx} className="bg-white border border-gray-200 p-3 rounded-lg shadow-sm">
                                                     <div className="font-bold text-gray-800 text-sm mb-1">{item.name}</div>
                                                     <div className="text-xs text-gray-500 line-clamp-3">{item.description}</div>
                                                 </div>
                                             ))}
                                         </div>
                                     </section>
                                    )}
                                </>
                            )}
                            
                            {/* New Chat Button at the visual bottom right of the scrollable content or fixed footer? 
                                User asked for "in the bottom right of the modal".
                                Since this is scrollable content, maybe below all content?
                            */}
                            <div className="flex justify-end pt-4 mt-6 border-t border-gray-100">
                                <button 
                                    onClick={handleNewChat}
                                    className="px-5 py-2.5 bg-gray-100 text-gray-600 font-bold rounded-lg hover:bg-[#FF7B00] hover:text-white transition flex items-center gap-2 text-sm"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                    </svg>
                                    New Chat
                                </button>
                            </div>
                        </div>
                    )}

                    {/* SAVES TAB */}
                    {activeTab === "saves" && (
                        <div className="space-y-4 pt-2 relative">
                            {/* Notification Toast */}
                            {saveMessage && (
                                <div className="p-3 bg-green-100 text-green-700 text-center font-bold rounded-xl border border-green-200 animate-in fade-in slide-in-from-top-2 mb-2">
                                    {saveMessage}
                                </div>
                            )}

                            {renderSlots()}
                            
                             <p className="text-xs text-center text-gray-400 mt-4">
                                Saving overwrites the selected slot. Loading replaces your current progress.
                            </p>
                        </div>
                    )}

                    {/* PERSONA TAB */}
                    {activeTab === "persona" && (
                         <div className="space-y-4 pt-2">
                            {personas.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">
                                    <p className="mb-2">No personas found.</p>
                                    <Link href="/persona" onClick={() => setShowInfoModal(false)} className="text-[#FF7B00] hover:underline font-bold text-sm">
                                        Create one here
                                    </Link>
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {personas.map(persona => (
                                        <div 
                                            key={persona.id}
                                            onClick={() => handleSetPersona(persona.id)}
                                            className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                                                activePersonaId === persona.id 
                                                ? "bg-orange-50 border-[#FF7B00] shadow-sm ring-1 ring-[#FF7B00]" 
                                                : "bg-white border-gray-200 hover:border-[#FF7B00]/50 hover:bg-gray-50"
                                            }`}
                                        >
                                            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 shrink-0 border border-gray-100">
                                                {persona.photoUrl ? (
                                                    <img src={persona.photoUrl} alt={persona.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <h3 className={`text-sm font-bold truncate ${activePersonaId === persona.id ? "text-[#FF7B00]" : "text-gray-900"}`}>
                                                        {persona.name}
                                                    </h3>
                                                    {activePersonaId === persona.id && (
                                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-[#FF7B00] text-white px-2 py-0.5 rounded-full">
                                                            Active
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 line-clamp-1">
                                                    {persona.description}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                         </div>
                    )}

                    {/* MEMORY TAB */}
                    {activeTab === "memory" && (
                        <div className="space-y-4 pt-2">
                            {(!storyInfo.memories || storyInfo.memories.length === 0) ? (
                                <div className="text-center py-10 text-gray-400">
                                    <p className="mb-2 italic">"I don't remember anything specific yet..."</p>
                                    <p className="text-xs">The AI will automatically add memories here as you chat.</p>
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {storyInfo.memories.map((mem, idx) => (
                                        <div key={idx} className="bg-orange-50/50 border border-orange-100 p-3 rounded-xl flex gap-3 group relative">
                                           <div className={`flex-shrink-0 mt-0.5 ${idx === 0 ? '' : ''} /* just dummy placeholder to keep linter happy about shrink-0 ID */`}>
                                               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#FF7B00]">
                                                 <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625Z" />
                                                 <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
                                               </svg>
                                           </div>
                                           <div className="flex-1 text-sm text-gray-700 leading-relaxed">
                                               {mem}
                                           </div>
                                           <button 
                                               onClick={() => handleDeleteMemory(idx)}
                                               className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all bg-white rounded-full shadow-sm"
                                               title="Forget this memory"
                                           >
                                               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                 <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                               </svg>
                                           </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                </div>
             </div>
        </div>
    )}

    {/* CONFIRMATION MODAL */}
    {confirmation.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
                <div className="text-center mb-6">
                    <h3 className={`text-lg font-extrabold mb-2 ${confirmation.type === "danger" ? "text-red-600" : "text-[#FF7B00]"}`}>
                        {confirmation.title}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        {confirmation.message}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={closeConfirmation}
                        className="flex-1 py-2.5 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition"
                        disabled={confirmation.isLoading}
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={executeConfirmation}
                        className={`flex-1 py-2.5 font-bold rounded-xl text-white transition shadow-sm ${
                            confirmation.type === "danger" 
                            ? "bg-red-500 hover:bg-red-600 shadow-red-200" 
                            : "bg-[#FF7B00] hover:bg-[#e06c00] shadow-orange-200"
                        }`}
                        disabled={confirmation.isLoading}
                    >
                        {confirmation.isLoading ? "Processing..." : "Confirm"}
                    </button>
                </div>
            </div>
        </div>
    )}
    </>
  );
}
