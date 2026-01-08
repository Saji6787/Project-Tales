import { NextResponse } from 'next/server';
import { ChatMistralAI } from "@langchain/mistralai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function POST(req) {
  try {
    const { history, initialPrompt, genres, token, activePersonaId } = await req.json();

    // 1. Validate Auth
    let userId = null;
    if (token && adminAuth) {
        try {
            const decodedToken = await adminAuth.verifyIdToken(token);
            userId = decodedToken.uid;
        } catch (e) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    } else if (!token) {
        return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    if (!process.env.MISTRAL_API_KEY) {
        return NextResponse.json({ error: "Mistral API Key missing" }, { status: 500 });
    }

    // Fetch User Persona (Active or Default)
    let userPersona = null;
    if (userId && adminDb) {
        try {
            const personasRef = adminDb.collection("users").doc(userId).collection("personas");
            
            if (activePersonaId) {
                const docSnap = await personasRef.doc(activePersonaId).get();
                if (docSnap.exists) userPersona = docSnap.data();
            }

            if (!userPersona) {
                const snapshot = await personasRef.where("isDefault", "==", true).limit(1).get();
                if (!snapshot.empty) userPersona = snapshot.docs[0].data();
            }
        } catch (e) {
            console.warn("Failed to fetch user persona", e);
        }
    }

    let personaPrompt = "";
    if (userPersona) {
        personaPrompt = `\n        PLAYER PERSONA: ${userPersona.name} - ${userPersona.description || "No description"}. 
        Keep choices consistent with this persona's capabilities/personality.`;
    }

    // 2. Setup Mistral
    const model = new ChatMistralAI({
      apiKey: process.env.MISTRAL_API_KEY,
      modelName: "mistral-small-latest",
      temperature: 0.9, // Higher temp for variety
    });

    // 3. Construct Prompt
    const messages = [
        new SystemMessage(`You are a Game Master.
        Task: Provide EXACTLY 3 NEW and DIFFERENT choices for the player based on the story history.
        ${personaPrompt}
        
        Important:
        - Output ONLY the "Choices" section.
        - Do NOT include any story narrative.
        - Detect the language of the 'Story History' (specifically the last AI message).
        - Write the NEW choices in that EXACT SAME language.
        - Genre contexts: ${genres ? genres.join(", ") : "Any"}
        
        Format:
        Choices:
        1. [Option 1]
        2. [Option 2]
        3. [Option 3]`),
    ];

    if (initialPrompt && (!history || history.length === 0)) {
       messages.push(new HumanMessage(`Start story premise: ${initialPrompt}`));
    } else if (history) {
       history.forEach(h => {
          if (h.role === 'player') messages.push(new HumanMessage(h.content));
          else messages.push(new AIMessage(h.content)); // Includes previous choices but AI should focus on generating new ones based on the prompt
       });
    }
    
    // Explicit instructions to regenerate choices for the *current* situation
    messages.push(new HumanMessage("The player is considering their options. Provide a fresh set of choices for the current situation."));

    // 4. Call AI
    const response = await model.invoke(messages);
    const text = response.content;

    // 5. Parse
    const separatorRegex = /(?:^|\n|[\s\*#]+)(?:Pilihan|Choices|Options|Actions):[\s\*#]*/i;
    const match = text.match(separatorRegex);
    
    let choices = [];

    // If match found, extract. If not found (maybe AI just outputted the list), try to extract list directly.
    const choicesText = match ? text.substring(match.index + match[0].length).trim() : text.trim();
    
    const choiceMatches = choicesText.match(/\d+[\.\)]\s*(.+)/g);
    if (choiceMatches) {
        choices = choiceMatches.map(c => c.replace(/^\d+[\.\)]\s*/, '').trim());
    }

    return NextResponse.json({ choices });

  } catch (error) {
    console.error("Regenerate choices error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
