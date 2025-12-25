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
      const playerTurn = { role: "player", content: `Saya memilih: ${choice}` };
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
    <div className="max-w-3xl mx-auto pb-32">
      <div className="border-b pb-4 mb-4">
        <h1 className="text-2xl font-bold">{story.title}</h1>
        <p className="text-sm text-gray-500">{story.initialPrompt}</p>
      </div>

      <div className="space-y-6">
        {story.history.map((turn, index) => (
          <div key={index} className={`flex ${turn.role === 'player' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-lg shadow-sm ${
              turn.role === 'player' 
                ? 'bg-purple-100 text-purple-900 border border-purple-200' 
                : 'bg-white border border-gray-100'
            }`}>
              <div className="prose prose-sm max-w-none prose-purple">
                <ReactMarkdown>{turn.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {processing && (
           <div className="flex justify-start">
             <div className="bg-gray-100 p-4 rounded-lg animate-pulse text-gray-500 text-sm">
               AI is writing...
             </div>
           </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg z-10">
        <div className="max-w-3xl mx-auto">
          {!processing && activeChoices && activeChoices.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-500 font-semibold mb-1">What will you do?</p>
              <div className="grid grid-cols-1 gap-2">
              {activeChoices.map((choice, idx) => (
                <button
                  key={idx}
                  onClick={() => handleChoice(choice)}
                  className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded text-left transition transform active:scale-99 shadow-sm"
                >
                  <span className="font-bold mr-2">{idx + 1}.</span> {choice}
                </button>
              ))}
              </div>
            </div>
          ) : (
             !processing && (!activeChoices || activeChoices.length === 0) && (
               <p className="text-center text-gray-500">End of story reached (or waiting for next turn).</p>
             )
          )}
          {processing && <p className="text-center text-gray-500 italic">Thinking...</p>}
        </div>
      </div>
    </div>
  );
}
