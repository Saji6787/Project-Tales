import { db } from "./config";
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, arrayUnion } from "firebase/firestore";

export const createStory = async (userId, title, initialPrompt, genres) => {
  const colRef = collection(db, "users", userId, "stories");
  const docRef = await addDoc(colRef, {
    title,
    initialPrompt,
    genres, // Save genres
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
