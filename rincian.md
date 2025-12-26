# Rincian Proyek: Project Tales

Dokumen ini berisi informasi mengenai inti proyek, fitur-fitur yang tersedia, dan struktur database yang digunakan.

## 1. Inti Proyek

**Project Tales** adalah aplikasi web berbasis AI yang memungkinkan pengguna untuk membuat dan memainkan cerita interaktif (Roleplay/Choose Your Own Adventure). Aplikasi ini bertindak sebagai "Game Master" yang memandu narasi, memberikan pilihan kepada pemain, dan merespons tindakan pemain menggunakan model bahasa besar (LLM).

**Teknologi Utama:**

- **Frontend**: Next.js (React), TailwindCSS
- **Backend/API**: Next.js API Routes
- **Database & Auth**: Firebase (Firestore & Authentication)
- **AI Engine**: Mistral AI (via LangChain)

## 2. Fitur-Fitur

### Autentikasi Pengguna

- Login dan Registrasi pengguna (menggunakan Firebase Auth).
- Manajemen sesi pengguna.

### Manajemen Cerita (Dashboard)

- **Buat Cerita Baru**: Pengguna dapat memulai cerita baru dengan menentukan Judul, Ide Awal (Premis), dan Genre.
- **List Cerita**: Menampilkan daftar cerita yang telah dibuat oleh pengguna.
- **Hapus Cerita**: Kemampuan untuk menghapus cerita yang sudah tidak diinginkan.

### Gameplay / Interaksi Cerita

- **Narasi AI**: AI men-generate kelanjutan cerita berdasarkan input atau pilihan pemain.
- **Pilihan Aksi (Choices)**: AI secara otomatis memberikan 3-5 opsi tindakan yang bisa diambil pemain di setiap giliran.
- **Regenerate Choices**: Fitur untuk meminta AI membuat ulang daftar pilihan jika pemain tidak puas dengan opsi yang ada.
- **Histori Chat**: Riwayat percakapan (narasi dan aksi pemain) tersimpan sehingga cerita dapat dilanjutkan kapan saja.

## 3. Struktur Database (Firestore)

Database menggunakan **Cloud Firestore**. Data disimpan secara hierarkis di bawah setiap _user_ untuk menjaga privasi dan keamanan data per pengguna.

### Path: `users/{userId}/stories/{storyId}`

Setiap dokumen cerita memiliki field sebagai berikut:

| Field           | Tipe Data      | Deskripsi                                           |
| :-------------- | :------------- | :-------------------------------------------------- |
| `title`         | String         | Judul cerita.                                       |
| `initialPrompt` | String         | Ide awal atau premis cerita yang diinput pengguna.  |
| `genres`        | Array [String] | Daftar genre yang dipilih (misal: Fantasy, Sci-Fi). |
| `createdAt`     | Timestamp      | Waktu pembuatan cerita.                             |
| `history`       | Array [Object] | Riwayat percakapan cerita.                          |

**Detail Objek dalam Array `history`:**
Setiap item dalam array history merepresentasikan satu giliran percakapan, biasanya berisi:

- `role`: 'user' (pemain) atau 'model' (AI).
- `content`: Isi teks narasi atau aksi.
