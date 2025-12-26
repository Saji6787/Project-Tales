Aku ingin kamu membuat:
Fitur Baru yang Harus Diimplementasikan: "Assets" untuk World-Building.

- Assets: Elemen seperti location (tempat), character (tokoh), faction (kelompok), custom (bebas, misal artefak/event).
- Aturan: Assets HANYA bisa dibuat saat proses create story baru (di halaman buat cerita), bersifat OPSIONAL (user bisa skip sepenuhnya). Tidak bisa ditambah/edit setelah cerita dimulai. Assets eksklusif per cerita (tidak reusable lintas cerita, tidak ada import/export).
- Fungsi: Assets diinject ke prompt AI sebagai context opsional ("gunakan jika relevan") untuk bikin cerita lebih koheren. Jika no assets, cerita tetap jalan normal.
- Batas: Maksimal 10-15 assets per story (validasi di form).

User Flow untuk Create Story Baru:

1. Halaman /stories/new: Form dasar WAJIB - Title, Initial Prompt (premis), Genres (multi-select atau tags).
2. Section OPSIONAL: Tombol "See more details" atau "Advanced setup +" (accordion/collapse). Saat diklik, muncul form untuk tambah assets:
   - Dropdown type: location, character, faction, custom.
   - Fields: name (required), description (required), customType (jika custom), properties (map/object opsional, misal traits array).
   - Beri contoh di form: "Contoh Character: Name = Elara, Description = Penyihir muda yang takut kegelapan, Traits = pintar, pemalu."
   - Tombol "Add another asset" untuk tambah lebih.
   - Tombol "Skip advanced setup" jika user ingin kembali ke form dasar.
3. Tombol "Start Story": Validasi (max 15 assets), simpan story + assets ke DB, lalu generate bagian pertama cerita (inject assets ke prompt), simpan ke history, redirect ke play page.

Struktur Database Firestore (extend existing):

- Dokumen story: users/{userId}/stories/{storyId} - fields tetap seperti existing (title, initialPrompt, genres, createdAt, history).
- Subkoleksi assets: users/{userId}/stories/{storyId}/assets/{assetId} (assetId = UUID).
  Fields per asset doc:
  - type: string ('location', 'character', 'faction', 'custom') - required.
  - name: string - required.
  - description: string - required.
  - customType: string - opsional (hanya jika type='custom').
  - properties: map/object - opsional (misal {traits: ['pemberani'], backstory: '...' }).
  - createdAt: timestamp.
  - updatedAt: timestamp.

Integrasi AI (Mistral via LangChain.js):

- Saat generate cerita (di /api/generate atau create): Fetch semua assets dari subkoleksi assets.
- Format assetsContext: "Gunakan elemen dunia berikut jika relevan: \n[daftar seperti LOCATION: Hutan Terlarang - Deskripsi... \nDetail: {properties JSON}]".
- Inject ke prompt: "${assetsContext} \nPremis: {initialPrompt} \nHistori: {history} \nLanjutkan cerita 150-250 kata + 3-5 pilihan. Format output strict."

Bantu saya implementasikan fitur ini step-by-step:

1. Update halaman create story (/stories/new): Kode React untuk form dasar + accordion advanced dengan form assets (state lokal array assets).
2. API route baru: /api/stories/create (POST {title, initialPrompt, genres, assets: []}) - buat story doc, batch buat assets di subkoleksi, generate first narasi (inject assets), simpan ke history.
3. Update /api/generate: Tambah fetch assets dan inject ke prompt.
4. Validasi: Di frontend/backend, batas max 15 assets.
5. Firestore rules: Pastikan inherit ke subkoleksi assets.

Jawab dengan code snippet lengkap (TypeScript), jelaskan setiap langkah, dan pastikan aman (verify auth di API).
