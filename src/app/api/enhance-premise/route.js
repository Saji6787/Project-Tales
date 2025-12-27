import { NextResponse } from 'next/server';
import { ChatMistralAI } from "@langchain/mistralai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { adminAuth } from '@/lib/firebase/admin';

export async function POST(req) {
  try {
    const { text, genres, title, token } = await req.json();

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

    // 3. Construct Prompt
    const messages = [
        new SystemMessage(`You are a skilled creative writing editor.
        Task: Rewrite the user's story premise to make it more engaging, immersive, and descriptive.
        
        Important:
        - Keep the core idea and main events exactly the same.
        - Improve vocabulary and flow.
        - Fix any grammar issues.
        - Target length: 1 paragraph (approx 3-5 sentences).
        - Genres context: ${genres ? genres.join(", ") : "General"}
        - CRITICAL: Detect the major language of the provided 'Original Premise'.
        - WRITE THE ENHANCED VERSION IN THAT SAME LANGUAGE. (e.g. if premise is English, output English. If Indonesian, output Indonesian).
        - Use the Title only for context, do NOT let the Title's language override the Premise's language.
        - Output ONLY the enhanced text. Do not add quotes or "Here is the enhanced version:".`),
        new HumanMessage(`Original Premise: ${text}`),
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
