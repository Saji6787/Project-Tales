"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/auth";
import { getStories, deleteStory, updateStory } from "@/lib/firebase/firestore"; // Import deleteStory, updateStory
import Link from "next/link";
import { useRouter } from "next/navigation";

function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FCF5EF] flex flex-col font-sans text-gray-900">
      {/* Hero Section */}
      <main className="grow flex flex-col items-center justify-center text-center px-6 py-12 md:py-20 max-w-5xl mx-auto">
        <div className="animate-in fade-in slide-in-from-bottom-5 duration-700">
          <span className="inline-block py-1 px-3 rounded-full bg-orange-100 text-[#FF7B00] text-xs font-bold uppercase tracking-wider mb-6">
             AI-Powered Interactive Storytelling
          </span>
          <h1 className="text-5xl md:text-7xl font-black text-[#0A0A0A] mb-6 leading-tight tracking-tight">
            Your Story, <br className="hidden md:block" />
            <span className="text-[#FF7B00]">Your Way.</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Experience infinite interactive adventures powered by AI. 
            You aren&apos;t just reading a story—you&apos;re living it. 
            Shape the narrative with every choice you make.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login" className="bg-[#FF7B00] text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-[#E06C00] transition shadow-xl hover:shadow-2xl hover:-translate-y-1 transform duration-200">
              Start Your Adventure
            </Link>

          </div>
        </div>
      </main>

      {/* Features Grid */}
      <section id="features" className="bg-white py-20 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
           {/* Feature 1 */}
           <div className="p-8 rounded-3xl bg-gray-50 border border-gray-100 hover:border-[#FF7B00]/20 transition-colors">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-[#FF7B00] mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3">Infinite Possibilities</h3>
              <p className="text-gray-600 leading-relaxed">
                No two stories are alike. Explore endless genres from Cyberpunk to High Fantasy, generated instantly just for you.
              </p>
           </div>
           
           {/* Feature 2 */}
           <div className="p-8 rounded-3xl bg-gray-50 border border-gray-100 hover:border-[#FF7B00]/20 transition-colors">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3">Total Freedom</h3>
              <p className="text-gray-600 leading-relaxed">
                Make choices that matter. The AI adapts to *your* decisions in real-time. Do anything, go anywhere.
              </p>
           </div>

           {/* Feature 3 */}
           <div className="p-8 rounded-3xl bg-gray-50 border border-gray-100 hover:border-[#FF7B00]/20 transition-colors">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a16.084 16.084 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3">Custom Style</h3>
              <p className="text-gray-600 leading-relaxed">
                Define the tone—dark, humorous, or epic. Customize your narrative voice to match your preference.
              </p>
           </div>
        </div>
        <div className="text-center mt-20 text-gray-400 text-sm">
          © {new Date().getFullYear()} Project Tales. AI Roleplay Engine. <br />
          Created by <a href="https://github.com/Saji6787" target="_blank" rel="noopener noreferrer" className="hover:text-[#FF7B00] transition">Saji6787</a>
        </div>
      </section>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [stories, setStories] = useState([]);
  const [fetching, setFetching] = useState(true);
  
  // UI State
  const [activeMenuId, setActiveMenuId] = useState(null); // Which card's menu is open?
  const [storyToDelete, setStoryToDelete] = useState(null); // Which story is being deleted?
  const [selectedStory, setSelectedStory] = useState(null); // Story selected for detail modal
  const [isDeleting, setIsDeleting] = useState(false);

  // New Story Modal State
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [characterShake, setCharacterShake] = useState(false);
  const [showNewChatConfirm, setShowNewChatConfirm] = useState(false); // New Chat Confirmation Modal State

  useEffect(() => {
    const loadStories = () => {
        setFetching(true);
        getStories(user.uid).then(data => {
            setStories(data);
            setFetching(false);
        });
    };

    if (user) {
      loadStories();
    } else if (!loading) {
      setFetching(false);
    }
  }, [user, loading]);
  
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

  const handleEditClick = (e, story) => {
    e.stopPropagation();
    // Navigate to edit page based on story type
    // Assuming structure /character/[id]/edit or /story/[id]/edit
    // For now, let's route to a hypothetical edit page. 
    // Since only create pages exist, we might need to use query params on create page or create new routes.
    // Let's assume we'll implement /character/[id]/edit and /story/[id]/edit soon.
    // Or simpler: /character/create?edit={id}
    
    // Let's follow Next.js conventions: /[type]/[id]/edit
    const type = story.type === 'character' ? 'character' : 'story';
    router.push(`/${type}/${story.id}/edit`);
  };

  const toggleMenu = (e, id) => {
      e.stopPropagation();
      e.preventDefault();
      setActiveMenuId(activeMenuId === id ? null : id);
  };

  const handleStoryClick = (story) => {
      setSelectedStory(story);
  };

  const enterChat = () => {
      if (selectedStory) {
          router.push(`/story/${selectedStory.id}`);
      }
  };

  const handleNewChat = () => {
    if (!selectedStory) return;
    setShowNewChatConfirm(true); 
  };

  const confirmNewChat = async () => {
      if (!selectedStory || !user) return;
      setIsDeleting(true); // Re-use isDeleting loading state for this async op
      try {
          // Reset history to empty array
          await updateStory(user.uid, selectedStory.id, { history: [] }); 
          router.push(`/story/${selectedStory.id}`);
          setShowNewChatConfirm(false);
      } catch (err) {
          console.error("Failed to start new chat", err);
          alert("Failed to reset chat");
      } finally {
          setIsDeleting(false);
      }
  };

  if (loading || fetching) return <div className="min-h-screen bg-[#FCF5EF] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF7B00]"></div></div>;
  if (!user) return <LandingPage />;

  return (
    <div className="container mx-auto p-4 md:p-10 pb-32">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-[#0A0A0A]">Your Stories</h1>
        <button 
          onClick={() => setShowStyleModal(true)}
          className="bg-[#FF7B00] text-gray-50 px-4 py-2 md:px-8 md:py-3 text-sm md:text-base rounded-2xl font-bold hover:bg-[#e06c00] transition shadow-lg hover:shadow-xl active:scale-95 transform duration-200"
        >
          + New Story
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {stories.map(story => (
          <div 
             key={story.id} 
             onClick={() => handleStoryClick(story)}
             className="block group cursor-pointer"
          >
            <div className="bg-[#FF7B00] h-52 md:h-64 rounded-2xl md:rounded-[2rem] shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-[#FF7B00] hover:border-[#e06c00] relative overflow-hidden">
              
              {/* Cover Image Background (Left Side with Blur) */}
              {story.coverImage && (
                  <>
                    <div 
                        className="absolute inset-y-0 left-0 w-2/3 bg-cover bg-center z-0"
                        style={{ backgroundImage: `url(${story.coverImage})` }}
                    />
                    <div className="absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-transparent via-[#FF7B00]/60 to-[#FF7B00] z-0" />
                  </>
              )}

              {/* Three Dots Button */}
              <button 
                onClick={(e) => toggleMenu(e, story.id)}
                className="absolute top-4 right-4 md:top-6 md:right-6 p-2 rounded-full hover:bg-black/10 text-white transition-colors z-20"
              >
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 ">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM17.25 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                 </svg>
              </button>

              {/* Dropdown Menu */}
              {activeMenuId === story.id && (
                  <div className="absolute top-12 md:top-16 right-6 bg-white rounded-xl shadow-xl py-2 w-40 z-30 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200 origin-top-right border border-gray-100">
                      <button 
                        onClick={(e) => handleEditClick(e, story)}
                        className="w-full text-left px-4 py-3 text-gray-700 hover:bg-orange-50 font-bold text-sm flex items-center gap-2 transition-colors border-b border-gray-100"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-[#FF7B00]">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                        Edit
                      </button>
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

              <div className="absolute inset-0 p-5 md:p-8 flex flex-col z-10">
                {/* Title */}
                <h2 className={`text-lg md:text-2xl font-bold text-white mb-2 leading-tight pr-8 break-words ${story.coverImage ? 'drop-shadow-md' : ''}`}>
                    {story.title || "(No Title)"}
                </h2>

                {/* Header: Genres & Menu Spacer */}
                <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-wrap gap-2 pr-8">
                      {story.genres && story.genres.map(genre => (
                          <span key={genre} className="text-[10px] font-bold text-white/90 bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-sm">
                              {genre}
                          </span>
                      ))}
                    </div>
                </div>

                {/* Description */}
                <div className="flex-grow overflow-hidden">
                   <p className={`text-white/90 text-xs md:text-sm leading-relaxed line-clamp-3 font-medium ${story.coverImage ? 'drop-shadow-sm' : ''}`}>
                    {story.initialPrompt}
                    </p>
                </div>

                {/* Footer */}
                <div className="mt-auto pt-4 border-t border-white/20 flex gap-2 items-center">
                    <span className="text-xs text-white/70 font-semibold bg-black/20 px-3 py-1 rounded-full backdrop-blur-md">
                        Created: {story.createdAt ? new Date(story.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-[#FF7B00] bg-white px-2 py-1 rounded-full shadow-sm">
                        {story.type === 'character' ? 'Character' : 'Adventure'}
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

       {/* Story Detail Modal */}
       {selectedStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div 
             className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
             onClick={(e) => e.stopPropagation()}
           >
              {/* Modal Header */}
              <div className={`p-6 md:p-8 relative ${selectedStory.coverImage ? 'h-64 md:h-96 flex flex-col justify-end' : 'bg-[#FF7B00] text-white'}`}>
                 
                 {/* Hero Image Background */}
                 {selectedStory.coverImage && (
                    <>
                        <div 
                            className="absolute inset-0 bg-cover bg-center z-0"
                            style={{ backgroundImage: `url(${selectedStory.coverImage})` }}
                        />
                         {/* Gradient Overlay: Solid white at bottom (behind text), fades up */}
                         <div className="absolute inset-0 bg-gradient-to-t from-white via-white/50 to-transparent z-0" />
                         
                         {/* Close Button Background for visibility */}
                         <div className="absolute top-4 right-4 z-20">
                             <button
                                onClick={() => setSelectedStory(null)}
                                className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors backdrop-blur-sm"
                             >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                </svg>
                             </button>
                         </div>
                    </>
                 )}

                 {!selectedStory.coverImage && (
                     <button 
                        onClick={() => setSelectedStory(null)}
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                     </button>
                 )}
                 
                 <div className="relative z-10 flex flex-col justify-end h-full">
                    <h2 className="text-2xl md:text-5xl font-black leading-tight mb-3 text-[#FF7B00] drop-shadow-[0_0_2px_rgba(255,255,255,1)] drop-shadow-[0_0_4px_rgba(255,255,255,1)]">
                        {selectedStory.title || "(No Title)"}
                    </h2>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                        <span className="text-xs font-bold text-[#FF7B00] bg-white px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                            {selectedStory.type === 'character' ? 'Character' : 'Adventure'}
                        </span>
                        {selectedStory.genres && selectedStory.genres.map(genre => (
                            <span key={genre} className="text-xs font-bold text-white bg-[#FF7B00] px-3 py-1 rounded-full uppercase tracking-wider shadow-sm border border-white/20">
                                {genre}
                            </span>
                        ))}
                    </div>

                    <p className="text-gray-600 font-medium text-xs md:text-sm">
                        Created on {selectedStory.createdAt ? new Date(selectedStory.createdAt.seconds * 1000).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Just now'}
                    </p>
                 </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                    {selectedStory.type === 'character' ? 'Character Description' : 'Premise'}
                  </h3>
                  <p className="text-gray-700 leading-relaxed text-sm md:text-base whitespace-pre-wrap">
                      {selectedStory.initialPrompt}
                  </p>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                  <button
                     onClick={() => setSelectedStory(null)}
                     className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                     Close
                  </button>
                  <div className="flex gap-3">
                      <button
                         onClick={handleNewChat} // New Chat Button
                         className="px-6 py-3 rounded-xl font-bold text-[#FF7B00] bg-orange-50 hover:bg-orange-100 transition-colors shadow-sm hover:shadow flex items-center gap-2 border border-[#FF7B00]/20"
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                         </svg>
                         <span>New Chat</span>
                      </button>
                      <button
                         onClick={enterChat}
                         className="px-8 py-3 rounded-xl font-bold text-white bg-[#FF7B00] hover:bg-[#e06c00] transition-colors shadow-lg hover:shadow-xl flex items-center gap-2"
                      >
                         <span>Continue Chat</span>
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                         </svg>
                      </button>
                  </div>
              </div>
           </div>
        </div>
       )}

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

       {/* New Chat Confirmation Modal */}
       {showNewChatConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div 
             className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl scale-100 animate-in zoom-in-95 duration-200"
             onClick={(e) => e.stopPropagation()} 
          >
            <div className="text-center mb-6">
                <div className="w-16 h-16 bg-orange-100 text-[#FF7B00] rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Start New Chat?</h3>
                <p className="text-gray-500">
                    This will <span className="font-bold text-gray-800">delete your current history</span> for this story and start fresh. Are you sure?
                </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNewChatConfirm(false)}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={confirmNewChat}
                className="flex-1 px-4 py-3 bg-[#FF7B00] hover:bg-[#e06c00] text-white font-bold rounded-xl transition-colors flex items-center justify-center"
                disabled={isDeleting}
              >
                 {isDeleting ? "Starting..." : "Start New"}
              </button>
            </div>
          </div>
        </div>
      )}

       {/* Style Selection Modal */}
       {showStyleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div 
             className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 p-8"
             onClick={(e) => e.stopPropagation()}
           >
              <h3 className="text-2xl font-black text-center text-gray-900 mb-8">Choose your style</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                  {/* Adventure Option */}
                  <button
                    onClick={() => router.push('/story/create')}
                    className="flex flex-col items-center p-4 rounded-2xl border-2 border-gray-100 bg-gray-50 hover:border-[#FF7B00] hover:bg-orange-50 transition-all group text-center h-full cursor-pointer"
                  >
                      <div className="w-16 h-16 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center mb-3 shadow-md group-hover:scale-110 group-hover:bg-[#FF7B00] group-hover:text-white transition-all duration-300">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                        </svg>
                      </div>
                      <span className="font-bold text-gray-900 group-hover:text-[#FF7B00] transition-colors">Adventure</span>
                      <span className="text-xs text-gray-500 mt-1">Create a new story from scratch</span>
                  </button>

                  {/* Character Option */}
                  {/* Character Option */}
                  <button
                    onClick={() => router.push('/character/create')}
                    className="flex flex-col items-center p-4 rounded-2xl border-2 border-gray-100 bg-gray-50 hover:border-[#FF7B00] hover:bg-orange-50 transition-all group text-center h-full cursor-pointer"
                  >
                       <div className="w-16 h-16 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center mb-3 shadow-md group-hover:scale-110 group-hover:bg-[#FF7B00] group-hover:text-white transition-all duration-300">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                         </svg>
                       </div>
                       <span className="font-bold text-gray-900 group-hover:text-[#FF7B00] transition-colors">Character</span>
                       <span className="text-xs text-gray-500 mt-1">Create a unique persona</span>
                  </button>
              </div>

              <div className="flex justify-center">
                  <button
                    onClick={() => setShowStyleModal(false)}
                    className="text-gray-500 font-bold hover:text-gray-800 transition-colors px-6 py-2"
                  >
                    Cancel
                  </button>
              </div>
           </div>
        </div>
       )}
      
      {/* Dashboard Footer */}
      <div className="mt-20 text-center text-xs text-gray-400 border-t border-gray-200 pt-6">
        <div className="max-w-2xl mx-auto space-y-2">
            <p className="font-semibold text-gray-500 uppercase tracking-wider">AI CONTENT DISCLAIMER</p>
            <p>This story is a work of fiction generated by Artificial Intelligence. Names, characters, businesses, places, events, locales, and incidents are either the products of the AI&apos;s imagination or used in a fictitious manner.</p> 
            <p>Any resemblance to actual persons, living or dead, or actual events is purely coincidental. The views and opinions expressed in this story do not necessarily reflect the official policy or position of Project Tales.</p>
        </div>
        <p className="mt-6">Created by <a href="https://github.com/Saji6787" target="_blank" rel="noopener noreferrer" className="hover:text-[#FF7B00] transition font-bold">Saji6787</a></p>
      </div>
    </div>
  );
}
