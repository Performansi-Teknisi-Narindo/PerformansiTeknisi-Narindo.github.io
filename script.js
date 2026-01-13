/******************************************************
 * ✅ FINAL SCRIPT.JS (ANTI CORS + ANTI REDIRECT)
 * Works for GitHub Pages + Google Apps Script API
 ******************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbz14z3-WC9lfUMzkxqTSxcsIdsWErFDRXGBxMMhQmKbWL_Yk8XBEwvRCp3iFRooLd32/exec";
const AUTO_REFRESH_MS = 60000;

let allRows = [];
let chart = null;

const $ = (id) => document.getElementById(id);

function setTime() {
  $("nowTime").textContent = new Date().toLocaleString("id-ID");
}

function setApiBadge(ok) {
  const dot = $("badgeDot");
  const text = $("badgeText");
  const badge = $("badgeAPI");

  if (ok) {
    dot.style.background = "#37ffb1";
    text.textContent = "API: Connected";
    badge.style.borderColor = "rgba(55,255,177,.35)";
  } else {
    dot.style.background = "#ff5b5b";
    text.textContent = "API: Disconnected";
    badge.style.borderColor = "rgba(255,91,91,.35)";
  }
}

function fmtDate(d) {
  const dt = new Date(d);
  if (isNaN(dt)) return "-";
  return dt.toLocaleDateString("id-ID");
}

function sumOpen(r) {
  return (r.open_sqm_reguler || 0) +
         (r.open_reguler_hvc_gold || 0) +
         (r.open_reguler_hvc_platinum || 0);
}
function sumClose(r) {
  return (r.close_sqm_progress || 0) +
         (r.close_sqm_close || 0) +
         (r.close_reguler_progress || 0);
}

function unique(arr) {
  return [...new Set(arr)];
}

function fillSTOSelect(rows) {
  const stoSel = $("stoFilter");
  const current = stoSel.value;

  const stos = unique(rows.map(r => r.sto).filter(Boolean)).sort();
  stoSel.innerHTML = `<option value="">Semua STO</option>` + stos.map(s => `<option value="${s}">${s}</option>`).join("");

  stoSel.value = current || "";
}

function applyFilters() {
  const from = $("dateFrom").value ? new Date($("dateFrom").value) : null;
  const to = $("dateTo").value ? new Date($("dateTo").value) : null;
  const sto = $("stoFilter").value.trim();
  const q = $("searchTeknisi").value.trim().toLowerCase();

  return allRows.filter(r => {
    const t = new Date(r.tanggal);

    if (from && t < from) return false;

    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      if (t > end) return false;
    }

    if (sto && r.sto !== sto) return false;
    if (q && !String(r.teknisi || "").toLowerCase().includes(q)) return false;

    return true;
  });
}

function renderStats(rows) {
  const total = rows.reduce((a, r) => a + (r.total_tiket || 0), 0);
  const open = rows.reduce((a, r) => a + sumOpen(r), 0);
  const close = rows.reduce((a, r) => a + sumClose(r), 0);
  const closeTicket = rows.reduce((a, r) => a + (r.close_tiket || 0), 0);

  $("sTotal").textContent = total;
  $("sOpen").textContent = open;
  $("sClose").textContent = close;
  $("sCloseTicket").textContent = closeTicket;
}

function renderTop(rows) {
  const map = {};
  rows.forEach(r => {
    const name = r.teknisi || "TANPA TEKNISI";
    map[name] = (map[name] || 0) + (r.close_tiket || 0);
  });

  const top = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 10);

  const target = $("topList");
  if (top.length === 0) {
    target.innerHTML = `<div class="empty">Tidak ada data.</div>`;
    return;
  }

  target.innerHTML = top.map(([name, val], i) => `
    <div class="top-item">
      <div>
        <div class="top-name">${i+1}. ${name}</div>
        <div class="top-meta">Close Ticket: ${val}</div>
      </div>
      <span class="pill">#${i+1}</span>
    </div>
  `).join("");
}

function renderChart(rows) {
  const map = {};
  rows.forEach(r => {
    const name = r.teknisi || "TANPA TEKNISI";
    map[name] = (map[name] || 0) + (r.close_tiket || 0);
  });

  const top = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0,10);
  const labels = top.map(x => x[0]);
  const data = top.map(x => x[1]);

  const ctx = document.getElementById("chartClose");
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Close Ticket", data }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "rgba(234,240,255,.65)" } }
      },
      scales: {
        x: { ticks: { color: "rgba(234,240,255,.65)" }, grid: { color: "rgba(255,255,255,.06)" } },
        y: { ticks: { color: "rgba(234,240,255,.65)" }, grid: { color: "rgba(255,255,255,.06)" } }
      }
    }
  });
}

function openModal(row) {
  $("modal").classList.add("open");
  $("modalTitle").textContent = `Detail - ${row.teknisi || "TANPA TEKNISI"}`;

  $("modalBody").innerHTML = `
    <div style="display:grid; gap:10px;">
      <div><b>Tanggal:</b> ${fmtDate(row.tanggal)}</div>
      <div><b>STO:</b> ${row.sto || "-"}</div>
      <div><b>Total Tiket:</b> ${row.total_tiket || 0}</div>
      <hr style="border-color: rgba(255,255,255,.08); width:100%;" />
      <div><b>OPEN SQM REGULER:</b> ${row.open_sqm_reguler || 0}</div>
      <div><b>OPEN REGULER GOLD:</b> ${row.open_reguler_hvc_gold || 0}</div>
      <div><b>OPEN REGULER PLATINUM:</b> ${row.open_reguler_hvc_platinum || 0}</div>
      <hr style="border-color: rgba(255,255,255,.08); width:100%;" />
      <div><b>CLOSE SQM PROGRESS:</b> ${row.close_sqm_progress || 0}</div>
      <div><b>CLOSE SQM CLOSE:</b> ${row.close_sqm_close || 0}</div>
      <div><b>CLOSE REGULER PROGRESS:</b> ${row.close_reguler_progress || 0}</div>
      <hr style="border-color: rgba(255,255,255,.08); width:100%;" />
      <div><b>Close Ticket:</b> ${row.close_tiket || 0}</div>
    </div>
  `;
}

function closeModal() {
  $("modal").classList.remove("open");
}

function renderTable(rows) {
  $("dataCount").textContent = `${rows.length} data`;

  const tb = $("tableBody");
  if (rows.length === 0) {
    tb.innerHTML = `<tr><td colspan="8" class="empty-cell">Data tidak ditemukan.</td></tr>`;
    return;
  }

  tb.innerHTML = rows.map((r, i) => `
    <tr>
      <td>${fmtDate(r.tanggal)}</td>
      <td>${r.sto || "-"}</td>
      <td><span class="pill">${r.teknisi || "TANPA TEKNISI"}</span></td>
      <td>${r.total_tiket || 0}</td>
      <td>${sumOpen(r)}</td>
      <td>${sumClose(r)}</td>
      <td>${r.close_tiket || 0}</td>
      <td><button class="small-btn" data-i="${i}">Detail</button></td>
    </tr>
  `).join("");

  tb.querySelectorAll("button[data-i]").forEach(btn => {
    btn.addEventListener("click", () => {
      openModal(rows[Number(btn.dataset.i)]);
    });
  });
}

function exportCSV(rows) {
  const header = [
    "tanggal","sto","teknisi","total_tiket",
    "open_sqm_reguler","open_reguler_hvc_gold","open_reguler_hvc_platinum",
    "close_sqm_progress","close_sqm_close","close_reguler_progress",
    "close_tiket"
  ];
  const lines = [header.join(",")];

  rows.forEach(r => {
    const line = header.map(k => {
      let v = r[k];
      if (v === null || v === undefined) v = "";
      const s = String(v).replace(/"/g,'""');
      return `"${s}"`;
    }).join(",");
    lines.push(line);
  });

  const blob = new Blob([lines.join("\n")], { type:"text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "performansi_teknisi.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ✅ 1) Normal fetch (kadang gagal karena redirect/cors)
async function fetchJSON() {
  const url = API_URL + (API_URL.includes("?") ? "&" : "?") + "t=" + Date.now();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

// ✅ 2) JSONP fallback (100% aman buat GitHub Pages)
function fetchJSONP() {
  return new Promise((resolve, reject) => {
    const cb = "jsonp_cb_" + Date.now() + "_" + Math.floor(Math.random() * 9999);

    window[cb] = (data) => {
      delete window[cb];
      script.remove();
      resolve(data);
    };

    const script = document.createElement("script");
    script.src = API_URL + (API_URL.includes("?") ? "&" : "?") + "callback=" + cb + "&t=" + Date.now();
    script.onerror = () => {
      delete window[cb];
      script.remove();
      reject(new Error("JSONP failed"));
    };

    document.body.appendChild(script);
  });
}

async function fetchAPI() {
  try {
    // coba fetch biasa dulu
    const data = await fetchJSON();
    allRows = data.rows || [];
    setApiBadge(true);

    fillSTOSelect(allRows);
    renderAll();
  } catch (err1) {
    console.warn("Fetch normal gagal, mencoba JSONP...", err1);
    try {
      const data = await fetchJSONP();
      allRows = data.rows || [];
      setApiBadge(true);

      fillSTOSelect(allRows);
      renderAll();
    } catch (err2) {
      console.error("Fetch JSONP juga gagal:", err2);
      setApiBadge(false);
    }
  }
}

function renderAll() {
  const filtered = applyFilters();
  renderStats(filtered);
  renderTop(filtered);
  renderChart(filtered);
  renderTable(filtered);
}

function initEvents() {
  $("btnRefresh").addEventListener("click", fetchAPI);
  $("btnReload").addEventListener("click", () => location.reload());
  $("btnExport").addEventListener("click", () => exportCSV(applyFilters()));

  $("stoFilter").addEventListener("change", renderAll);
  $("searchTeknisi").addEventListener("input", renderAll);
  $("dateFrom").addEventListener("change", renderAll);
  $("dateTo").addEventListener("change", renderAll);

  $("btnCloseModal").addEventListener("click", closeModal);
  $("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") closeModal();
  });
}

function boot() {
  setTime();
  setInterval(setTime, 1000);

  initEvents();
  fetchAPI();
  setInterval(fetchAPI, AUTO_REFRESH_MS);
}

boot();
