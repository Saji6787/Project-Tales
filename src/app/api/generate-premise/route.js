import { NextResponse } from 'next/server';
import { ChatMistralAI } from "@langchain/mistralai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { adminAuth } from '@/lib/firebase/admin';

export async function POST(req) {
  try {
    const { title, genres, token } = await req.json();

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
      temperature: 0.8,
    });

    // 3. Construct Prompt
    const messages = [
        new SystemMessage(`You are a creative writing assistant. 
        Your task: Create a short, intriguing, and immersive opening premise (2-3 sentences) for an interactive roleplay story based on the provided Title and Genres.
        
        Genres: ${genres ? genres.join(", ") : "Any"}
        
        Important:
        - The premise MUST reflect the themes of the selected genres.
        - Do NOT include any choices.
        - Do NOT include "Title:" or "Premise:".
        - Just output the raw story starter text.
        - Use the same language as the Title (e.g. Indonesian title -> Indonesian premise).`),
        new HumanMessage(`Story Title: ${title}`),
    ];

    // 4. Call AI
    const response = await model.invoke(messages);
    const premise = response.content.trim();

    return NextResponse.json({ premise });

  } catch (error) {
    console.error("Generate Premise error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
