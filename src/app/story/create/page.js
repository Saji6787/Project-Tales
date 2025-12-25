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
  const [isGenerating, setIsGenerating] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsGenerating(true);

    try {
      // 1. Create document
      const storyId = await createStory(user.uid, title, prompt);

      // 2. Generate Intro
      const token = await user.getIdToken();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
             token, 
             initialPrompt: prompt,
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

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white p-8 md:p-10 rounded-3xl shadow-2xl border border-gray-100/50">
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
             <label className="block text-sm font-bold text-[#0A0A0A] mb-2">Initial Prompt / Premise</label>
             <textarea 
               value={prompt}
               onChange={e => setPrompt(e.target.value)}
               className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF7B00]/20 focus:border-[#FF7B00] outline-none transition-all bg-gray-50 focus:bg-white text-gray-800 placeholder-gray-400 font-medium h-40 resize-none"
               required
               placeholder="e.g. You are a knight seeking the holy grail in a cyberpunk world..."
             />
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
