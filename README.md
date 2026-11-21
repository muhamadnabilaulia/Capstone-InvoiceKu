# Capstone - IBMxHacktive - AI for Programming

# InvoiceKu

A simple and professional invoice management web app built for the IBM x Hacktiv8 AI for Programming capstone project.

## Features

- Create, view, edit, and delete invoices (CRUD)
- Auto-generated invoice number (INV-YEAR-0001)
- Dynamic line items with automatic subtotal, discount, VAT, and grand total
- Rupiah currency formatting
- Form validation
- Responsive design
- Data saved in the browser (localStorage)

## Tech Stack

- HTML5
- Tailwind CSS (CDN)
- Vanilla JavaScript

## Project Structure

```
├── index.html
├── style.css
├── script.js
└── README.md
```

## How to Run

1. Clone this repository:
   ```
   https://github.com/muhamadnabilaulia/Capstone-InvoiceKu.git
   ```
2. Open `index.html` in your browser.

No installation needed.

## Prompt Used (IBM Bob)
This project was generated with IBM Bob using the following prompt:

```
Anda adalah seorang Senior Full Stack Engineer yang berpengalaman membangun website modern menggunakan HTML5, Tailwind CSS, dan Vanilla JavaScript. Tugas Anda adalah menghasilkan kode yang clean, modular, mudah dipahami, mengikuti best practice frontend, serta siap dijalankan. Proyek ini adalah capstone bootcamp berupa aplikasi pembuat invoice yang sederhana, dan profesional dengan target pengguna freelancer dan UMKM.

Buat sebuah website bernama 'InvoiceKu' menggunakan HTML, Tailwind CSS dan Vanilla JavaScript (tanpa framework). Pisahkan kode ke dalam tiga file, yaitu: index.html, style.css dan script.js. Website harus memiliki fitur CRUD (Create, Read, Update, Delete) untuk mengelola invoice. Setiap invoice memiliki nomor otomatis berurutan (format INV-TAHUN-0001), tanggal terbit dan jatuh tempo, informasi penerbit dan klien, item baris dinamis (deskripsi, qty, harga satuan, subtotal), perhitungan otomatis untuk subtotal, diskon, PPN (default 11%), dan grand total, catatan atau syarat pembayaran, serta status Draft, Terkirim, Lunas, dan Jatuh Tempo (otomatis jika melewati due date dan belum lunas). Sediakan juga ringkasan dashboard, pencarian, filter status, sortir, cetak atau simpan PDF melalui window.print(), format mata uang Rupiah, validasi form dengan pesan error yang jelas, dan empty state, semuanya bekerja secara dinamis tanpa me-refresh halaman.

Buat tampilan yang modern, minimalis, profesional, responsif (mobile-first), dengan kombinasi warna utama indigo, putih, dan aksen oranye. Gunakan komponen seperti card container, rounded corner, soft shadow, hover effect, smooth transition, badge status berwarna, serta ikon sederhana bila diperlukan. Terapkan HTML semantik, gunakan Tailwind CSS sebagai styling utama dengan style.css hanya untuk styling tambahan (animasi kustom dan tampilan print), dan gunakan Vanilla JavaScript tanpa library lain. Pastikan penamaan variabel dan fungsi jelas, berikan komentar pada bagian penting, hindari kode yang tidak digunakan, cegah celah XSS dengan meng-escape input user, tangani error localStorage, serta hasilkan kode yang rapi, mudah dipelajari, bebas error, dan seluruh fitur berfungsi dengan baik. Tampilkan hasil berupa struktur folder singkat, kode lengkap ketiga file dalam blok kode terpisah tanpa bagian yang dilewati, cara menjalankan, dan checklist pengujian manual.
```

## Author

Muhamad Nabil Aulia ([@muhamadnabilaulia](https://github.com/muhamadnabilaulia))
