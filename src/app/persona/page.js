"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth";
import { 
  getPersonas, 
  createPersona, 
  updatePersona, 
  deletePersona, 
  setDefaultPersona 
} from "@/lib/firebase/firestore";
import Link from "next/link";

export default function PersonaPage() {
  const { user } = useAuth();
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState(null);
  
  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dropdown State
  const [activeDropdownId, setActiveDropdownId] = useState(null);

  useEffect(() => {
    if (user) fetchPersonas();
  }, [user]);

  const fetchPersonas = async () => {
    setLoading(true);
    try {
      const data = await getPersonas(user.uid);
      setPersonas(data);
    } catch (err) {
      console.error("Failed to fetch personas", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setPhotoUrl("");
    setPreviewUrl(null);
    setEditingPersona(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (persona) => {
    setEditingPersona(persona);
    setName(persona.name);
    setDescription(persona.description);
    setPhotoUrl(persona.photoUrl || "");
    setPreviewUrl(persona.photoUrl || null);
    setIsModalOpen(true);
    setActiveDropdownId(null);
  };

  // Compress Image Helper
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 400; // Small profile pic
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
                
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
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
          try {
             const base64 = await compressImage(file);
             setPhotoUrl(base64);
             setPreviewUrl(base64);
          } catch(err) {
              alert("Failed to process image");
          }
      }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    
    try {
      if (editingPersona) {
        await updatePersona(user.uid, editingPersona.id, {
          name,
          description,
          photoUrl
        });
      } else {
        await createPersona(user.uid, {
          name,
          description,
          photoUrl
        });
      }
      setIsModalOpen(false);
      fetchPersonas();
    } catch (err) {
      alert("Error saving persona: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this persona?")) return;
    try {
      await deletePersona(user.uid, id);
      fetchPersonas();
    } catch (err) {
      console.error(err);
    }
    setActiveDropdownId(null);
  };

  const handleSetDefault = async (id) => {
    try {
      await setDefaultPersona(user.uid, id);
      fetchPersonas();
    } catch (err) {
      console.error(err);
    }
    setActiveDropdownId(null);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdownId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);


  return (
    <div className="min-h-[calc(100vh-80px)] container mx-auto p-4 md:p-10">
       <div className="max-w-4xl mx-auto">
         {/* Header */}
         <div className="flex justify-between items-center mb-10">
            <div>
                <Link href="/" className="text-gray-400 hover:text-[#FF7B00] mb-2 inline-flex items-center gap-2 transition text-sm font-bold">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                    </svg>
                    Back to Dashboard
                </Link>
                <h1 className="text-3xl font-extrabold text-[#0A0A0A]">Your Personas</h1>
            </div>
            <button 
                onClick={openCreateModal}
                className="bg-[#FF7B00] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#e06c00] transition shadow-lg hover:shadow-xl active:scale-95 flex items-center gap-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Persona
            </button>
         </div>

         {/* List */}
         {loading ? (
             <div className="text-center py-20 text-gray-400 font-medium">Loading personas...</div>
         ) : (
            <div className="space-y-4">
                {personas.length === 0 && (
                     <div className="text-center py-20 bg-gray-50 rounded-3xl border border-gray-100">
                        <p className="text-gray-500 font-medium">No personas found. Create one to get started!</p>
                     </div>
                )}
                {personas.map(persona => (
                    <div 
                        key={persona.id} 
                        className={`text-white p-4 rounded-full flex items-center gap-4 shadow-lg transition-all relative group ${
                            persona.isDefault 
                                ? 'bg-[#FF7B00] ring-4 ring-[#FF7B00]/20' 
                                : 'bg-[#FF7B00]/60 hover:bg-[#FF7B00]/80'
                        }`}
                    >
                        {/* Avatar */}
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden flex-shrink-0 bg-gray-700 border-2 border-white/20 group-hover:border-white transition-colors">
                            {persona.photoUrl ? (
                                <img src={persona.photoUrl} alt={persona.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-xl">
                                    {persona.name.charAt(0)}
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pr-10">
                            <div className="flex items-center gap-3 mb-1">
                                <h3 className="text-lg font-bold truncate">{persona.name}</h3>
                                {persona.isDefault && (
                                    <span className="text-[10px] font-bold text-[#5c7cfa] opacity-90 tracking-wider">Default</span>
                                )}
                            </div>
                            <p className="text-sm text-white/90 truncate font-medium">
                                {persona.description}
                            </p>
                        </div>

                        {/* Menu */}
                        <div className="absolute right-6">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setActiveDropdownId(activeDropdownId === persona.id ? null : persona.id); }}
                                className="text-white/80 hover:text-white transition p-2 rounded-full hover:bg-white/20 cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM17.25 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                                </svg>
                            </button>
                            
                            {activeDropdownId === persona.id && (
                                <div className="absolute top-10 right-0 bg-white text-gray-800 rounded-xl shadow-xl py-2 w-40 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                    <button 
                                        onClick={() => openEditModal(persona)}
                                        className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm font-bold block"
                                    >
                                        Edit
                                    </button>
                                    <button 
                                        onClick={() => handleSetDefault(persona.id)}
                                        className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm font-bold block"
                                    >
                                        Set as Default
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(persona.id)}
                                        className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-500 text-sm font-bold block border-t border-gray-100"
                                    >
                                        Delete
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
         )}

         {/* Modal */}
         {isModalOpen && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setIsModalOpen(false)}>
                 <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                    <h2 className="text-2xl font-black mb-6 text-gray-900">
                        {editingPersona ? "Edit Persona" : "New Persona"}
                    </h2>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="flex justify-center mb-6">
                             <label className="cursor-pointer flex flex-col items-center group">
                                <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-lg mx-auto mb-3 relative">
                                    {previewUrl ? (
                                        <img src={previewUrl} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                                            </svg>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-white text-xs font-bold">Change</span>
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-[#FF7B00] bg-orange-50 px-3 py-1 rounded-full hover:bg-orange-100 transition-colors">
                                    {previewUrl ? "Change Image" : "Add Image"}
                                </span>
                                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                             </label>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Persona Name</label>
                            <input 
                                type="text"
                                className="w-full p-3 border border-gray-200 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-[#FF7B00] outline-none"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Description</label>
                            <textarea 
                                className="w-full p-3 border border-gray-200 rounded-xl font-medium text-gray-600 focus:ring-2 focus:ring-[#FF7B00] outline-none h-24 resize-none"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="e.g. A cool guy from Tokyo..."
                            />
                        </div>

                        <div className="pt-4 flex gap-3">
                            <button 
                                type="button" 
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 py-3 bg-[#FF7B00] rounded-xl font-bold text-white hover:bg-[#e06c00] transition disabled:opacity-50"
                            >
                                {isSubmitting ? "Saving..." : "Save Persona"}
                            </button>
                        </div>
                    </form>
                 </div>
             </div>
         )}
       </div>
    </div>
  );
}
