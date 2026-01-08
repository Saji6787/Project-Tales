import { db } from "./config";
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, arrayUnion, setDoc } from "firebase/firestore";

export const createStory = async (userId, title, initialPrompt, genres, storyStyle, coverImage = null, assets = {}, type = "story", additionalData = {}) => {
  const colRef = collection(db, "users", userId, "stories");
  const docRef = await addDoc(colRef, {
    title,
    initialPrompt,
    genres, // Save genres
    storyStyle, // Save story style
    coverImage, // Save cover image URL
    assets, // Save assets (locations, characters, customs)
    type, // Save type (story or character)
    ...additionalData, // Save additional data (e.g., definition)
    createdAt: serverTimestamp(),
    history: [], // Stores conversation history
  });
  return docRef.id;
};

export const getStories = async (userId) => {
  const colRef = collection(db, "users", userId, "stories");
  const q = query(colRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getStory = async (userId, storyId) => {
  const docRef = doc(db, "users", userId, "stories", storyId);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() };
  }
  return null;
};

export const updateStory = async (userId, storyId, updates) => {
  const docRef = doc(db, "users", userId, "stories", storyId);
  await updateDoc(docRef, updates);
};

export const updateStoryHistory = async (userId, storyId, newHistoryItem) => {
  const docRef = doc(db, "users", userId, "stories", storyId);
  await updateDoc(docRef, {
    history: arrayUnion(newHistoryItem)
  });
};

export const saveStoryHistory = async (userId, storyId, newHistory) => {
  const docRef = doc(db, "users", userId, "stories", storyId);
  await updateDoc(docRef, {
    history: newHistory
  });
};

export const deleteStory = async (userId, storyId) => {
  const docRef = doc(db, "users", userId, "stories", storyId);
  await deleteDoc(docRef);
};

// --- Save & Load System ---

// Save current story state to a specific slot
export const saveSlot = async (userId, storyId, slotId, flowData) => {
  const slotRef = doc(db, "users", userId, "stories", storyId, "saves", slotId);
  // data should include history, etc. We add a timestamp and a label automatically.
  const turnCount = flowData.history ? flowData.history.length : 0;
  
  // Exclude 'id' from flowData to prevent storage of the story ID as a field that clobbers the slot ID later
  const { id, ...dataToSave } = flowData;

  await setDoc(slotRef, {
    ...dataToSave,
    savedAt: serverTimestamp(),
    label: `Chapter ${Math.ceil(turnCount / 2)} (Turn ${turnCount})` 
  });
};

// Get all save slots for a story
export const getSaves = async (userId, storyId) => {
    const colRef = collection(db, "users", userId, "stories", storyId, "saves");
    const snapshot = await getDocs(colRef);
    // Ensure doc.id (the slot ID) is used, overwriting any 'id' field that might exist in data
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
};

// Delete a save slot
export const deleteSaveSlot = async (userId, storyId, slotId) => {
    const slotRef = doc(db, "users", userId, "stories", storyId, "saves", slotId);
    await deleteDoc(slotRef);
};

// Restore a save: Overwrite the main story with save data
export const loadSave = async (userId, storyId, saveData) => {
    const storyRef = doc(db, "users", userId, "stories", storyId);
    
    // We only update the dynamic parts (history, maybe style if changed). 
    // We don't overwrite title/createdAt usually, but let's keep it safe.
    await updateDoc(storyRef, {
        history: saveData.history,
        storyStyle: saveData.storyStyle || "Normal", // Fallback
        genres: saveData.genres,
        assets: saveData.assets || {}
        // We do NOT update 'title' or 'initialPrompt' usually as those are story identities,
        // but if the save contains them, it's fine. Main thing is history.
    });
};

// --- Persona System ---

export const createPersona = async (userId, personaData) => {
  const colRef = collection(db, "users", userId, "personas");
  const docRef = await addDoc(colRef, {
    ...personaData,
    createdAt: serverTimestamp(),
    isDefault: false 
  });
  return docRef.id;
};

export const getPersonas = async (userId) => {
  const colRef = collection(db, "users", userId, "personas");
  const q = query(colRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const updatePersona = async (userId, personaId, updates) => {
  const docRef = doc(db, "users", userId, "personas", personaId);
  await updateDoc(docRef, updates);
};

export const deletePersona = async (userId, personaId) => {
  const docRef = doc(db, "users", userId, "personas", personaId);
  await deleteDoc(docRef);
};

export const setDefaultPersona = async (userId, personaId) => {
  const colRef = collection(db, "users", userId, "personas");
  const snapshot = await getDocs(colRef);
  
  const updates = snapshot.docs.map(d => {
      const isDefault = d.id === personaId;
      if (d.data().isDefault !== isDefault) {
          return updateDoc(doc(db, "users", userId, "personas", d.id), { isDefault });
      }
      return Promise.resolve();
  });
  
  await Promise.all(updates);
};
