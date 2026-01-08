import { NextResponse } from 'next/server';
import { ChatMistralAI } from "@langchain/mistralai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { adminAuth } from '@/lib/firebase/admin';

export async function POST(req) {
  try {
    const { text, genres, title, token, type = "premise" } = await req.json();

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

    if (!text) {
         return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (!process.env.MISTRAL_API_KEY) {
        return NextResponse.json({ error: "Mistral API Key missing" }, { status: 500 });
    }

    // 2. Setup Mistral
    const model = new ChatMistralAI({
      apiKey: process.env.MISTRAL_API_KEY,
      modelName: "mistral-small-latest",
      temperature: 0.7,
    });

    let instruction = "";
    if (type === "character") {
        instruction = "Task: Rewrite the user's character description to make it more vivid, detailed, and personality-driven. Focus on appearance, traits, and background.";
    } else if (type === "message") {
        instruction = "Task: Rewrite the user's opening message to make it more hooking, immersive, and in-character. It should invite a response.";
    } else {
        instruction = "Task: Rewrite the user's story premise to make it more engaging, immersive, and descriptive.";
    }

    // 3. Construct Prompt
    const messages = [
        new SystemMessage(`You are a skilled creative writing editor.
        ${instruction}
        
        Important:
        - Keep the core idea and main events exactly the same.
        - Improve vocabulary and flow.
        - Fix any grammar issues.
        - Target length: 1 paragraph (approx 3-5 sentences).
        - Genres context: ${genres ? genres.join(", ") : "General"}
        - CRITICAL: Detect the major language of the provided 'Original Text'.
        - WRITE THE ENHANCED VERSION IN THAT SAME LANGUAGE. (e.g. if input is English, output English. If Indonesian, output Indonesian).
        - Use the Title only for context.
        - Output ONLY the enhanced text. Do not add quotes or "Here is the enhanced version:".`),
        new HumanMessage(`Original Text: ${text}`),
    ];

    // 4. Call AI
    const response = await model.invoke(messages);
    const enhancedText = response.content.trim();

    return NextResponse.json({ enhancedText });

  } catch (error) {
    console.error("Enhance Premise error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
