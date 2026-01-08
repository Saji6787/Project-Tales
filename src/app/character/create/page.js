"use client";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth";
import { createStory, updateStoryHistory } from "@/lib/firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

import Cropper from 'react-easy-crop';

export default function CreateCharacterPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [firstMessage, setFirstMessage] = useState(""); 
  const [definition, setDefinition] = useState(""); 
  const [genres, setGenres] = useState([]); // Array of selected genres
  
  // Cover Image State
  const [coverImage, setCoverImage] = useState(null); // Final base64
  const [originalImage, setOriginalImage] = useState(null); // Source image (preserved for re-editing)
  const [tempImage, setTempImage] = useState(null); // Active image in cropper
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const fileInputRef = useRef(null); // Ref for file input

  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancingDesc, setIsEnhancingDesc] = useState(false);
  const [isEnhancingMsg, setIsEnhancingMsg] = useState(false);
  const [isGenreModalOpen, setIsGenreModalOpen] = useState(false); // Mobile genre modal state
  const textareaRef = useRef(null); // Ref for auto-expanding textarea

  const GENRE_LIST = [
    "Male", "Female", "Fictional", "Anime", "Magical", "MalePOV", 
    "FemalePOV", "Hero", "Monster", "Historical", "Romance", "Comedy", "Elf", "Maid"
  ].sort();

  // Auto-resize textarea when description changes
  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'; // Reset height
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'; // Set to scrollHeight
    }
  }, [description]);

  const toggleGenre = (genre) => {
    setGenres(prev => 
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const onCropComplete = (croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

    const createImage = (url) =>
        new Promise((resolve, reject) => {
            const image = new Image();
            image.addEventListener("load", () => resolve(image));
            image.addEventListener("error", (error) => reject(error));
            image.setAttribute("crossOrigin", "anonymous");
            image.src = url;
        });

    const getCroppedImg = async (imageSrc, pixelCrop) => {
        const image = await createImage(imageSrc);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
            return null;
        }

        // set canvas size to match the bounding box
        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;

        // draw image
        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height
        );

        // As Base64 string (JPEG, 0.9 quality)
        return canvas.toDataURL('image/jpeg', 0.9);
    };

    const handleCropSave = async () => {
        if (!tempImage || !croppedAreaPixels) return;
        try {
            const croppedImage = await getCroppedImg(tempImage, croppedAreaPixels);
            setCoverImage(croppedImage);
            // Don't clear tempImage/originalImage here so we can re-edit later
            setIsCropping(false);
        } catch (e) {
            console.error(e);
            alert("Failed to crop image");
        }
    };


  // Handle Image Selection
  const handleImageChange = async (e) => {
      const file = e.target.files[0];
      if (file) {
          if (file.size > 5 * 1024 * 1024) { // 5MB limit
              alert("Image size should be less than 5MB");
              return;
          }
           const reader = new FileReader();
           reader.addEventListener("load", () => {
               const result = reader.result?.toString() || "";
               setOriginalImage(result);
               setTempImage(result);
               setIsCropping(true);
           });
           reader.readAsDataURL(file);
      }
  };
  
  const openEditModal = () => {
      // Logic: If we have an original source, use it. Otherwise use the cropped one (fallback).
      // If neither, trigger upload? No, button says "Edit Image" only if image exists.
      // Actually per requirement: "Edit Image" -> Modal.
      
      if (originalImage) {
          setTempImage(originalImage);
          setIsCropping(true);
      } else if (coverImage) {
           setTempImage(coverImage);
           setIsCropping(true);
      } else {
          // No image yet, trigger upload
          fileInputRef.current?.click();
      }
  };

// ... inside render ...

// [Lines 290-320 Replacement]
            <div>
               <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Cover Image (Optional)</label>
               <div className="flex items-center gap-4">
                   {coverImage && (
                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden shadow-md border border-gray-200 shrink-0">
                            <img src={coverImage} alt="Cover Preview" className="w-full h-full object-cover" />
                        </div>
                    )}
                    
                    <button
                        type="button" 
                        onClick={openEditModal}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition bg-white text-sm font-medium text-gray-600"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            {coverImage ? (
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                            )}
                        </svg>
                        {coverImage ? "Edit Image" : "Upload Cover"}
                    </button>
                    
                    {/* Hidden Input */}
                    <input 
                       ref={fileInputRef}
                       type="file" 
                       accept="image/*" 
                       onChange={handleImageChange}
                       className="hidden"
                    />
               </div>
            </div>

// [Bottom Modal Replacement]
      {/* Edit Image Modal */}
      {isCropping && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
              <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="p-4 border-b flex justify-between items-center bg-white sticky top-0 z-10">
                    <h3 className="font-bold text-gray-800 text-lg">Edit Image</h3>
                    <button onClick={() => setIsCropping(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                  </div>
                  
                  <div className="relative flex-1 bg-black min-h-[300px]">
                       {tempImage ? (
                           <Cropper
                               image={tempImage}
                               crop={crop}
                               zoom={zoom}
                               aspect={1} // 1:1 Aspect Ratio
                               onCropChange={setCrop}
                               onCropComplete={onCropComplete}
                               onZoomChange={setZoom}
                           />
                       ) : (
                           <div className="absolute inset-0 flex items-center justify-center text-white/50">
                               No Image Loaded
                           </div>
                       )}
                  </div>
                  
                  <div className="p-6 bg-white border-t border-gray-100 space-y-4">
                       {/* Zoom Control */}
                       <div>
                           <div className="flex justify-between mb-2">
                               <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Zoom</label>
                               <span className="text-xs font-bold text-gray-400">{zoom.toFixed(1)}x</span>
                           </div>
                           <input
                             type="range"
                             value={zoom}
                             min={1}
                             max={3}
                             step={0.1}
                             onChange={(e) => setZoom(Number(e.target.value))}
                             className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#FF7B00]"
                           />
                       </div>

                       {/* Action Buttons */}
                       <div className="flex flex-col gap-3 pt-2">
                           <button
                               onClick={handleCropSave}
                               className="w-full bg-[#FF7B00] text-white py-3 rounded-xl font-bold hover:bg-[#e06c00] transition active:scale-[0.98]"
                            >
                               Save Changes
                           </button>
                           
                           <div className="flex gap-3">
                               <button
                                   onClick={() => fileInputRef.current?.click()}
                                   className="flex-1 py-3 rounded-xl font-bold text-gray-600 border border-gray-200 hover:bg-gray-50 transition flex items-center justify-center gap-2"
                                >
                                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                     <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                                   </svg>
                                   Upload Image
                               </button>
                               <button
                                   onClick={() => setIsCropping(false)}
                                   className="flex-1 py-3 rounded-xl font-bold text-gray-600 border border-gray-200 hover:bg-gray-50 transition"
                                >
                                   Cancel
                               </button>
                           </div>
                       </div>
                  </div>
              </div>
          </div>
      )}

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
                type // 'character' or 'message'
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

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (genres.length === 0) {
        alert("Please select at least one genre.");
        return;
    }
    setIsGenerating(true);

    try {
      // 1. Create document with type="character"
      const storyId = await createStory(
          user.uid, 
          name, 
          description, 
          genres, 
          "", // No explicit "storyStyle" for characters normally, pass empty or maybe derived from genres
          coverImage, 
          {}, // No extra assets for now
          "character", // Type
          { definition } // Additional data: Definition
      );

      let aiTurn = null;

      if (firstMessage.trim()) {
           // A. Use Custom First Message
           aiTurn = {
               role: "ai",
               content: firstMessage,
               choices: [] // Can regenerate later
           };
           // Optionally generate choices immediately? The standard flow does it.
           // Let's generate choices for this message to be helpful.
           try {
                const token = await user.getIdToken();
                const res = await fetch("/api/regenerate-choices", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ 
                            token, 
                            history: [{ role: "ai", content: firstMessage }],
                            initialPrompt: description,
                            genres,
                            style: "Character Roleplay"
                        }),
                });
                const data = await res.json();
                if (data.choices) {
                    aiTurn.choices = data.choices;
                }
           } catch (ignored) {
               console.warn("Failed to generate initial choices", ignored);
           }

      } else {
           // B. Generate Intro normally based on description
           const token = await user.getIdToken();
           const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    token, 
                    initialPrompt: description,
                    genres,
                    style: "Character Roleplay", 
                    locations: [],
                    characters: [], // Self-reference?
                    customs: [],
                    history: [] 
                }),
           });
           const data = await res.json();
           if (data.error) throw new Error(data.error);

           aiTurn = {
               role: "ai",
               content: data.story,
               choices: data.choices || [],
               chapterMetadata: data.chapter || null
           };
      }

      // 3. Save Intro to history
      await updateStoryHistory(user.uid, storyId, aiTurn);

      router.push(`/story/${storyId}`);

    } catch (err) {
      console.error(err);
      alert("Failed to create character: " + err.message);
      setIsGenerating(false);
    }
  };


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
            <h1 className="text-xl md:text-4xl font-extrabold text-[#0A0A0A] tracking-tight mb-2">Create New Character</h1>
            <p className="text-gray-400 font-medium">Design a unique persona to interact with.</p>
         </div>

         <form onSubmit={handleCreate} className="space-y-6">
           <div>
             <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Character Name</label>
             <input 
               type="text" 
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
                   {coverImage && (
                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden shadow-md border border-gray-200 shrink-0">
                            <img src={coverImage} alt="Cover Preview" className="w-full h-full object-cover" />
                        </div>
                    )}
                    
                    <button
                        type="button" 
                        onClick={openEditModal}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition bg-white text-sm font-medium text-gray-600"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            {coverImage ? (
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                            )}
                        </svg>
                        {coverImage ? "Edit Image" : "Upload Cover"}
                    </button>
                    
                    {/* Hidden Input */}
                    <input 
                       ref={fileInputRef}
                       type="file" 
                       accept="image/*" 
                       onChange={handleImageChange}
                       className="hidden"
                    />
               </div>
            </div>

             <div>
               <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Genres / Tags (Select at least one)</label>
              
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

            {/* First Message Input */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">First Message (Optional)</label>
              <p className="text-xs text-gray-400 mb-2">This will be the character&apos;s opening line.</p>
              <div className="relative">
                  <textarea 
                    value={firstMessage}
                    onChange={(e) => setFirstMessage(e.target.value)}
                    className="w-full p-3 md:p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF7B00]/20 focus:border-[#FF7B00] outline-none transition-all bg-gray-50 focus:bg-white text-sm font-medium text-gray-800 placeholder-gray-400 resize-none h-28 pb-12"
                    placeholder="e.g. *Looking at you with curiosity* Who are you?"
                  />
                   {firstMessage.trim() && (
                        <button
                            type="button"
                            onClick={() => handleEnhance('message')}
                            disabled={isEnhancingMsg}
                            className="absolute bottom-4 right-4 text-xs font-bold text-white bg-[#FF7B00] px-3 py-1.5 rounded-lg hover:bg-[#e06c00] transition disabled:opacity-50 flex items-center gap-1 shadow-sm"
                        >
                            {isEnhancingMsg ? (
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
             disabled={isGenerating}
             className="w-full bg-[#FF7B00] text-gray-50 py-3 md:py-4 rounded-xl font-bold text-lg hover:bg-[#e06c00] transition shadow-lg hover:shadow-xl active:scale-[0.98] transform duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
           >
             {isGenerating ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Creating Character...</span>
                </>
             ) : "Create Character"}
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

      {/* Edit Image Modal */}
      {isCropping && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
              <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="p-4 border-b flex justify-between items-center bg-white sticky top-0 z-10">
                    <h3 className="font-bold text-gray-800 text-lg">Edit Image</h3>
                    <button onClick={() => setIsCropping(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                  </div>
                  
                  <div className="relative flex-1 bg-black min-h-[300px]">
                       {tempImage ? (
                           <Cropper
                               image={tempImage}
                               crop={crop}
                               zoom={zoom}
                               aspect={1} // 1:1 Aspect Ratio
                               onCropChange={setCrop}
                               onCropComplete={onCropComplete}
                               onZoomChange={setZoom}
                           />
                       ) : (
                           <div className="absolute inset-0 flex items-center justify-center text-white/50">
                               No Image Loaded
                           </div>
                       )}
                  </div>
                  
                  <div className="p-6 bg-white border-t border-gray-100 space-y-4">
                       {/* Zoom Control */}
                       <div>
                           <div className="flex justify-between mb-2">
                               <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Zoom</label>
                               <span className="text-xs font-bold text-gray-400">{zoom.toFixed(1)}x</span>
                           </div>
                           <input
                             type="range"
                             value={zoom}
                             min={1}
                             max={3}
                             step={0.1}
                             onChange={(e) => setZoom(Number(e.target.value))}
                             className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#FF7B00]"
                           />
                       </div>

                       {/* Action Buttons */}
                       <div className="flex flex-col gap-3 pt-2">
                           <button
                               onClick={handleCropSave}
                               className="w-full bg-[#FF7B00] text-white py-3 rounded-xl font-bold hover:bg-[#e06c00] transition active:scale-[0.98]"
                            >
                               Save Changes
                           </button>
                           
                           <div className="flex gap-3">
                               <button
                                   onClick={() => fileInputRef.current?.click()}
                                   className="flex-1 py-3 rounded-xl font-bold text-gray-600 border border-gray-200 hover:bg-gray-50 transition flex items-center justify-center gap-2"
                                >
                                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                     <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                                   </svg>
                                   Upload Image
                               </button>
                               <button
                                   onClick={() => setIsCropping(false)}
                                   className="flex-1 py-3 rounded-xl font-bold text-gray-600 border border-gray-200 hover:bg-gray-50 transition"
                                >
                                   Cancel
                               </button>
                           </div>
                       </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
