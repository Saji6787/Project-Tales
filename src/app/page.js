"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/auth";
import { getStories, deleteStory } from "@/lib/firebase/firestore"; // Import deleteStory
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [stories, setStories] = useState([]);
  const [fetching, setFetching] = useState(true);
  
  // UI State
  const [activeMenuId, setActiveMenuId] = useState(null); // Which card's menu is open?
  const [storyToDelete, setStoryToDelete] = useState(null); // Which story is being deleted?
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      loadStories();
    } else if (!loading) {
      setFetching(false);
    }
  }, [user, loading]);

  const loadStories = () => {
    setFetching(true);
    getStories(user.uid).then(data => {
      setStories(data);
      setFetching(false);
    });
  };
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleDeleteClick = (e, story) => {
    e.stopPropagation(); // Prevent card navigation
    setStoryToDelete(story);
    setActiveMenuId(null);
  };

  const confirmDelete = async () => {
    if (!storyToDelete || !user) return;
    setIsDeleting(true);
    try {
        await deleteStory(user.uid, storyToDelete.id);
        setStories(prev => prev.filter(s => s.id !== storyToDelete.id)); // Optimistic UI update
        setStoryToDelete(null); 
    } catch (error) {
        alert("Failed to delete story: " + error.message);
    } finally {
        setIsDeleting(false);
    }
  };

  const toggleMenu = (e, id) => {
      e.stopPropagation();
      e.preventDefault();
      setActiveMenuId(activeMenuId === id ? null : id);
  };

  if (loading || fetching) return <div className="p-10 text-center">Loading...</div>;
  if (!user) return <div className="p-10 text-center">Please log in.</div>;

  return (
    <div className="container mx-auto p-4 md:p-10 pb-32">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-[#0A0A0A]">Your Stories</h1>
        <Link href="/story/create" className="bg-[#FF7B00] text-gray-50 px-4 py-2 md:px-8 md:py-3 text-sm md:text-base rounded-2xl font-bold hover:bg-[#e06c00] transition shadow-lg hover:shadow-xl active:scale-95 transform duration-200">
          + New Story
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {stories.map(story => (
          <div 
             key={story.id} 
             onClick={() => router.push(`/story/${story.id}`)}
             className="block group cursor-pointer"
          >
            <div className="bg-[#FF7B00] h-52 md:h-64 p-5 md:p-8 rounded-2xl md:rounded-[2rem] shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-[#FF7B00] hover:border-[#e06c00] relative">
              
              {/* Three Dots Button */}
              <button 
                onClick={(e) => toggleMenu(e, story.id)}
                className="absolute top-4 right-4 md:top-6 md:right-6 p-2 rounded-full hover:bg-black/10 text-white transition-colors z-10"
              >
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM17.25 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                 </svg>
              </button>

              {/* Dropdown Menu */}
              {activeMenuId === story.id && (
                  <div className="absolute top-12 md:top-16 right-6 bg-white rounded-xl shadow-xl py-2 w-40 z-20 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200 origin-top-right border border-gray-100">
                      <button 
                        onClick={(e) => handleDeleteClick(e, story)}
                        className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 font-bold text-sm flex items-center gap-2 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                        Delete Story
                      </button>
                  </div>
              )}

              <div className="h-full flex flex-col pt-2">
                {/* Header: Genres & Menu Spacer */}
                <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-wrap gap-2 pr-8">
                      {story.genres && story.genres.map(genre => (
                          <span key={genre} className="text-[10px] font-bold text-white/90 bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              {genre}
                          </span>
                      ))}
                    </div>
                </div>

                {/* Title */}
                <h2 className="text-lg md:text-2xl font-bold text-white mb-2 leading-tight pr-8 break-words">
                    {story.title || "(No Title)"}
                </h2>

                {/* Description */}
                <div className="flex-grow overflow-hidden">
                   <p className="text-white/90 text-xs md:text-sm leading-relaxed line-clamp-3 font-medium">
                    {story.initialPrompt}
                    </p>
                </div>

                {/* Footer */}
                <div className="mt-auto pt-4 border-t border-white/20">
                    <span className="text-xs text-white/70 font-semibold bg-black/20 px-3 py-1 rounded-full">
                        Created: {story.createdAt ? new Date(story.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                    </span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {stories.length === 0 && !fetching && (
            <div className="col-span-full py-20 text-center">
                <div className="inline-block p-6 rounded-full bg-gray-100 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-gray-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                    </svg>
                </div>
                <p className="text-gray-500 font-medium">No stories found. Start your first adventure!</p>
            </div>
        )}
      </div>

       {/* Delete Confirmation Modal */}
       {storyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div 
             className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl scale-100 animate-in zoom-in-95 duration-200"
             onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
          >
            <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                         <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Delete Story?</h3>
                <p className="text-gray-500">
                    Are you sure you want to delete <span className="font-bold text-gray-800">&quot;{storyToDelete.title}&quot;</span>? This action cannot be undone.
                </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStoryToDelete(null)}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center"
                disabled={isDeleting}
              >
                 {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
