Project Tales - AI Interactive Storytelling
===========================================

Project ini adalah web app roleplay interaktif dimana user bisa membuat cerita sendiri dan bermain dengan AI yang bertindak sebagai Game Master.

Fitur Utama:
- Buat cerita dengan initial prompt bebas.
- AI (Mistral) generate narasi lanjutan secara otomatis.
- Player diberikan 3-5 pilihan aksi setiap turn.
- Simpan progress cerita dan history chat (Firestore).
- Login/Register untuk menyimpan cerita pribadi.

Persyaratan System:
- Node.js 18+
- Akun Firebase (untuk Auth & Firestore)
- API Key Mistral AI (La Plateforme)

Cara Setup Project:

1. Clone Repository & Install Dependencies
   ---------------------------------------
   Buka terminal di folder project dan jalankan:
   $ npm install

2. Konfigurasi Environment Variables
   ---------------------------------
   Buat file bernama .env.local di root folder.
   Copy format berikut dan isi dengan key anda sendiri:

   NEXT_PUBLIC_FIREBASE_API_KEY=xxx
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
   NEXT_PUBLIC_FIREBASE_APP_ID=xxx
   
   MISTRAL_API_KEY=xxx
   
   (Optional - Jika ingin strict mode)
   FIREBASE_CLIENT_EMAIL=xxx
   FIREBASE_PRIVATE_KEY=xxx

3. Konfigurasi Mistral AI
   ----------------------
   - Daftar akun di https://console.mistral.ai/ (La Plateforme).
   - Masuk ke menu "API Keys".
   - Generate Key baru dan copy.
   - Paste key tersebut ke variabel MISTRAL_API_KEY di file .env.local.
   - Pastikan anda memiliki kredit atau subscription yang aktif (free tier tersedia).

4. Konfigurasi Firebase Firestore
   ------------------------------
   Masuk ke Firebase Console > Firestore Database > Rules.
   Ubah rules menjadi berikut agar user bisa save data:

   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }

5. Jalankan Aplikasi
   -----------------
   $ npm run dev

   Buka browser di http://localhost:3000.

Tech Stack:
- Next.js 14 (App Router)
- Tailwind CSS
- Firebase (Auth, Firestore)
- LangChain.js (AI Orchestration)
- Mistral AI (LLM)
