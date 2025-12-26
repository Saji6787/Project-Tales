"use client";
import { useState } from "react";
import { useAuth } from "@/lib/firebase/auth";
import { createStory, updateStoryHistory } from "@/lib/firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CreateStoryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [genres, setGenres] = useState([]); // Array of selected genres
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPremise, setIsGeneratingPremise] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const GENRE_LIST = [
    "Fantasy", "Sci-Fi", "Horror", "Mystery", "Romance", "Adventure", 
    "Historical", "Slice of Life", "Isekai", "Psychological", "Alternate History", 
    "Superhero", "Cyberpunk", "Medieval", "Space", "Post-Apocalyptic", 
    "School", "Comedy", "Time Travel", "Military", "Grimdark", "Mecha", 
    "Villain Protagonist"
  ];

  const toggleGenre = (genre) => {
    setGenres(prev => 
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
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
      const storyId = await createStory(user.uid, title, prompt, genres);

      // 2. Generate Intro
      const token = await user.getIdToken();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
             token, 
             initialPrompt: prompt,
             genres,
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
            body: JSON.stringify({ text: prompt, genres, token }),
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

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-4">
      <div className="w-full max-w-7xl bg-white p-8 md:p-10 rounded-3xl shadow-2xl border border-gray-100/50">
         <Link href="/" className="inline-flex items-center text-gray-400 hover:text-[#FF7B00] mb-6 transition group">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            <span className="font-bold text-sm">Back to Dashboard</span>
         </Link>

         <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#0A0A0A] tracking-tight mb-2">Create New Story</h1>
            <p className="text-gray-400 font-medium">Define the world you want to explore and let the AI build the rest.</p>
         </div>

         <form onSubmit={handleCreate} className="space-y-6">
           <div>
             <label className="block text-sm font-bold text-[#0A0A0A] mb-2">Story Title</label>
             <input 
               type="text" 
               value={title}
               onChange={e => setTitle(e.target.value)}
               className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF7B00]/20 focus:border-[#FF7B00] outline-none transition-all bg-gray-50 focus:bg-white text-gray-800 placeholder-gray-400 font-medium"
               required
               placeholder="e.g. The Lost Kingdom"
             />
           </div>

            <div>
              <label className="block text-sm font-bold text-[#0A0A0A] mb-2">Genres (Select at least one)</label>
              <div className="flex flex-wrap gap-2">
                {GENRE_LIST.map(genre => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(genre)}
                    className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
                      genres.includes(genre) 
                        ? "bg-[#FF7B00] text-white shadow-md transform scale-105" 
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>

             <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-bold text-[#0A0A0A]">Initial Prompt / Premise</label>
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
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  style={{ minHeight: '160px' }}
                  className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF7B00]/20 focus:border-[#FF7B00] outline-none transition-all bg-gray-50 focus:bg-white text-gray-800 placeholder-gray-400 font-medium resize-none overflow-hidden pb-12"
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
           <button 
             type="submit" 
             disabled={isGenerating}
             className="w-full bg-[#FF7B00] text-gray-50 py-4 rounded-xl font-bold text-lg hover:bg-[#e06c00] transition shadow-lg hover:shadow-xl active:scale-[0.98] transform duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
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
    </div>
  );
}
