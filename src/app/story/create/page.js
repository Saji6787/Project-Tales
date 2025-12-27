"use client";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth";
import { createStory, updateStoryHistory } from "@/lib/firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CreateStoryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [storyStyle, setStoryStyle] = useState(""); // Story Style state
  const [genres, setGenres] = useState([]); // Array of selected genres
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPremise, setIsGeneratingPremise] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isGenreModalOpen, setIsGenreModalOpen] = useState(false); // Mobile genre modal state
  const textareaRef = useRef(null); // Ref for auto-expanding textarea
  
  // Auto-resize textarea when prompt changes
  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'; // Reset height
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'; // Set to scrollHeight
    }
  }, [prompt]);
  
  // Assets State (Locations, Characters, Customs)
  const [isAssetsOpen, setIsAssetsOpen] = useState(false);
  const [locations, setLocations] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [customs, setCustoms] = useState([]);

  const GENRE_LIST = [
    "Fantasy", "Sci-Fi", "Horror", "Mystery", "Romance", "Adventure", 
    "Historical", "Slice of Life", "Isekai", "Psychological", "Alternate History", 
    "Superhero", "Cyberpunk", "Medieval", "Space", "Post-Apocalyptic", 
    "School", "Comedy", "Time Travel", "Military", "Grimdark", "Mecha", 
    "Villain Protagonist", "Criminal", "Regional Folklore", "Dungeon", 
    "Biopunk", "Steampunk", "Renaissance", "Political", "Anti-hero", 
    "Samurai", "Corporate", "Mafia", "Monster", "Supernatural", "Drama"
  ].sort();

  const toggleGenre = (genre) => {
    setGenres(prev => 
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  // Helper to manage asset lists
  const addAsset = (setter, list) => {
    if (list.length < 5) {
      setter([...list, { name: "", description: "" }]);
    }
  };

  const removeAsset = (setter, list, index) => {
    setter(list.filter((_, i) => i !== index));
  };

  const updateAsset = (setter, list, index, field, value) => {
    const newList = [...list];
    newList[index][field] = value;
    setter(newList);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (genres.length === 0) {
        alert("Please select at least one genre.");
        return;
    }
    setIsGenerating(true);

    try {
      // 1. Create document
      const storyId = await createStory(user.uid, title, prompt, genres, storyStyle);

      // 2. Generate Intro
      const token = await user.getIdToken();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
             token, 
             initialPrompt: prompt,
             genres,
             style: storyStyle, // Pass style to generate API
             locations,
             characters,
             customs,
             history: [] 
        }),
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      // 3. Save Intro to history
      await updateStoryHistory(user.uid, storyId, {
          role: "ai",
          content: data.story,
          choices: data.choices || []
      });

      router.push(`/story/${storyId}`);

    } catch (err) {
      console.error(err);
      alert("Failed to create story: " + err.message);
      setIsGenerating(false);
    }
  };

  const handleGeneratePremise = async () => {
    if (!title) {
        alert("Please enter a Story Title first.");
        return;
    }
    if (genres.length === 0) {
        alert("Please select at least one genre.");
        return;
    }
    if (!user) return;

    setIsGeneratingPremise(true);
    try {
        const token = await user.getIdToken();
        const res = await fetch("/api/generate-premise", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, genres, token }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        setPrompt(data.premise);
    } catch (err) {
        console.error("Premise gen error", err);
        alert("Failed to generate premise: " + err.message);
    } finally {
        setIsGeneratingPremise(false);
    }
  };

  const handleEnhancePremise = async () => {
    if (!prompt.trim()) return;
    if (!user) return;
    
    setIsEnhancing(true);
    try {
        const token = await user.getIdToken();
        const res = await fetch("/api/enhance-premise", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: prompt, genres, title, token }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        setPrompt(data.enhancedText);
    } catch (err) {
        console.error("Enhance error", err);
        alert("Failed to enhance premise: " + err.message);
    } finally {
        setIsEnhancing(false);
    }
  };

  // Render helper for asset section
  const renderAssetSection = (title, list, setter) => (
    <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100">
        <h3 className="font-bold text-gray-700 mb-3 ml-1">{title}</h3>
        <div className="space-y-3">
            {list.map((item, index) => (
                <div key={index} className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex justify-end mb-2">
                        <button 
                            type="button"
                            onClick={() => removeAsset(setter, list, index)}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-50"
                            title="Remove Asset"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                            </svg>
                        </button>
                    </div>
                    <div className="space-y-3">
                        <input
                            type="text"
                            placeholder="Name"
                            value={item.name}
                            onChange={(e) => updateAsset(setter, list, index, 'name', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-bold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF7B00]/10 focus:border-[#FF7B00]/50"
                        />
                        <textarea
                            placeholder="Description"
                            value={item.description}
                            onChange={(e) => updateAsset(setter, list, index, 'description', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF7B00]/10 focus:border-[#FF7B00]/50 resize-none h-16"
                        />
                    </div>
                </div>
            ))}
        </div>
        
        {list.length < 5 && (
            <button
                type="button"
                onClick={() => addAsset(setter, list)}
                className="w-full mt-3 py-2 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-bold text-sm hover:border-[#FF7B00]/50 hover:text-[#FF7B00] hover:bg-[#FF7B00]/5 transition-all flex items-center justify-center gap-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </svg>
                Add More
            </button>
        )}
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-4">
      <div className="w-full max-w-7xl bg-white p-5 md:p-10 rounded-2xl md:rounded-3xl shadow-2xl border border-gray-100/50">
         <Link href="/" className="inline-flex items-center text-gray-400 hover:text-[#FF7B00] mb-6 transition group">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            <span className="font-bold text-sm">Back to Dashboard</span>
         </Link>

         <div className="mb-6 md:mb-8">
            <h1 className="text-xl md:text-4xl font-extrabold text-[#0A0A0A] tracking-tight mb-2">Create New Story</h1>
            <p className="text-gray-400 font-medium">Define the world you want to explore and let the AI build the rest.</p>
         </div>

         <form onSubmit={handleCreate} className="space-y-6">
           <div>
             <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Story Title</label>
             <input 
               type="text" 
               onChange={e => setTitle(e.target.value)}
               className="w-full p-3 md:p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF7B00]/20 focus:border-[#FF7B00] outline-none transition-all bg-gray-50 focus:bg-white text-sm font-medium text-gray-800 placeholder-gray-400"
               required
               placeholder="e.g. The Lost Kingdom"
             />
           </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Genres (Select at least one)</label>
              
              {/* Desktop View: Full List */}
              <div className="hidden md:flex flex-wrap gap-2">
                {GENRE_LIST.map(genre => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(genre)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                      genres.includes(genre) 
                        ? "bg-[#FF7B00] text-white shadow-md transform scale-105" 
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>

               {/* Mobile View: Select Button & Selected Tags */}
               <div className="md:hidden">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {genres.map(genre => (
                        <span key={genre} className="bg-[#FF7B00] text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                            {genre}
                            <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleGenre(genre); }}
                                className="ml-1 hover:text-white/80"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                </svg>
                            </button>
                        </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsGenreModalOpen(true)}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold text-sm hover:border-[#FF7B00] hover:text-[#FF7B00] transition-colors flex items-center justify-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Select Genres
                  </button>
               </div>
            </div>

             <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-500">Initial Prompt / Premise</label>
                <button
                    type="button"
                    onClick={handleGeneratePremise}
                    disabled={!title || isGeneratingPremise}
                    className="text-xs font-bold text-[#FF7B00] bg-[#FF7B00]/10 px-3 py-1 rounded-full hover:bg-[#FF7B00]/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                    {isGeneratingPremise ? (
                        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM6.75 9.25a.75.75 0 000 1.5h4.59l-2.1 1.95a.75.75 0 001.02 1.1l3.5-3.25a.75.75 0 000-1.1l-3.5-3.25a.75.75 0 10-1.02 1.1l2.1 1.95H6.75z" clipRule="evenodd" />
                        </svg>
                    )}
                    Auto-Generate
                </button>
              </div>

              
              <div className="relative">
                <textarea 
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  style={{ minHeight: '160px' }}
                  className="w-full p-3 md:p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF7B00]/20 focus:border-[#FF7B00] outline-none transition-all bg-gray-50 focus:bg-white text-sm font-medium text-gray-800 placeholder-gray-400 resize-none overflow-hidden pb-12"
                  required
                  placeholder="e.g. You are a knight seeking the holy grail in a cyberpunk world..."
                />
                
                {prompt.trim() && (
                    <button
                        type="button"
                        onClick={handleEnhancePremise}
                        disabled={isEnhancing}
                        className="absolute bottom-4 right-4 text-xs font-bold text-white bg-[#FF7B00] px-3 py-1.5 rounded-lg hover:bg-[#e06c00] transition disabled:opacity-50 flex items-center gap-1 shadow-sm"
                    >
                        {isEnhancing ? (
                           <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                           </svg>
                        ) : (
                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                             <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM6.75 9.25a.75.75 0 000 1.5h4.59l-2.1 1.95a.75.75 0 001.02 1.1l3.5-3.25a.75.75 0 000-1.1l-3.5-3.25a.75.75 0 10-1.02 1.1l2.1 1.95H6.75z" clipRule="evenodd" />
                           </svg>
                        )}
                        Enhance
                    </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Story Style (Optional)</label>
              <textarea 
                value={storyStyle}
                onChange={(e) => setStoryStyle(e.target.value)}
                className="w-full p-3 md:p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF7B00]/20 focus:border-[#FF7B00] outline-none transition-all bg-gray-50 focus:bg-white text-sm font-medium text-gray-800 placeholder-gray-400 resize-none h-20"
                placeholder="e.g. Dark and gritty, Humorous, First-person perspective, Minimalist..."
              />
            </div>
            
            {/* Assets (Formerly Advance Settings) */}
            <div className="border border-orange-100 rounded-2xl overflow-hidden bg-orange-50/30">
                <button
                    type="button"
                    onClick={() => setIsAssetsOpen(!isAssetsOpen)}
                    className="w-full flex justify-between items-center p-4 bg-[#FF7B00]/10 text-[#FF7B00] font-bold text-sm hover:bg-[#FF7B00]/20 transition-colors"
                >
                    <span>Assets (Optional)</span>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className={`w-5 h-5 transition-transform duration-200 ${isAssetsOpen ? 'rotate-180' : ''}`}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                </button>

                <div
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${
                        isAssetsOpen ? 'max-h-[1500px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
                >
                    <div className="p-4 space-y-6">
                       {renderAssetSection("Locations", locations, setLocations)}
                       {renderAssetSection("Characters", characters, setCharacters)}
                       {renderAssetSection("Customs", customs, setCustoms)}
                    </div>
                </div>
            </div>

           <button 
             type="submit" 
             disabled={isGenerating}
             className="w-full bg-[#FF7B00] text-gray-50 py-3 md:py-4 rounded-xl font-bold text-lg hover:bg-[#e06c00] transition shadow-lg hover:shadow-xl active:scale-[0.98] transform duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
           >
             {isGenerating ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Generating World...</span>
                </>
             ) : "Start Adventure"}
           </button>
         </form>
      </div>

      {/* Mobile Genre Selection Modal */}
      {isGenreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
             <div 
                className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
             >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-[#0A0A0A]">Select Genres</h3>
                    <button 
                        onClick={() => setIsGenreModalOpen(false)}
                        className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2">
                    <div className="flex flex-wrap gap-2 pb-4">
                         {GENRE_LIST.map(genre => (
                              <button
                                key={genre}
                                type="button"
                                onClick={() => toggleGenre(genre)}
                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all grow text-center ${
                                  genres.includes(genre) 
                                    ? "bg-[#FF7B00] text-white shadow-md ring-2 ring-[#FF7B00]/20" 
                                    : "bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100"
                                }`}
                              >
                                {genre}
                              </button>
                         ))}
                    </div>
                </div>

                <div className="pt-4 border-t border-gray-100 mt-2">
                    <button
                        onClick={() => setIsGenreModalOpen(false)}
                        className="w-full bg-[#0A0A0A] text-white py-3 rounded-xl font-bold text-lg shadow-lg active:scale-[0.98] transition-transform"
                    >
                        Done ({genres.length} selected)
                    </button>
                </div>
             </div>
        </div>
      )}
    </div>
  );
}
