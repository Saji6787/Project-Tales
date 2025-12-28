import { NextResponse } from 'next/server';
import { ChatMistralAI } from "@langchain/mistralai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { adminAuth } from '@/lib/firebase/admin';

export async function POST(req) {
  try {
    const { history, initialPrompt, genres, token } = await req.json();

    // 1. Validate Auth
    if (token && adminAuth) {
        try {
            await adminAuth.verifyIdToken(token);
        } catch (e) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    } else if (!token) {
        return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    if (!process.env.MISTRAL_API_KEY) {
        return NextResponse.json({ error: "Mistral API Key missing" }, { status: 500 });
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
