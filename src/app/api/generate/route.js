import { NextResponse } from 'next/server';
import { ChatMistralAI } from "@langchain/mistralai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { adminAuth } from '@/lib/firebase/admin';

export async function POST(req) {
  try {
    const { history, initialPrompt, token } = await req.json();

    // 1. Validate Auth
    let userId = null;
    if (token && adminAuth) {
        try {
            const decodedToken = await adminAuth.verifyIdToken(token);
            userId = decodedToken.uid;
        } catch (e) {
            console.error("Auth verification failed", e);
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
      temperature: 0.7,
    });

    // 3. Construct Prompt
    const messages = [
        new SystemMessage(`Anda adalah Game Master untuk roleplay cerita interaktif. 
        Tugas anda:
        1. Lanjutkan cerita berdasarkan input player dan histori.
        2. Buat narasi 150-250 kata yang immersif, deskriptif, dan menarik.
        3. Di akhir, berikan TEPAT 3-5 pilihan aksi untuk player.
        4. PENTING: Pastikan BAHASA pada Pilihan SAMA dengan BAHASA pada Narasi Cerita. Jika cerita Bahasa Indonesia, pilihan harus Bahasa Indonesia. Jika Inggris, pilihan harus Inggris.
        5. Format response HARUS:
           [Narasi Cerita]
           
           Pilihan:
           1. [Opsi 1]
           2. [Opsi 2]
           ...
           
        JANGAN berikan penjelasan di luar cerita.`),
    ];

    if (initialPrompt && (!history || history.length === 0)) {
       messages.push(new HumanMessage(`Start cerita dengan premis: ${initialPrompt}`));
    } else if (history) {
       history.forEach(h => {
          if (h.role === 'player') messages.push(new HumanMessage(h.content));
          else messages.push(new AIMessage(h.content));
       });
    }

    // 4. Call AI
    const response = await model.invoke(messages);
    const text = response.content;

    // 5. Parse
    // Regex to find the separator (Pilihan:, Choices:, etc.) - Case insensitive
    const separatorRegex = /(?:Pilihan|Choices|Options|Actions):\s*/i;
    const match = text.match(separatorRegex);
    
    let story = text;
    let choices = [];

    if (match) {
        // Story is everything before the match
        story = text.substring(0, match.index).trim();
        
        // Choices are everything after
        const choicesText = text.substring(match.index + match[0].length).trim();
        
        // Extract numbered lists (1. xxx, 2. xxx)
        const choiceMatches = choicesText.match(/\d+[\.\)]\s*(.+)/g);
        if (choiceMatches) {
            choices = choiceMatches.map(c => c.replace(/^\d+[\.\)]\s*/, '').trim());
        }
    }

    return NextResponse.json({ story, choices });

  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
