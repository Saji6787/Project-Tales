"use client";
import { useState, useRef, useEffect, use } from "react";
import { useAuth } from "@/lib/firebase/auth";
import { getStory, updateStory } from "@/lib/firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function EditCharacterPage({ params }) {
  // Unwrap params using React.use()
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [firstMessage, setFirstMessage] = useState(""); 
  const [definition, setDefinition] = useState(""); 
  const [genres, setGenres] = useState([]); 
  
  const [coverImage, setCoverImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnhancingDesc, setIsEnhancingDesc] = useState(false);
  const [isEnhancingMsg, setIsEnhancingMsg] = useState(false);
  const [isGenreModalOpen, setIsGenreModalOpen] = useState(false);
  const textareaRef = useRef(null); 

  const GENRE_LIST = [
    "Male", "Female", "Fictional", "Anime", "Magical", "MalePOV", 
    "FemalePOV", "Hero", "Monster", "Historical", "Romance", "Comedy", "Elf", "Maid"
  ].sort();

  // Load existing character data
  useEffect(() => {
    if (!user || !id) return;

    const loadCharacter = async () => {
        setIsLoading(true);
        try {
            const story = await getStory(user.uid, id);
            if (story) {
                setName(story.title || "");
                setDescription(story.initialPrompt || "");
                setGenres(story.genres || []);
                setCoverImage(story.coverImage || null);
                setPreviewUrl(story.coverImage || null);
                setDefinition(story.definition || "");
                
                // Try to find first message from history if available? 
                // Usually we don't edit history here, but if the user wants to change the *intro* message for a fresh start...
                // For now let's just leave first message empty unless we stored it specifically. 
                // Since we don't store "firstMessage" separately field (it goes to history), we might skip pre-filling it 
                // OR we check if history[0] is the intro.
                // Let's keep it simple: We allow editing the 'definition' and metadata. 
                // Editing specific history turns is complex.
            } else {
                alert("Character not found");
                router.push("/");
            }
        } catch (error) {
            console.error("Error loading character", error);
            alert("Failed to load character");
        } finally {
            setIsLoading(false);
        }
    };

    loadCharacter();
  }, [user, id, router]);

  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'; 
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'; 
    }
  }, [description]);

  const toggleGenre = (genre) => {
    setGenres(prev => 
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800; 
                    const scaleSize = MAX_WIDTH / img.width;
                    
                    if (img.width > MAX_WIDTH) {
                        canvas.width = MAX_WIDTH;
                        canvas.height = img.height * scaleSize;
                    } else {
                        canvas.width = img.width;
                        canvas.height = img.height;
                    }

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(dataUrl);
                };
                img.onerror = (error) => reject(error);
            };
            reader.onerror = (error) => reject(error);
        });
    };

  const handleImageChange = async (e) => {
      const file = e.target.files[0];
      if (file) {
          if (file.size > 5 * 1024 * 1024) { 
              alert("Image size should be less than 5MB");
              return;
          }
          
          try {
            const compressedBase64 = await compressImage(file);
            setCoverImage(compressedBase64); 
            setPreviewUrl(compressedBase64);
          } catch (error) {
              console.error("Error compressing image:", error);
              alert("Failed to process image.");
          }
      }
  };

  const handleEnhance = async (type) => {
    const text = type === "character" ? description : firstMessage;
    if (!text.trim()) return;
    if (!user) return;
    
    if (type === "character") setIsEnhancingDesc(true);
    else setIsEnhancingMsg(true);

    try {
        const token = await user.getIdToken();
        const res = await fetch("/api/enhance-premise", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                text, 
                genres, 
                title: name, 
                token,
                type 
            }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        if (type === "character") setDescription(data.enhancedText);
        else setFirstMessage(data.enhancedText);

    } catch (err) {
        console.error("Enhance error", err);
        alert("Failed to enhance text: " + err.message);
    } finally {
        if (type === "character") setIsEnhancingDesc(false);
        else setIsEnhancingMsg(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (genres.length === 0) {
        alert("Please select at least one genre.");
        return;
    }
    setIsSaving(true);

    try {
      await updateStory(user.uid, id, {
          title: name,
          initialPrompt: description,
          genres,
          coverImage,
          definition
          // We generally don't update type or create new history here unless explicit logic added
      });

      router.push("/"); // Back to dashboard

    } catch (err) {
      console.error(err);
      alert("Failed to update character: " + err.message);
      setIsSaving(false);
    }
  };


  if (isLoading) {
      return <div className="min-h-screen flex items-center justify-center text-[#FF7B00]">Loading character data...</div>;
  }

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
            <h1 className="text-xl md:text-4xl font-extrabold text-[#0A0A0A] tracking-tight mb-2">Edit Character</h1>
            <p className="text-gray-400 font-medium">Update your persona settings.</p>
         </div>

         <form onSubmit={handleSave} className="space-y-6">
           <div>
             <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Character Name</label>
             <input 
               type="text" 
               value={name}
               onChange={e => setName(e.target.value)}
               className="w-full p-3 md:p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF7B00]/20 focus:border-[#FF7B00] outline-none transition-all bg-gray-50 focus:bg-white text-sm font-medium text-gray-800 placeholder-gray-400"
               required
               placeholder="e.g. Eldrin the Wise"
             />
           </div>

           {/* Cover Image Upload */}
           <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Cover Image (Optional)</label>
              <div className="flex items-center gap-4">
                  {previewUrl && (
                      <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden shadow-md border border-gray-200">
                          <img src={previewUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                      </div>
                  )}
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition bg-white text-sm font-medium text-gray-600">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                      </svg>
                      {coverImage ? "Change Image" : "Upload Cover"}
                      <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageChange}
                          className="hidden"
                      />
                  </label>
                  {coverImage && (
                      <button 
                        type="button"
                        onClick={() => { setCoverImage(null); setPreviewUrl(null); }}
                        className="text-xs text-red-500 font-bold hover:underline"
                      >
                          Remove
                      </button>
                  )}
              </div>
           </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Genres / Tags (Select at least one)</label>
              
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
                    Select Tags
                  </button>
               </div>
            </div>

             <div>
               <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Character Description</label>
               <div className="relative">
                   <textarea 
                     ref={textareaRef}
                     value={description}
                     onChange={(e) => setDescription(e.target.value)}
                     style={{ minHeight: '160px' }}
                     className="w-full p-3 md:p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF7B00]/20 focus:border-[#FF7B00] outline-none transition-all bg-gray-50 focus:bg-white text-sm font-medium text-gray-800 placeholder-gray-400 resize-none overflow-hidden pb-12"
                     required
                     placeholder="e.g. A rogue AI attempting to understand human emotions..."
                   />
                    {description.trim() && (
                        <button
                            type="button"
                            onClick={() => handleEnhance('character')}
                            disabled={isEnhancingDesc}
                            className="absolute bottom-4 right-4 text-xs font-bold text-white bg-[#FF7B00] px-3 py-1.5 rounded-lg hover:bg-[#e06c00] transition disabled:opacity-50 flex items-center gap-1 shadow-sm"
                        >
                            {isEnhancingDesc ? (
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

            {/* Definition Input */}
            <div>
               <div className="mb-2">
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Definition (Optional)</label>
               </div>
               
               <div className="relative">
                   <textarea 
                     value={definition}
                     onChange={(e) => setDefinition(e.target.value)}
                     className="w-full p-3 md:p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF7B00]/20 focus:border-[#FF7B00] outline-none transition-all bg-gray-50 focus:bg-white text-sm font-medium text-gray-800 placeholder-gray-400 resize-none h-48 pb-8 font-mono"
                     placeholder="What's your Character's backstory? How do you want it to talk or act?"
                   />
                    <div className="absolute bottom-3 right-4 text-xs font-medium text-gray-400">
                        {definition.length}/32000
                    </div>
               </div>
            </div>

           <button 
             type="submit" 
             disabled={isSaving}
             className="w-full bg-[#FF7B00] text-gray-50 py-3 md:py-4 rounded-xl font-bold text-lg hover:bg-[#e06c00] transition shadow-lg hover:shadow-xl active:scale-[0.98] transform duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
           >
             {isSaving ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Saving Changes...</span>
                </>
             ) : "Save Changes"}
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
                    <h3 className="text-xl font-bold text-[#0A0A0A]">Select Tags</h3>
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
