"use client";
import { useState } from "react";
import { useAuth } from "@/lib/firebase/auth";
import { createStory, updateStoryHistory } from "@/lib/firebase/firestore";
import { useRouter } from "next/navigation";

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
    <div className="max-w-2xl mx-auto mt-10">
      <h1 className="text-3xl font-bold mb-6">Create New Story</h1>
      <form onSubmit={handleCreate} className="space-y-6">
        <div>
          <label className="block font-medium">Story Title</label>
          <input 
            type="text" 
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full p-2 border rounded mt-1"
            required
            placeholder="e.g. The Lost Kingdom"
          />
        </div>
        <div>
          <label className="block font-medium">Initial Prompt / Premise</label>
          <textarea 
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            className="w-full p-2 border rounded mt-1 h-32"
            required
            placeholder="e.g. You are a knight seeking the holy grail in a cyberpunk world..."
          />
        </div>
        <button 
          type="submit" 
          disabled={isGenerating}
          className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
        >
          {isGenerating ? "Generating World..." : "Start Adventure"}
        </button>
      </form>
    </div>
  );
}
