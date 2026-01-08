
import { NextResponse } from 'next/server';
import { ChatMistralAI } from "@langchain/mistralai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { adminAuth } from '@/lib/firebase/admin';

export async function POST(req) {
  try {
    const { content, token } = await req.json();

    // 1. Validate Auth
    if (!token) {
        return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }
    
    // We can skip strict UID check if we just need a summary service, 
    // but better safe than sorry.
    if (adminAuth) {
        try {
            await adminAuth.verifyIdToken(token);
        } catch (e) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    if (!process.env.MISTRAL_API_KEY) {
        return NextResponse.json({ error: "Mistral API Key missing" }, { status: 500 });
    }

    if (!content) {
        return NextResponse.json({ error: "No content to summarize" }, { status: 400 });
    }

    // 2. Setup Mistral
    const model = new ChatMistralAI({
      apiKey: process.env.MISTRAL_API_KEY,
      modelName: "mistral-small-latest",
      temperature: 0.3, // Lower temp for more factual summary
    });

    const messages = [
        new SystemMessage(`
            Kamu adalah asisten yang bertugas meringkas percakapan menjadi "Ingatan Jangka Panjang" (Memory).
            Tugasmu:
            1. IDENTIFIKASI BAHASA dari teks yang diberikan (Bahasa Indonesia atau Inggris).
            2. Buat ringkasan 1 kalimat yang padat dan jelas.
            3. Fokus pada fakta, janji, nama, atau event penting.
            4. Gunakan sudut pandang ketiga atau netral.
            5. JANGAN mengulang seluruh isi, cukup intinya saja.
            6. Outputkan HANYA teks ringkasannya saja.
            7. PENTING: Gunakan bahasa yang SAMA dengan teks asli. Jika teks Inggris, ringkasan HARUS Inggris. Jika teks Indonesia, ringkasan HARUS Indonesia.
        `),
        new HumanMessage(content)
    ];

    const response = await model.invoke(messages);
    const summary = response.content.trim();

    return NextResponse.json({ summary });

  } catch (error) {
    console.error("Summarize error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
