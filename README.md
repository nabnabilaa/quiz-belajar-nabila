# 🍎 Academy Quiz Prep — dwibahasa (EN + ID) + skor di Aiven MySQL

Latihan soal gaya tes masuk **Apple Developer Academy Indonesia**: 1000 soal Logika + 1000 soal
Programming, dipotong jadi 20 sesi × 50 soal per topik. Setiap soal, opsi, dan **penjelasan
jawaban** tampil **Inggris + Indonesia di halaman yang sama**. Tanpa timer.

Ada **dua cara pakai**:

---

## ① Cara cepat (tanpa server, skor di perangkat saja)
Buka file **`public/academy_quiz.html`** dengan dobel‑klik di browser. Langsung jalan, offline,
tanpa apa pun. Skor tersimpan di browser (localStorage) — hanya di perangkat itu.

## ② Cara dengan Aiven (skor tersimpan di database, bisa lintas perangkat)
Skor disimpan ke database MySQL milikmu di Aiven lewat server kecil di folder ini.

---

## 🔐 PENTING — amankan password dulu
Kamu sempat menempelkan password database di percakapan. Anggap **sudah bocor**.
1. Buka Aiven → service MySQL kamu → tab **Users** → **avnadmin** → **Reset password**.
2. Pakai **password baru** itu di langkah di bawah. Jangan pernah menaruh password di dalam kode
   atau membagikannya. Password hanya ada di file `.env` (yang tidak ikut dibagikan).

---

## 🚀 Langkah menjalankan server

**Syarat:** Node.js versi 18 ke atas. Cek dengan `node -v`. Kalau belum ada, install dari nodejs.org.

1. **Masuk ke folder ini** lewat Terminal:
   ```bash
   cd academy-quiz
   ```

2. **Install dependency:**
   ```bash
   npm install
   ```

3. **Siapkan kredensial.** Salin contoh env lalu isi:
   ```bash
   cp .env.example .env
   ```
   Buka `.env`, lalu isi **`MYSQL_PASSWORD=`** dengan password **baru** dari Aiven.
   (Host, port, user, dan database sudah terisi sesuai punyamu. Cek lagi kalau berubah.)

4. **Ambil sertifikat CA.** Di konsol Aiven, di halaman *Connection information*, bagian
   **CA certificate** → klik **Show/Download**. Simpan isinya sebagai file bernama **`ca.pem`**
   di dalam folder `academy-quiz` ini (sejajar dengan `server.js`).

5. **Jalankan:**
   ```bash
   npm start
   ```
   Kalau berhasil muncul: `✅ Academy Quiz running: http://localhost:3000`.

6. **Buka di browser:** http://localhost:3000
   Isi kolom **Nama / Name** di atas (mis. `riyan`). Skor terbaik tiap sesi otomatis tersimpan
   ke database. Lencana **☁︎ Cloud (Aiven)** berarti tersambung; **● Saved on this device**
   berarti sedang memakai penyimpanan lokal (server mati/koneksi gagal).

---

## 🧮 Skor disimpan di mana?
Di tabel **`quiz_scores`** pada database `defaultdb`. Server membuat tabelnya otomatis.
Lihat isinya kapan saja (mis. lewat Aiven Query Editor atau klien MySQL):

```sql
SELECT player, topic, session_no, best_score, total, updated_at
FROM quiz_scores
ORDER BY topic, session_no;
```

Tiap baris = skor **terbaik** seorang pemain untuk satu topik+sesi. Kalau kamu mengulang sesi dan
skornya lebih tinggi, baris itu diperbarui; kalau lebih rendah, yang lama tetap dipertahankan.

---

## 🛠️ Cek koneksi
- `http://localhost:3000/api/health` → `{ "ok": true, "db": true }` artinya database tersambung.
- Kalau server gagal start, baca pesan di Terminal: biasanya `.env` belum lengkap atau `ca.pem`
  belum ada / salah isi.

## 📁 Isi folder
```
academy-quiz/
├─ server.js            ← server Express + MySQL (skor)
├─ package.json
├─ .env.example         ← contoh; salin jadi .env lalu isi password
├─ schema.sql           ← struktur tabel (dibuat otomatis juga)
├─ ca.pem               ← (kamu tambahkan) sertifikat CA dari Aiven
└─ public/
   ├─ academy_quiz.html ← aplikasi kuis (dwibahasa)
   └─ question_bank.json← bank soal (2000 soal)
```

Catatan: file `.env` dan `ca.pem` sengaja diabaikan oleh `.gitignore` supaya rahasia tidak bocor.
