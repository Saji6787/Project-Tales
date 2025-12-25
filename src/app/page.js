"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/auth";
import { getStories } from "@/lib/firebase/firestore";
import Link from "next/link";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [stories, setStories] = useState([]);

  useEffect(() => {
    if (user) {
      getStories(user.uid).then(setStories);
    }
  }, [user]);

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to Project Tales</h1>
        <p className="mb-8 text-lg text-gray-600">Create and play immersive AI-generated interactive stories.</p>
        <Link href="/login" className="bg-black text-[#FF7B00] px-8 py-3 rounded-full font-bold hover:bg-gray-900 transition shadow-lg">
          Get Started
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-extrabold tracking-tight">Your Stories</h1>
        <Link href="/story/create" className="bg-[#FF7B00] text-gray-50 px-6 py-2 rounded-full font-bold hover:bg-[#e06c00] transition shadow-md cursor-pointer">
          + New Story
        </Link>
      </div>

      {stories.length === 0 ? (
        <p className="text-gray-500">No stories yet. Create one to begin!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stories.map(story => (
            <Link key={story.id} href={`/story/${story.id}`}>
              <div className="bg-[#FF7B00] p-6 rounded-xl shadow-lg hover:shadow-xl transition transform hover:-translate-y-1 cursor-pointer h-full border border-orange-600/20">
                <h2 className="text-2xl font-bold mb-3 text-white">{story.title}</h2>
                <p className="text-sm text-white/90 line-clamp-3 leading-relaxed">{story.initialPrompt}</p>
                <div className="mt-6 text-xs text-white/80 font-medium">
                   Created: {story.createdAt?.toDate ? story.createdAt.toDate().toLocaleDateString() : 'Just now'}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
