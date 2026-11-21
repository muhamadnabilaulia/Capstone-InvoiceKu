/**
 * ============================================================
 * InvoiceKu — script.js
 * Aplikasi manajemen invoice SPA menggunakan Vanilla JavaScript
 * Data disimpan di localStorage browser.
 * ============================================================
 */

"use strict";

/* ----------------------------------------------------------
   1. KONSTANTA & STATE GLOBAL
   ---------------------------------------------------------- */

const STORAGE_KEY = "invoiceku_data";
const TAX_DEFAULT = 11; // PPN default 11%

/**
 * State aplikasi — satu-satunya sumber kebenaran (single source of truth).
 * @type {{ invoices: Array, currentPage: string }}
 */
let appState = {
  invoices: [],
  currentPage: "dashboard",
};

/** ID invoice yang sedang akan dihapus (untuk konfirmasi dialog) */
let pendingDeleteId = null;

/* ----------------------------------------------------------
   2. UTILITAS
   ---------------------------------------------------------- */

/**
 * Escape karakter HTML untuk mencegah XSS.
 * Selalu gunakan fungsi ini sebelum menyisipkan input user ke innerHTML.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Format angka ke format mata uang Rupiah.
 * @param {number} amount
 * @returns {string} contoh: "Rp 1.500.000"
 */
function formatRupiah(amount) {
  if (isNaN(amount) || amount === null) return "Rp 0";
  return "Rp " + Math.round(amount).toLocaleString("id-ID");
}

/**
 * Format tanggal dari YYYY-MM-DD ke DD MMM YYYY.
 * @param {string} dateStr
 * @returns {string} contoh: "15 Jan 2026"
 */
function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Mendapatkan tanggal hari ini dalam format YYYY-MM-DD.
 * @returns {string}
 */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Generate ID unik sederhana.
 * @returns {string}
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ----------------------------------------------------------
   3. PENYIMPANAN DATA (localStorage)
   ---------------------------------------------------------- */

/**
 * Memuat data invoice dari localStorage ke appState.
 */
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      appState.invoices = Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.error("InvoiceKu: Gagal membaca localStorage.", e);
    appState.invoices = [];
  }
}

/**
 * Menyimpan array invoice saat ini ke localStorage.
 */
function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.invoices));
  } catch (e) {
    // Tangani QuotaExceededError atau error lainnya
    console.error("InvoiceKu: Gagal menyimpan ke localStorage.", e);
    showToast("error", "Penyimpanan penuh. Hapus beberapa invoice lama.");
  }
}

/* ----------------------------------------------------------
   4. STATUS OTOMATIS (OVERDUE CHECK)
   ---------------------------------------------------------- */

/**
 * Periksa semua invoice: jika due date sudah lewat dan status bukan "Lunas",
 * ubah status menjadi "Jatuh Tempo" secara otomatis.
 * Dipanggil saat app dimuat dan setiap render.
 */
function checkOverdueStatus() {
  const today = todayISO();
  let changed = false;
  appState.invoices.forEach((inv) => {
    if (
      inv.status !== "Lunas" &&
      inv.status !== "Jatuh Tempo" &&
      inv.dueDate < today
    ) {
      inv.status = "Jatuh Tempo";
      changed = true;
    }
  });
  if (changed) saveData();
}

/* ----------------------------------------------------------
   5. PENOMORAN OTOMATIS INVOICE
   ---------------------------------------------------------- */

/**
 * Generate nomor invoice berikutnya dengan format INV-YYYY-NNNN.
 * Nomor urut berdasarkan jumlah invoice di tahun berjalan + 1.
 * @returns {string} contoh: "INV-2026-0003"
 */
function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const thisYearInvoices = appState.invoices.filter((inv) =>
    inv.number.startsWith(`INV-${year}-`),
  );
  const nextSeq = thisYearInvoices.length + 1;
  return `INV-${year}-${String(nextSeq).padStart(4, "0")}`;
}

/* ----------------------------------------------------------
   6. NAVIGASI HALAMAN (SPA)
   ---------------------------------------------------------- */

/**
 * Tampilkan halaman tertentu dan sembunyikan yang lain.
 * @param {'dashboard'|'invoices'} pageName
 */
function showPage(pageName) {
  appState.currentPage = pageName;

  // Sembunyikan semua section
  document
    .querySelectorAll(".page-section")
    .forEach((el) => el.classList.add("hidden"));

  // Tampilkan section yang diminta
  const target = document.getElementById(`page-${pageName}`);
  if (target) {
    target.classList.remove("hidden");
    target.classList.add("animate-card-enter");
    setTimeout(() => target.classList.remove("animate-card-enter"), 300);
  }

  // Update state aktif nav button (desktop & mobile)
  document
    .querySelectorAll(".nav-btn")
    .forEach((btn) => btn.classList.remove("active"));
  const desktopBtn = document.getElementById(`nav-${pageName}`);
  const mobileBtn = document.getElementById(`nav-${pageName}-m`);
  if (desktopBtn) desktopBtn.classList.add("active");
  if (mobileBtn) mobileBtn.classList.add("active");

  // Render konten halaman
  if (pageName === "dashboard") renderDashboard();
  if (pageName === "invoices") renderList();
}

/* ----------------------------------------------------------
   7. DASHBOARD — RENDER
   ---------------------------------------------------------- */

/**
 * Render ringkasan statistik dan daftar invoice terbaru di dashboard.
 */
function renderDashboard() {
  checkOverdueStatus();

  const invoices = appState.invoices;
  const total = invoices.length;
  const paid = invoices.filter((i) => i.status === "Lunas").length;
  const overdue = invoices.filter((i) => i.status === "Jatuh Tempo").length;
  const unpaid = invoices.filter((i) => i.status !== "Lunas").length;

  const revenue = invoices
    .filter((i) => i.status === "Lunas")
    .reduce((s, i) => s + i.grandTotal, 0);
  const outstanding = invoices
    .filter((i) => i.status !== "Lunas")
    .reduce((s, i) => s + i.grandTotal, 0);

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-paid").textContent = paid;
  document.getElementById("stat-overdue").textContent = overdue;
  document.getElementById("stat-unpaid").textContent = unpaid;
  document.getElementById("stat-revenue").textContent = formatRupiah(revenue);
  document.getElementById("stat-outstanding").textContent =
    formatRupiah(outstanding);

  // 5 invoice terbaru
  const recent = [...invoices]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);
  const container = document.getElementById("dashboard-recent");

  if (recent.length === 0) {
    container.innerHTML = `
      <div class="empty-state py-8">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <p class="text-sm">Belum ada invoice. Buat invoice pertama Anda!</p>
      </div>`;
    return;
  }

  container.innerHTML = recent
    .map(
      (inv) => `
    <div class="flex items-center justify-between py-3 border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 rounded-lg px-2 transition-colors"
         onclick="viewInvoice('${escapeHtml(inv.id)}')">
      <div>
        <p class="text-sm font-semibold text-slate-700">${escapeHtml(inv.number)}</p>
        <p class="text-xs text-slate-400">${escapeHtml(inv.clientName)}</p>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-sm font-medium text-slate-700">${formatRupiah(inv.grandTotal)}</span>
        <span class="${badgeClass(inv.status)}">${escapeHtml(inv.status)}</span>
      </div>
    </div>`,
    )
    .join("");
}

/* ----------------------------------------------------------
   8. INVOICE LIST — RENDER
   ---------------------------------------------------------- */

/**
 * Render daftar invoice dengan search, filter, dan sort yang aktif.
 */
function renderList() {
  checkOverdueStatus();

  const searchVal = (document.getElementById("search-input")?.value || "")
    .toLowerCase()
    .trim();
  const filterVal = document.getElementById("filter-status")?.value || "";
  const sortVal = document.getElementById("sort-by")?.value || "date-desc";

  let list = [...appState.invoices];

  // Filter pencarian (nomor atau nama klien)
  if (searchVal) {
    list = list.filter(
      (inv) =>
        inv.number.toLowerCase().includes(searchVal) ||
        inv.clientName.toLowerCase().includes(searchVal),
    );
  }

  // Filter status
  if (filterVal) {
    list = list.filter((inv) => inv.status === filterVal);
  }

  // Sorting
  list.sort((a, b) => {
    switch (sortVal) {
      case "date-asc":
        return a.createdAt - b.createdAt;
      case "date-desc":
        return b.createdAt - a.createdAt;
      case "amount-desc":
        return b.grandTotal - a.grandTotal;
      case "amount-asc":
        return a.grandTotal - b.grandTotal;
      case "client-asc":
        return a.clientName.localeCompare(b.clientName, "id");
      default:
        return b.createdAt - a.createdAt;
    }
  });

  const container = document.getElementById("invoice-list");

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state bg-white rounded-xl border border-slate-100 shadow-sm">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <p class="text-base font-semibold mt-2 text-slate-500">Tidak ada invoice ditemukan</p>
        <p class="text-sm mt-1">${appState.invoices.length === 0 ? 'Klik "Buat Invoice" untuk membuat invoice pertama Anda.' : "Coba ubah filter atau kata kunci pencarian."}</p>
      </div>`;
    return;
  }

  container.innerHTML = list
    .map(
      (inv, idx) => `
    <div class="invoice-card bg-white rounded-xl border border-slate-100 shadow-sm p-4 sm:p-5 animate-card-enter"
         style="animation-delay: ${idx * 0.04}s">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <!-- Left: Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-bold text-indigo-700">${escapeHtml(inv.number)}</span>
            <span class="${badgeClass(inv.status)}">${escapeHtml(inv.status)}</span>
          </div>
          <p class="text-base font-semibold text-slate-800 mt-0.5 truncate">${escapeHtml(inv.clientName)}</p>
          <p class="text-xs text-slate-400 mt-0.5">
            Terbit: ${formatDate(inv.date)} &nbsp;·&nbsp; Jatuh Tempo: ${formatDate(inv.dueDate)}
          </p>
        </div>
        <!-- Right: Amount + Actions -->
        <div class="flex items-center gap-3 flex-shrink-0">
          <div class="text-right">
            <p class="text-xs text-slate-400">Grand Total</p>
            <p class="text-base font-bold text-slate-800">${formatRupiah(inv.grandTotal)}</p>
          </div>
          <!-- Action Buttons -->
          <div class="flex items-center gap-1">
            <!-- View -->
            <button onclick="viewInvoice('${escapeHtml(inv.id)}')"
              title="Lihat Detail"
              class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
            </button>
            <!-- Edit -->
            <button onclick="openEditForm('${escapeHtml(inv.id)}')"
              title="Edit"
              class="p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            <!-- Delete -->
            <button onclick="confirmDelete('${escapeHtml(inv.id)}')"
              title="Hapus"
              class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>`,
    )
    .join("");
}

/* ----------------------------------------------------------
   9. BADGE STATUS
   ---------------------------------------------------------- */

/**
 * Kembalikan kelas CSS badge berdasarkan status invoice.
 * @param {string} status
 * @returns {string}
 */
function badgeClass(status) {
  const map = {
    Draft: "badge badge-draft",
    Terkirim: "badge badge-terkirim",
    Lunas: "badge badge-lunas",
    "Jatuh Tempo": "badge badge-jatuh-tempo",
  };
  return map[status] || "badge badge-draft";
}

/* ----------------------------------------------------------
   10. LINE ITEMS — DYNAMIC ROWS
   ---------------------------------------------------------- */

/** Counter untuk ID unik setiap baris item */
let lineItemCounter = 0;

/**
 * Tambahkan satu baris item baru ke form.
 * @param {object} [data] - Data pre-fill saat edit (opsional)
 */
function addLineItem(data = {}) {
  lineItemCounter++;
  const id = `item-${lineItemCounter}`;
  const container = document.getElementById("line-items-container");

  const desc = escapeHtml(data.description || "");
  const qty = data.qty || 1;
  const price = data.price || 0;
  const subtotal = qty * price;

  /**
   * Format angka ke string dengan pemisah ribuan (tanpa "Rp ").
   * Digunakan khusus untuk tampilan input Harga Satuan.
   * Contoh: 20000000 → "20.000.000"
   */
  const formatThousands = (n) =>
    n ? Math.round(n).toLocaleString("id-ID") : "";

  const row = document.createElement("div");
  row.id = id;
  // item-row-grid membagi 5 kolom di desktop; item-card-mobile menjadi card di mobile
  row.className = "item-row-grid animate-card-enter";
  row.innerHTML = `
    <!-- Kolom 1: Deskripsi -->
    <div class="item-card-mobile">
      <label class="item-mobile-label">Deskripsi</label>
      <input type="text" placeholder="Deskripsi layanan/barang" value="${desc}"
        class="form-input item-desc" oninput="recalculate()" />
    </div>

    <!-- Kolom 2: Qty -->
    <div class="item-card-mobile">
      <label class="item-mobile-label">Qty</label>
      <input type="number" min="1" value="${qty}" placeholder="1"
        class="form-input item-qty text-center" oninput="recalculate()" />
    </div>

    <!-- Kolom 3: Harga Satuan
         item-price (hidden) = nilai numerik murni yang dibaca recalculate() & getLineItemsFromForm()
         item-price-display  = input teks dengan pemisah ribuan yang terlihat user -->
    <div class="item-card-mobile">
      <label class="item-mobile-label">Harga Satuan</label>
      <input type="hidden" class="item-price" value="${price}" />
      <input type="text" inputmode="numeric" placeholder="0"
        value="${formatThousands(price)}"
        class="form-input item-price-display text-right"
        oninput="syncPrice(this)" />
    </div>

    <!-- Kolom 4: Subtotal (desktop) / baris bawah (mobile) -->
    <div class="item-subtotal-wrap">
      <span class="item-subtotal-label">Subtotal</span>
      <span class="item-subtotal text-sm font-semibold text-slate-700 whitespace-nowrap">${formatRupiah(subtotal)}</span>
      <!-- Tombol hapus muncul di sini hanya pada mobile (di desktop ada kolom tersendiri) -->
      <button type="button" onclick="removeLineItem('${id}')"
        title="Hapus item"
        class="item-delete-mobile sm:hidden ml-auto p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
      </button>
    </div>

    <!-- Kolom 5: Tombol Hapus (desktop only, disembunyikan di mobile) -->
    <div class="hidden sm:flex items-center justify-center pt-1">
      <button type="button" onclick="removeLineItem('${id}')"
        title="Hapus item"
        class="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
      </button>
    </div>`;

  container.appendChild(row);
  recalculate();
}

/**
 * Hapus baris item berdasarkan ID elemennya.
 * @param {string} rowId
 */
function removeLineItem(rowId) {
  const row = document.getElementById(rowId);
  if (row) row.remove();
  recalculate();
}

/**
 * Sinkronisasi nilai dari input display (dengan pemisah ribuan) ke hidden input numerik,
 * lalu panggil recalculate(). Dipanggil via oninput pada item-price-display.
 * @param {HTMLInputElement} displayInput - Elemen input teks yang terlihat user
 */
function syncPrice(displayInput) {
  // Hapus semua karakter non-digit dari tampilan
  const raw = displayInput.value.replace(/\D/g, "");
  const numeric = raw ? parseInt(raw, 10) : 0;

  // Update hidden input (dibaca oleh recalculate & getLineItemsFromForm)
  const hiddenInput = displayInput.closest("div").querySelector(".item-price");
  if (hiddenInput) hiddenInput.value = numeric;

  // Format ulang tampilan dengan pemisah ribuan (hanya jika ada nilai)
  // Simpan posisi cursor agar tidak melompat ke ujung
  const cursorPos = displayInput.selectionStart;
  const prevLen = displayInput.value.length;
  displayInput.value = numeric ? numeric.toLocaleString("id-ID") : "";
  const newLen = displayInput.value.length;
  // Sesuaikan posisi cursor setelah format ulang
  const diff = newLen - prevLen;
  try {
    displayInput.setSelectionRange(cursorPos + diff, cursorPos + diff);
  } catch (_) {}

  recalculate();
}

/**
 * Hitung ulang subtotal tiap item, subtotal total, diskon, PPN, dan grand total.
 * Dipanggil setiap kali ada perubahan pada item atau field perhitungan.
 */
function recalculate() {
  const container = document.getElementById("line-items-container");
  if (!container) return;

  let subtotalSum = 0;

  // Hitung subtotal per baris
  container.querySelectorAll('div[id^="item-"]').forEach((row) => {
    const qty = parseFloat(row.querySelector(".item-qty")?.value) || 0;
    const price = parseFloat(row.querySelector(".item-price")?.value) || 0;
    const sub = qty * price;
    subtotalSum += sub;
    const subtotalEl = row.querySelector(".item-subtotal");
    if (subtotalEl) subtotalEl.textContent = formatRupiah(sub);
  });

  // Diskon
  const discountPct =
    parseFloat(document.getElementById("form-discount")?.value) || 0;
  const discountAmt = subtotalSum * (discountPct / 100);

  // PPN
  const taxPct = parseFloat(document.getElementById("form-tax")?.value) || 0;
  const taxAmt = (subtotalSum - discountAmt) * (taxPct / 100);

  // Grand Total
  const grandTotal = subtotalSum - discountAmt + taxAmt;

  // Update tampilan
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set("calc-subtotal", formatRupiah(subtotalSum));
  set("calc-discount", `- ${formatRupiah(discountAmt)}`);
  set("calc-tax", `+ ${formatRupiah(taxAmt)}`);
  set("calc-grand-total", formatRupiah(grandTotal));
}

/* ----------------------------------------------------------
   11. FORM — BUKA / TUTUP
   ---------------------------------------------------------- */

/**
 * Buka form dalam mode "Buat Invoice Baru".
 */
function openCreateForm() {
  resetForm();
  document.getElementById("modal-title").textContent = "Buat Invoice Baru";
  document.getElementById("form-number").value = generateInvoiceNumber();
  document.getElementById("form-date").value = todayISO();

  // Default due date = 14 hari ke depan
  const due = new Date();
  due.setDate(due.getDate() + 14);
  document.getElementById("form-due-date").value = due
    .toISOString()
    .slice(0, 10);

  document.getElementById("form-tax").value = TAX_DEFAULT;
  document.getElementById("form-discount").value = 0;

  // Sembunyikan tombol "Tandai Lunas" — tidak relevan saat membuat invoice baru
  document.getElementById("btn-mark-paid")?.classList.add("hidden");

  addLineItem(); // Satu baris kosong secara default
  showModal("modal-form");
}

/**
 * Buka form dalam mode "Edit Invoice".
 * @param {string} id - ID invoice yang akan diedit
 */
function openEditForm(id) {
  const inv = appState.invoices.find((i) => i.id === id);
  if (!inv) return;

  resetForm();
  document.getElementById("modal-title").textContent =
    `Edit Invoice ${escapeHtml(inv.number)}`;
  document.getElementById("form-edit-id").value = inv.id;
  document.getElementById("form-number").value = inv.number;
  document.getElementById("form-date").value = inv.date;
  document.getElementById("form-due-date").value = inv.dueDate;

  // Issuer
  document.getElementById("form-issuer-name").value = inv.issuerName || "";
  document.getElementById("form-issuer-email").value = inv.issuerEmail || "";
  document.getElementById("form-issuer-phone").value = inv.issuerPhone || "";
  document.getElementById("form-issuer-address").value =
    inv.issuerAddress || "";

  // Client
  document.getElementById("form-client-name").value = inv.clientName || "";
  document.getElementById("form-client-email").value = inv.clientEmail || "";
  document.getElementById("form-client-phone").value = inv.clientPhone || "";
  document.getElementById("form-client-address").value =
    inv.clientAddress || "";

  // Diskon, PPN, Status, Catatan
  document.getElementById("form-discount").value = inv.discountPct || 0;
  document.getElementById("form-tax").value =
    inv.taxPct !== undefined ? inv.taxPct : TAX_DEFAULT;
  document.getElementById("form-status").value =
    inv.status === "Jatuh Tempo" ? "Terkirim" : inv.status;
  document.getElementById("form-notes").value = inv.notes || "";

  // Line items
  (inv.items || []).forEach((item) => addLineItem(item));

  // Tampilkan tombol "Tandai Lunas" hanya saat edit (bukan untuk invoice yang sudah lunas)
  const markPaidBtn = document.getElementById("btn-mark-paid");
  if (markPaidBtn) {
    if (inv.status !== "Lunas") {
      markPaidBtn.classList.remove("hidden");
    } else {
      markPaidBtn.classList.add("hidden");
    }
  }

  recalculate();
  showModal("modal-form");
}

/**
 * Tutup dan reset form modal.
 */
function closeForm() {
  hideModal("modal-form");
  resetForm();
}

/**
 * Reset semua field form ke kondisi awal.
 */
function resetForm() {
  document.getElementById("invoice-form").reset();
  document.getElementById("form-edit-id").value = "";
  document.getElementById("line-items-container").innerHTML = "";
  lineItemCounter = 0;

  // Bersihkan pesan error
  document
    .querySelectorAll(".form-error")
    .forEach((el) => el.classList.add("hidden"));
  document
    .querySelectorAll(".form-input.error")
    .forEach((el) => el.classList.remove("error"));

  recalculate();
}

/* ----------------------------------------------------------
   12. FORM — VALIDASI
   ---------------------------------------------------------- */

/**
 * Tampilkan pesan error pada field tertentu.
 * @param {string} fieldId - ID input field
 * @param {string} msg - Pesan error
 */
function showErr(fieldId, msg) {
  const field = document.getElementById(fieldId);
  const errEl = document.getElementById(`err-${fieldId}`);
  if (field) field.classList.add("error");
  if (errEl) {
    errEl.textContent = msg;
    errEl.classList.remove("hidden");
  }
}

/**
 * Hapus pesan error pada field tertentu.
 * @param {string} fieldId
 */
function clearErr(fieldId) {
  const field = document.getElementById(fieldId);
  const errEl = document.getElementById(`err-${fieldId}`);
  if (field) field.classList.remove("error");
  if (errEl) errEl.classList.add("hidden");
}

/**
 * Validasi semua field form sebelum simpan.
 * @returns {boolean} true jika valid
 */
function validateForm() {
  let valid = true;

  // Tanggal terbit
  const date = document.getElementById("form-date").value;
  if (!date) {
    showErr("form-date", "Tanggal terbit harus diisi.");
    valid = false;
  }

  // Tanggal jatuh tempo
  const dueDate = document.getElementById("form-due-date").value;
  if (!dueDate) {
    showErr("form-due-date", "Tanggal jatuh tempo harus diisi.");
    valid = false;
  } else if (date && dueDate < date) {
    showErr("form-due-date", "Jatuh tempo tidak boleh sebelum tanggal terbit.");
    valid = false;
  }

  // Nama penerbit
  const issuerName = document.getElementById("form-issuer-name").value.trim();
  if (!issuerName) {
    showErr("form-issuer-name", "Nama penerbit harus diisi.");
    valid = false;
  }

  // Nama klien
  const clientName = document.getElementById("form-client-name").value.trim();
  if (!clientName) {
    showErr("form-client-name", "Nama klien harus diisi.");
    valid = false;
  }

  // Minimal satu item
  const items = getLineItemsFromForm();
  if (items.length === 0) {
    const errEl = document.getElementById("err-line-items");
    if (errEl) {
      errEl.textContent = "Tambahkan minimal satu item layanan.";
      errEl.classList.remove("hidden");
    }
    valid = false;
  } else {
    const errEl = document.getElementById("err-line-items");
    if (errEl) errEl.classList.add("hidden");
    // Validasi deskripsi item
    const emptyDesc = items.some((item) => !item.description.trim());
    if (emptyDesc) {
      const errEl = document.getElementById("err-line-items");
      if (errEl) {
        errEl.textContent = "Semua item harus memiliki deskripsi.";
        errEl.classList.remove("hidden");
      }
      valid = false;
    }
  }

  return valid;
}

/* ----------------------------------------------------------
   13. FORM — SUBMIT (CREATE / UPDATE)
   ---------------------------------------------------------- */

/**
 * Ambil data line items dari DOM form.
 * @returns {Array<{description: string, qty: number, price: number, subtotal: number}>}
 */
function getLineItemsFromForm() {
  const rows = document.querySelectorAll(
    '#line-items-container div[id^="item-"]',
  );
  const items = [];
  rows.forEach((row) => {
    const desc = row.querySelector(".item-desc")?.value || "";
    const qty = parseFloat(row.querySelector(".item-qty")?.value) || 0;
    const price = parseFloat(row.querySelector(".item-price")?.value) || 0;
    items.push({ description: desc, qty, price, subtotal: qty * price });
  });
  return items;
}

/**
 * Atur status invoice lalu trigger submit form secara programatik.
 * Dipanggil oleh tombol footer (Simpan Draft / Simpan & Kirim).
 * handleFormSubmit membaca #form-status yang sudah di-set di sini — tidak ada logika baru.
 * @param {'Draft'|'Terkirim'|'Lunas'} status
 */
function submitWithStatus(status) {
  const statusEl = document.getElementById("form-status");
  if (statusEl) statusEl.value = status;
  const form = document.getElementById("invoice-form");
  if (form) form.requestSubmit();
}

/**
 * Handle submit form — validasi, buat/update objek invoice, simpan ke state.
 * @param {Event} e
 */
function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const editId = document.getElementById("form-edit-id").value;
  const items = getLineItemsFromForm();

  // Hitung total
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const discountPct =
    parseFloat(document.getElementById("form-discount").value) || 0;
  const taxPct = parseFloat(document.getElementById("form-tax").value) || 0;
  const discountAmt = subtotal * (discountPct / 100);
  const taxAmt = (subtotal - discountAmt) * (taxPct / 100);
  const grandTotal = subtotal - discountAmt + taxAmt;

  const selectedStatus = document.getElementById("form-status").value;
  const dueDate = document.getElementById("form-due-date").value;
  // Jika due date sudah lewat dan status bukan Lunas, paksa Jatuh Tempo
  const resolvedStatus =
    selectedStatus !== "Lunas" && dueDate < todayISO()
      ? "Jatuh Tempo"
      : selectedStatus;

  if (editId) {
    // ---- UPDATE ----
    const idx = appState.invoices.findIndex((i) => i.id === editId);
    if (idx === -1) return;
    appState.invoices[idx] = {
      ...appState.invoices[idx],
      date: document.getElementById("form-date").value,
      dueDate: dueDate,
      issuerName: document.getElementById("form-issuer-name").value.trim(),
      issuerEmail: document.getElementById("form-issuer-email").value.trim(),
      issuerPhone: document.getElementById("form-issuer-phone").value.trim(),
      issuerAddress: document
        .getElementById("form-issuer-address")
        .value.trim(),
      clientName: document.getElementById("form-client-name").value.trim(),
      clientEmail: document.getElementById("form-client-email").value.trim(),
      clientPhone: document.getElementById("form-client-phone").value.trim(),
      clientAddress: document
        .getElementById("form-client-address")
        .value.trim(),
      items,
      subtotal,
      discountPct,
      discountAmt,
      taxPct,
      taxAmt,
      grandTotal,
      status: resolvedStatus,
      notes: document.getElementById("form-notes").value.trim(),
      updatedAt: Date.now(),
    };
    showToast("success", "Invoice berhasil diperbarui!");
  } else {
    // ---- CREATE ----
    const newInvoice = {
      id: generateId(),
      number: document.getElementById("form-number").value,
      date: document.getElementById("form-date").value,
      dueDate: dueDate,
      issuerName: document.getElementById("form-issuer-name").value.trim(),
      issuerEmail: document.getElementById("form-issuer-email").value.trim(),
      issuerPhone: document.getElementById("form-issuer-phone").value.trim(),
      issuerAddress: document
        .getElementById("form-issuer-address")
        .value.trim(),
      clientName: document.getElementById("form-client-name").value.trim(),
      clientEmail: document.getElementById("form-client-email").value.trim(),
      clientPhone: document.getElementById("form-client-phone").value.trim(),
      clientAddress: document
        .getElementById("form-client-address")
        .value.trim(),
      items,
      subtotal,
      discountPct,
      discountAmt,
      taxPct,
      taxAmt,
      grandTotal,
      status: resolvedStatus,
      notes: document.getElementById("form-notes").value.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    appState.invoices.unshift(newInvoice);
    showToast("success", "Invoice berhasil dibuat!");
  }

  saveData();
  closeForm();

  // Refresh halaman yang aktif
  if (appState.currentPage === "dashboard") renderDashboard();
  else renderList();
}

/* ----------------------------------------------------------
   14. HAPUS INVOICE
   ---------------------------------------------------------- */

/**
 * Tampilkan dialog konfirmasi hapus.
 * @param {string} id
 */
function confirmDelete(id) {
  pendingDeleteId = id;
  const modal = document.getElementById("modal-confirm");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

/**
 * Tutup dialog konfirmasi tanpa menghapus.
 */
function closeConfirm() {
  pendingDeleteId = null;
  const modal = document.getElementById("modal-confirm");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

/**
 * Eksekusi penghapusan invoice yang di-pending.
 */
function executeDelete() {
  if (!pendingDeleteId) return;
  appState.invoices = appState.invoices.filter((i) => i.id !== pendingDeleteId);
  saveData();
  closeConfirm();
  showToast("error", "Invoice berhasil dihapus.");

  if (appState.currentPage === "dashboard") renderDashboard();
  else renderList();
}

/* ----------------------------------------------------------
   15. DETAIL VIEW INVOICE (READ)
   ---------------------------------------------------------- */

/**
 * Tampilkan detail invoice lengkap dalam modal view.
 * @param {string} id
 */
function viewInvoice(id) {
  const inv = appState.invoices.find((i) => i.id === id);
  if (!inv) return;

  const printArea = document.getElementById("invoice-print-area");

  // Build HTML detail invoice (aman dari XSS melalui escapeHtml)
  printArea.innerHTML = `
    <!-- Print Header Actions -->
    <div class="print-hide flex items-center justify-between p-5 border-b border-slate-100">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 bg-orange-400 rounded-lg flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </div>
        <span class="font-bold text-slate-800">InvoiceKu</span>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="printInvoice()"
          class="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
          </svg>
          Cetak / PDF
        </button>
        <button onclick="closeView()"
          class="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Invoice Content -->
    <div class="p-6 sm:p-8 space-y-6">

      <!-- Invoice Header -->
      <div class="flex flex-col sm:flex-row sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-indigo-700">${escapeHtml(inv.number)}</h1>
          <span class="${badgeClass(inv.status)} mt-1">${escapeHtml(inv.status)}</span>
        </div>
        <div class="text-sm text-slate-500 space-y-1 sm:text-right">
          <p><span class="font-medium text-slate-600">Tanggal Terbit:</span> ${formatDate(inv.date)}</p>
          <p><span class="font-medium text-slate-600">Jatuh Tempo:</span> ${formatDate(inv.dueDate)}</p>
        </div>
      </div>

      <!-- Issuer & Client -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Dari (Penerbit)</p>
          <p class="font-semibold text-slate-800">${escapeHtml(inv.issuerName)}</p>
          ${inv.issuerEmail ? `<p class="text-sm text-slate-500">${escapeHtml(inv.issuerEmail)}</p>` : ""}
          ${inv.issuerPhone ? `<p class="text-sm text-slate-500">${escapeHtml(inv.issuerPhone)}</p>` : ""}
          ${inv.issuerAddress ? `<p class="text-sm text-slate-500 whitespace-pre-line">${escapeHtml(inv.issuerAddress)}</p>` : ""}
        </div>
        <div>
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Kepada (Klien)</p>
          <p class="font-semibold text-slate-800">${escapeHtml(inv.clientName)}</p>
          ${inv.clientEmail ? `<p class="text-sm text-slate-500">${escapeHtml(inv.clientEmail)}</p>` : ""}
          ${inv.clientPhone ? `<p class="text-sm text-slate-500">${escapeHtml(inv.clientPhone)}</p>` : ""}
          ${inv.clientAddress ? `<p class="text-sm text-slate-500 whitespace-pre-line">${escapeHtml(inv.clientAddress)}</p>` : ""}
        </div>
      </div>

      <!-- Items Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b-2 border-indigo-100">
              <th class="text-left pb-2 font-semibold text-slate-600">Deskripsi</th>
              <th class="text-center pb-2 font-semibold text-slate-600 w-16">Qty</th>
              <th class="text-right pb-2 font-semibold text-slate-600 w-32">Harga Satuan</th>
              <th class="text-right pb-2 font-semibold text-slate-600 w-32">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${(inv.items || [])
              .map(
                (item) => `
              <tr class="border-b border-slate-50">
                <td class="py-2.5 text-slate-700">${escapeHtml(item.description)}</td>
                <td class="py-2.5 text-center text-slate-500">${item.qty}</td>
                <td class="py-2.5 text-right text-slate-500">${formatRupiah(item.price)}</td>
                <td class="py-2.5 text-right font-medium text-slate-700">${formatRupiah(item.subtotal)}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>

      <!-- Totals -->
      <div class="flex justify-end">
        <div class="w-full sm:w-72 space-y-2 bg-slate-50 rounded-xl p-4">
          <div class="flex justify-between text-sm">
            <span class="text-slate-500">Subtotal</span>
            <span class="font-medium">${formatRupiah(inv.subtotal)}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-slate-500">Diskon (${inv.discountPct || 0}%)</span>
            <span class="font-medium text-red-500">- ${formatRupiah(inv.discountAmt || 0)}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-slate-500">PPN (${inv.taxPct || 0}%)</span>
            <span class="font-medium">+ ${formatRupiah(inv.taxAmt || 0)}</span>
          </div>
          <div class="flex justify-between border-t border-slate-200 pt-2">
            <span class="font-bold text-slate-800">Grand Total</span>
            <span class="font-bold text-indigo-700 text-base">${formatRupiah(inv.grandTotal)}</span>
          </div>
        </div>
      </div>

      <!-- Notes -->
      ${
        inv.notes
          ? `
        <div class="border-t border-slate-100 pt-4">
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Catatan / Syarat Pembayaran</p>
          <p class="text-sm text-slate-600 whitespace-pre-line">${escapeHtml(inv.notes)}</p>
        </div>`
          : ""
      }

      <!-- Footer cetakan -->
      <div class="border-t border-slate-100 pt-4 text-center text-xs text-slate-400">
        Dokumen ini digenerate oleh <strong>InvoiceKu</strong>
      </div>
    </div>`;

  showModal("modal-view");
}

/**
 * Tutup modal detail invoice.
 */
function closeView() {
  hideModal("modal-view");
}

/**
 * Trigger window.print() untuk mencetak atau simpan PDF invoice.
 */
function printInvoice() {
  window.print();
}

/* ----------------------------------------------------------
   16. HELPER MODAL
   ---------------------------------------------------------- */

/**
 * Tampilkan modal berdasarkan ID.
 * @param {string} id
 */
function showModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden"; // Cegah scroll background
  }
}

/**
 * Sembunyikan modal berdasarkan ID.
 * @param {string} id
 */
function hideModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add("hidden");
    // Pulihkan scroll hanya jika tidak ada modal lain yang terbuka
    const anyOpen = ["modal-form", "modal-view", "modal-confirm"].some(
      (mid) => !document.getElementById(mid)?.classList.contains("hidden"),
    );
    if (!anyOpen) document.body.style.overflow = "";
  }
}

/* ----------------------------------------------------------
   17. TOAST NOTIFIKASI
   ---------------------------------------------------------- */

let toastTimer = null;

/**
 * Tampilkan notifikasi toast di pojok kanan bawah.
 * @param {'success'|'error'|'info'} type
 * @param {string} message
 */
function showToast(type, message) {
  const toast = document.getElementById("toast");
  const inner = document.getElementById("toast-inner");
  const iconEl = document.getElementById("toast-icon");
  const messageEl = document.getElementById("toast-message");

  // Bersihkan timer sebelumnya
  if (toastTimer) clearTimeout(toastTimer);
  inner.classList.remove("animate-fade-out");

  // Warna berdasarkan tipe
  inner.className =
    "flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white min-w-[220px] animate-fade-in ";
  if (type === "success") {
    inner.classList.add("bg-green-500");
    iconEl.textContent = "✓";
  } else if (type === "error") {
    inner.classList.add("bg-red-500");
    iconEl.textContent = "✕";
  } else {
    inner.classList.add("bg-indigo-600");
    iconEl.textContent = "ℹ";
  }

  messageEl.textContent = message; // Teks biasa — aman dari XSS
  toast.classList.remove("hidden");

  // Auto-hide setelah 3 detik
  toastTimer = setTimeout(() => {
    inner.classList.add("animate-fade-out");
    setTimeout(() => toast.classList.add("hidden"), 300);
  }, 3000);
}

/* ----------------------------------------------------------
   18. EVENT LISTENER — KEYBOARD
   ---------------------------------------------------------- */

/**
 * Tutup modal dengan menekan tombol Escape.
 */
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!document.getElementById("modal-form").classList.contains("hidden"))
    closeForm();
  else if (!document.getElementById("modal-view").classList.contains("hidden"))
    closeView();
  else if (
    !document.getElementById("modal-confirm").classList.contains("hidden")
  )
    closeConfirm();
});

/* ----------------------------------------------------------
   19. CONFIRM DELETE BUTTON — EVENT BINDING
   ---------------------------------------------------------- */

document
  .getElementById("confirm-delete-btn")
  .addEventListener("click", executeDelete);

/* ----------------------------------------------------------
   20. INISIALISASI APLIKASI
   ---------------------------------------------------------- */

/**
 * Entry point: muat data, cek overdue, tampilkan halaman awal.
 */
function initApp() {
  loadData();
  checkOverdueStatus();
  showPage("dashboard");
}

// Jalankan saat DOM siap
document.addEventListener("DOMContentLoaded", initApp);
