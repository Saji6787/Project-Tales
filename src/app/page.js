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
        <Link href="/login" className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition">
          Get Started
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Your Stories</h1>
        <Link href="/story/create" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition">
          + New Story
        </Link>
      </div>

      {stories.length === 0 ? (
        <p className="text-gray-500">No stories yet. Create one to begin!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stories.map(story => (
            <Link key={story.id} href={`/story/${story.id}`}>
              <div className="border p-4 rounded-lg shadow hover:shadow-md transition bg-white cursor-pointer h-full">
                <h2 className="text-xl font-bold mb-2">{story.title}</h2>
                <p className="text-sm text-gray-500 line-clamp-3">{story.initialPrompt}</p>
                <div className="mt-4 text-xs text-gray-400">
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
