import { NextResponse } from 'next/server';
import { ChatMistralAI } from "@langchain/mistralai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { adminAuth } from '@/lib/firebase/admin';

export async function POST(req) {
  try {
    const { history, initialPrompt, genres, token, locations, characters, customs, style, currentChapter } = await req.json();

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

    // Helper to format assets
    const formatAssets = (list, title) => {
        if (!list || list.length === 0) return "";
        return `\n         - ${title}:\n` + list.map(item => `           * ${item.name}: ${item.description}`).join("\n");
    };

    let assetsPrompt = "";
    if ((locations && locations.length > 0) || (characters && characters.length > 0) || (customs && customs.length > 0)) {
        assetsPrompt = "6. Referensi Aset Dunia:" +
            formatAssets(locations, "Lokasi") +
            formatAssets(characters, "Karakter Penting") +
            formatAssets(customs, "Lainnya") +
            "\n        Gunakan referensi aset tersebut dalam narasi jika relevan.";
    }

    // 3. Construct Prompt
    const messages = [
        new SystemMessage(`Anda adalah Game Master untuk roleplay cerita interaktif. 
        Tugas anda:
        1. Lanjutkan cerita berdasarkan input player dan histori.
        2. Buat narasi 150-250 kata yang immersif, deskriptif, dan menarik.
        3. Di akhir, berikan TEPAT 3 pilihan aksi untuk player. Tidak lebih, tidak kurang.
        4. PENTING: Deteksi bahasa dari 'Initial Premise' atau 'Story History' sebelumnya. Gunakan bahasa TERSEBUT untuk seluruh narasi DAN pilihan (Choices).
        5. KONSISTENSI BAHASA: Jika cerita dimulai dalam Bahasa Indonesia, LANJUTKAN dalam Bahasa Indonesia, bahkan jika player mengetik aksi custom dalam bahasa lain (misal: Inggris). Jangan ganti bahasa di tengah-tengah.
        6. Genre cerita ini adalah: ${genres ? genres.join(", ") : "Bebas"}. Pastikan narasi dan tone sesuai dengan genre tersebut.
        7. Gaya Penulisan/Story Style: ${style || "Standard/Adaptive"}. Ikuti gaya ini dalam penulisan narasi.
        8. PERINGATAN KERAS TENTANG PENGULANGAN: 
           - DILARANG KERAS mengulang kalimat, frasa, atau deskripsi yang SAMA PERSIS dengan 2-3 respon terakhir di 'Story History'.
           - Variasikan struktur kalimat (SPOK). Jangan memulai setiap kalimat dengan "Kamu..." atau nama karakter.
           - Jika sebelumnya sudah dideskripsikan suatu hal, JANGAN deskripsikan ulang dengan kata-kata yang sama. Lanjutkan plotnya.
        9. JANGAN memulai respon dengan merangkum kejadian terakhir (misal: "Setelah...", "Melihat hal itu..."). LANGSUNG ke aksi/konsekuensi berikutnya.
        ${assetsPrompt}
        
        CONTEXT: Saat ini cerita berada di Chapter ${currentChapter || 1}.
        ATURAN BAB/CHAPTER:
        ${(!history || history.length === 0) ? `- JIKA INI ADALAH AWAL CERITA (Response pertama dari premis), KAMU WAJIB MEMULAI DENGAN:
          ### CHAPTER 1: [Judul Bab yang Relevan]` : ''}
        ${(() => {
            // Count turns since last chapter
            let turnsSinceLastChapter = 0;
            if (history && history.length > 0) {
                 for (let i = history.length - 1; i >= 0; i--) {
                    if (history[i].content && history[i].content.includes("### CHAPTER")) {
                        break;
                    }
                    if (history[i].role === 'ai') turnsSinceLastChapter++;
                 }
            }
            
            if (turnsSinceLastChapter < 7) {
                return `- SAAT INI JANGAN BUAT CHAPTER BARU. Fokus lanjutkan cerita.`;
            } else if (turnsSinceLastChapter >= 7 && turnsSinceLastChapter <= 12) {
                return `- OPSI CHAPTER BARU: Jika momen pas, kamu BOLEH memulai Chapter baru dengan tag: ### CHAPTER [N]: [Judul]`;
            } else {
                return `- WAJIB CHAPTER BARU: Cerita sudah cukup panjang. Kamu HARUS mengakhiri adegan ini dan memulai Chapter baru di respon ini dengan tag: ### CHAPTER [N]: [Judul]`;
            }
        })()}

        - Jika membuat chapter baru, gunakan format:
          ### CHAPTER [Nomor]: [Judul Bab]
          [Narasi Chapter Baru...]
        - Jangan gunakan tag ini jika hanya melanjutkan adegan biasa (kecuali diperintahkan di atas).
        
        Format response HARUS:
           (Tag Chapter jika perlu)
           [Narasi Cerita]
           
           Choices:
           1. [Option 1 in English]
           2. [Option 2 in English]
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
    // Regex to find the separator (Pilihan:, Choices:, etc.) - Case insensitive, handles markdown bold/header
    const separatorRegex = /(?:^|\n|[\s\*#]+)(?:Pilihan|Choices|Options|Actions):[\s\*#]*/i;
    const match = text.match(separatorRegex);
    
    let story = text;
    let choices = [];
    let chapterMetadata = null;

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

    // Check for Chapter Tag
    const chapterRegex = /###\s*CHAPTER\s*(\d+)\s*:\s*(.+)/i;
    const chapterMatch = story.match(chapterRegex);

    if (chapterMatch) {
        const chapterNum = parseInt(chapterMatch[1]);
        const chapterTitle = chapterMatch[2].trim();
        
        chapterMetadata = {
            number: chapterNum,
            title: chapterTitle
        };

        // Remove the tag from the story text to prevent double rendering
        story = story.replace(chapterMatch[0], "").trim();
    }

    return NextResponse.json({ story, choices, chapter: chapterMetadata });

  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
