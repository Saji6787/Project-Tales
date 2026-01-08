import { NextResponse } from 'next/server';
import { ChatMistralAI } from "@langchain/mistralai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function POST(req) {
  try {
    const { history, initialPrompt, genres, token, locations, characters, customs, style, currentChapter, activePersonaId, storyType, storyTitle, storyId, memories } = await req.json();

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

    // Fetch User Persona (Active or Default)
    let userPersona = null;
    if (userId && adminDb) {
        try {
            const personasRef = adminDb.collection("users").doc(userId).collection("personas");
            
            // 1. Try fetching specific active persona if provided
            if (activePersonaId) {
                const docSnap = await personasRef.doc(activePersonaId).get();
                if (docSnap.exists) {
                    userPersona = docSnap.data();
                }
            }

            // 2. Fallback to default if no active persona found/provided
            if (!userPersona) {
                const snapshot = await personasRef.where("isDefault", "==", true).limit(1).get();
                if (!snapshot.empty) {
                    userPersona = snapshot.docs[0].data();
                }
            }
        } catch (e) {
             console.warn("Failed to fetch user persona", e);
        }
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
            "\n        ATURAN ASET: Gunakan referensi aset tersebut dalam narasi. \n" +
            "        - Jika NPC (Karakter Penting) muncul, SANGAT PENTING untuk menirukan kepribadian, cara bicara, dan deskripsi fisik mereka sesuai data di atas.\n" +
            "        - JANGAN membuat karakter ini memecahkan karakter (OOC).";
    }

    let personaPrompt = "";
    if (userPersona) {
        personaPrompt = `\n        INFORMASI USER / PLAYER:
        Nama: ${userPersona.name}
        Deskripsi/Kepribadian: ${userPersona.description || "Tidak ada deskripsi"}
        
        INSTRUKSI PERSONA: 
        - Anggap deskripsi di atas adalah kepribadian dari karakter yang dimainkan oleh USER (Player).
        - Respon dan interaksi NPC/Dunia harus memperhitungkan kepribadian ini.
        - Contoh: Jika player dideskripsikan sebagai "Garang", NPC mungkin takut atau menantang. Jika "Pemalu", NPC mungkin lebih lembut atau memanfaatkannya.
        - Jadikan roleplay lebih imersif dengan mengakui keberadaan sifat user ini dalam narasi (secara implisit atau eksplisit).`;
    }

    // 3. Construct Prompt
    
    // Process Initial Prompt to replace placeholders with Persona Name
    let processedInitialPrompt = initialPrompt;
    if (userPersona && processedInitialPrompt) {
        const pattern = /\[User\]|\{User\}|\(User\)|\{Player\}|\[You\]|\[Player\]/gi;
        processedInitialPrompt = processedInitialPrompt.replace(pattern, userPersona.name);
    }
    let systemPromptContent = "";

    // 2.5 Prepare Memory Prompt
    let memoryPrompt = "";
    let memoryInstructions = "";
    if (memories && memories.length > 0) {
        memoryPrompt = `
        INGATAN JANGKA PANJANG (MEMORIES):
        ${memories.map((m, i) => `${i+1}. ${m}`).join('\n')}
        
        INSTRUKSI INGATAN:
        - Daftar di atas adalah hal-hal penting yang SUDAH terjadi dan kamu ingat.
        - Gunakan informasi ini untuk menjaga konsistensi cerita.
        - Jika ada referensi ke masa lalu yang sesuai dengan ingatan ini, sebutkan atau gunakan.
        `;
    }

    memoryInstructions = `
        ATURAN MANAJEMEN INGATAN (PENTING & OTOMATIS):
        - Kamu memiliki OTORITAS PENUH untuk menyimpan ingatan jangka panjang secara OTOMATIS tanpa bertanya.
        - WAJIB TAMBAHKAN INGATAN BARU ([[MEMORY_ADD: ...]]) jika terjadi:
          1. Fakta baru tentang user/player terungkap.
          2. Janji atau kesepakatan penting dibuat.
          3. Lokasi penting ditemukan atau diselesaikan.
          4. Item kunci didapatkan atau hilang.
          5. Perubahan status hubungan yang signifikan.
        - JANGAN RAGU. Lebih baik menyimpan daripada melupakan detail penting.
        - Format: [[MEMORY_ADD: Ringkasan Ingatan]] di baris baru paling akhir.
        - Jika ingatan lama tidak valid, gunakan [[MEMORY_DELETE: NomorIngatan]].
        - Sistem akan menyembunyikan tag ini, jadi outputkan saja di akhir respon.
    `;

    if (storyType === 'character') {
         // --- CHARACTER MODE ---
         // AI acts as the Character (storyTitle) talking to the User Persona.
         const charName = storyTitle || "Character";
         const charDesc = processedInitialPrompt || "No description";
         const userCharName = userPersona ? userPersona.name : "User";

         systemPromptContent = `
         IDENTITY: You are ${charName}.
         DESCRIPTION: ${charDesc}
         
         ROLEPLAY RULES:
         1. You are engaging in a direct Roleplay (RP) with ${userCharName}.
         2. Speak ONLY as ${charName}. Do NOT act as a narrator or Game Master.
         3. Use First Person perspective ("I"). 
         4. Do NOT describe ${userCharName}'s actions, thoughts, or feelings. Only describe your own (${charName}).
         5. Interact naturally. If the description is in English, speak English. If Indonesian, speak Indonesian.
         6. KEEP THE LANGUAGE CONSISTENT. Detect language from the description/history and stick to it.
         7. RESPONSE FORMAT: Always use double quotes (") for spoken dialog.
         8. Response Length: Short to Medium (50-150 words). mimic chat pacing.
         
         CONTEXT:
         - User Persona: ${userPersona ? `${userPersona.name} - ${userPersona.description}` : "Unknown User"}
         - Current Situation: Refer to the message history.
         
         IMPORTANT:
         - Do NOT use "### CHAPTER". This is a chat, not a book.
         - Do NOT provide "Choices" list at the end. This is a free-form chat.
         - Just reply as the character.

         ${memoryInstructions}
         ${memoryPrompt}
         `;
    } else {
        // --- ADVENTURE/GAME MASTER MODE ---
        systemPromptContent = `Anda adalah Game Master untuk roleplay cerita interaktif. 
        Tugas anda:
        1. Lanjutkan cerita berdasarkan input player dan histori.
        2. Buat narasi 150-250 kata yang immersif, deskriptif, dan menarik.
        3. Di akhir, berikan TEPAT 3 pilihan aksi untuk player. Tidak lebih, tidak kurang.
        
        INSTRUKSI BAHASA (CRITICAL):
        - DETEKSI BAHASA UTAMA dari 'Initial Premise' atau 'First Message'.
        - JIKA Premis/Deskripsi dalam Bahasa Inggris -> GUNAKAN BAHASA INGGRIS SEPENUHNYA.
        - JIKA Premis/Deskripsi dalam Bahasa Indonesia -> GUNAKAN BAHASA INDONESIA SEPENUHNYA.
        - JANGAN PERNAH MENGGANTI BAHASA secara tiba-tiba meskipun ada istilah asing.
        INSTRUKSI BAHASA (CRITICAL):
        - DETEKSI BAHASA UTAMA dari 'Initial Premise' atau 'First Message'.
        - JIKA Premis/Deskripsi dalam Bahasa Inggris -> GUNAKAN BAHASA INGGRIS SEPENUHNYA.
        - JIKA Premis/Deskripsi dalam Bahasa Indonesia -> GUNAKAN BAHASA INDONESIA SEPENUHNYA.
        - JANGAN PERNAH MENGGANTI BAHASA secara tiba-tiba meskipun ada istilah asing.
        - Ikuti bahasa yang digunakan User di awal cerita.

        FORMAT DIALOG (CRITICAL):
        - GUNAKAN TANDA KUTIP DUA ("") UNTUK MENANDAI SEMUA UCAPAN/DIALOG KARAKTER.
        - Contoh: "Halo, apa kabar?" tanya Budi.
        - JANGAN gunakan tanda kutip satu (') atau tanpa tanda kutip untuk dialog/ucapan langsung.
        
        4. Genre cerita ini adalah: ${genres ? genres.join(", ") : "Bebas"}. Pastikan narasi dan tone sesuai dengan genre tersebut.
        5. Gaya Penulisan/Story Style: ${style || "Standard/Adaptive"}. Ikuti gaya ini dalam penulisan narasi.
        ${personaPrompt}
        6. PERINGATAN KERAS TENTANG PENGULANGAN: 
           - DILARANG KERAS mengulang kalimat, frasa, atau deskripsi yang SAMA PERSIS dengan 2-3 respon terakhir di 'Story History'.
           - Variasikan struktur kalimat (SPOK). Jangan memulai setiap kalimat dengan "Kamu..." atau nama karakter.
           - Jika sebelumnya sudah dideskripsikan suatu hal, JANGAN deskripsikan ulang dengan kata-kata yang sama. Lanjutkan plotnya.
        7. JANGAN memulai respon dengan merangkum kejadian terakhir (misal: "Setelah...", "Melihat hal itu..."). LANGSUNG ke aksi/konsekuensi berikutnya.
        
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
           
        JANGAN berikan penjelasan di luar cerita.

        ${assetsPrompt}
        ${memoryInstructions}
        ${memoryPrompt}`;
    }

    const messages = [
        new SystemMessage(systemPromptContent),
    ];

    if (processedInitialPrompt && (!history || history.length === 0)) {
       messages.push(new HumanMessage(`Start cerita dengan premis: ${processedInitialPrompt}`));
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
        story = story.replace(chapterMatch[0], "").trim();
    }

    // MEMORY PARSING AND UPDATE
    let updatedMemories = [...(memories || [])];
    let memoryUpdated = false;

    // Regex for ADD: [[MEMORY_ADD: ...]]
    const addRegex = /\[\[MEMORY_ADD:\s*(.*?)\]\]/gi;
    let addMatch;
    while ((addMatch = addRegex.exec(story)) !== null) {
        const newMemory = addMatch[1].trim();
        if (newMemory) {
            updatedMemories.push(newMemory);
            memoryUpdated = true;
        }
    }
    // Remove tags from story
    story = story.replace(addRegex, "").trim();

    // Regex for DELETE: [[MEMORY_DELETE: index]]
    const deleteRegex = /\[\[MEMORY_DELETE:\s*(\d+)\]\]/gi;
    let deleteMatches = [];
    let delMatch;
    while ((delMatch = deleteRegex.exec(story)) !== null) {
        deleteMatches.push(parseInt(delMatch[1]));
    }
    
    // Process deletions (sort descending to avoid index shift issues)
    if (deleteMatches.length > 0) {
        deleteMatches.sort((a, b) => b - a);
        deleteMatches.forEach(idx => {
            const arrayIndex = idx - 1; // Convert 1-based index to 0-based
            if (arrayIndex >= 0 && arrayIndex < updatedMemories.length) {
                updatedMemories.splice(arrayIndex, 1);
                memoryUpdated = true;
            }
        });
        story = story.replace(deleteRegex, "").trim();
    }

    // Save to Firestore if changed
    if (memoryUpdated && userId && storyId && adminDb) {
        try {
            await adminDb.collection("users").doc(userId).collection("stories").doc(storyId).update({
                memories: updatedMemories
            });
        } catch (e) {
            console.error("Failed to update memories", e);
        }
    }

    return NextResponse.json({ story, choices, chapter: chapterMetadata, memories: updatedMemories });

  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
