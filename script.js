const API_URL = "https://script.google.com/macros/s/AKfycbwcVYibyX70Fbk-YPsnbuNjlOz9vOoPUqrNXAaCVc_38PU3oFdRI_UjR-d9M8jDdNozIw/exec";

let ticketsData = [];
let rankingData = [];
let rankingStoData = [];
let summaryData = null;

let STO_SELECTED = new Set();
let LAST_OPENED_TICKET = null;
let ACTIVE_TEKNISI = "";

let trendChart = null;
let topOpenChart = null;
let stoChart = null;

document.addEventListener("DOMContentLoaded", () => {
  initDarkMode();
  bindMenu();
  bindActions();
  bindModal();
  bindStoDropdown();
  bindAdminPanel();
  loadAll();
});

// ---------------- DARK MODE ----------------
function initDarkMode(){
  const saved = localStorage.getItem("darkMode") || "0";
  const btn = document.getElementById("darkModeBtn");
  if(saved === "1"){
    document.body.classList.add("dark");
    if(btn) btn.textContent = "☀️ Light";
  }
}
function setDarkMode(on){
  const btn = document.getElementById("darkModeBtn");
  if(on){
    document.body.classList.add("dark");
    localStorage.setItem("darkMode","1");
    if(btn) btn.textContent = "☀️ Light";
  }else{
    document.body.classList.remove("dark");
    localStorage.setItem("darkMode","0");
    if(btn) btn.textContent = "🌙 Dark";
  }
}

// ---------------- UI ----------------
function switchTab(tabName){
  document.querySelectorAll(".menu-item").forEach(x=>x.classList.remove("active"));
  document.querySelector(`.menu-item[data-tab="${tabName}"]`)?.classList.add("active");

  document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
  document.getElementById("tab-"+tabName)?.classList.add("active");

  if(window.innerWidth <= 860){
    document.getElementById("sidebar")?.classList.remove("show");
  }
}

// ---------------- MENU ----------------
function bindMenu(){
  document.querySelectorAll(".menu-item").forEach(btn=>{
    btn.addEventListener("click", ()=> switchTab(btn.dataset.tab));
  });
}

// ---------------- ACTIONS ----------------
function bindActions(){
  document.getElementById("refreshBtn")?.addEventListener("click", loadAll);

  document.getElementById("darkModeBtn")?.addEventListener("click", ()=>{
    const isDark = document.body.classList.contains("dark");
    setDarkMode(!isDark);
  });

  document.getElementById("toggleSidebarBtn")?.addEventListener("click", ()=>{
    document.getElementById("sidebar")?.classList.toggle("show");
  });

  document.getElementById("resetBtn")?.addEventListener("click", ()=>{
    ["searchInput","filterTeknisi","filterStatus"].forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.value = "";
    });
    STO_SELECTED.clear();
    ACTIVE_TEKNISI = "";
    fillFilters();
    renderAll();
  });

  document.getElementById("exportBtn")?.addEventListener("click", exportTicketsCSV);
  document.getElementById("exportTicketsBtn")?.addEventListener("click", exportTicketsCSV);
  document.getElementById("exportRankingBtn")?.addEventListener("click", exportRankingCSV);

  ["searchInput","filterTeknisi","filterStatus"].forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener("input", renderAll);
    el.addEventListener("change", renderAll);
  });

  document.getElementById("filterTeknisi")?.addEventListener("change", (e)=>{
    const v = e.target.value || "";
    if(v) openTeknisiDetail(v);
  });
}

// Admin Panel

function bindAdminPanel(){
  const saveBtn = document.getElementById("adminSaveBtn");
  const fillBtn = document.getElementById("adminFillFromModalBtn");

  if(saveBtn){
    saveBtn.addEventListener("click", adminSaveOverride);
  }

  if(fillBtn){
    fillBtn.addEventListener("click", ()=>{
      if(!LAST_OPENED_TICKET){
        setAdminResult("❌ Belum ada tiket yang dibuka dari modal");
        return;
      }
      document.getElementById("adminNoTiket").value = LAST_OPENED_TICKET.no_tiket || "";
      document.getElementById("adminTeknisi").value = LAST_OPENED_TICKET.teknisi || "";
      document.getElementById("adminStatus").value = String(LAST_OPENED_TICKET.status||"").toUpperCase();
      document.getElementById("adminJenis").value = LAST_OPENED_TICKET.jenis || "";
      document.getElementById("adminCatatan").value = `Override via website (${new Date().toLocaleString()})`;
      setAdminResult("✅ Form sudah terisi dari tiket terakhir");
    });
  }
}

function setAdminResult(msg){
  const el = document.getElementById("adminResult");
  if(el) el.textContent = msg;
}

async function adminSaveOverride(){
  const pin = document.getElementById("adminPin").value.trim();
  const no_tiket = document.getElementById("adminNoTiket").value.trim();

  const teknisi_override = document.getElementById("adminTeknisi").value.trim();
  const status_override = document.getElementById("adminStatus").value.trim();
  const jenis_override = document.getElementById("adminJenis").value.trim();
  const catatan = document.getElementById("adminCatatan").value.trim();

  if(!pin){
    setAdminResult("❌ PIN wajib diisi");
    return;
  }
  if(!no_tiket){
    setAdminResult("❌ No Tiket wajib diisi");
    return;
  }

  setAdminResult("⏳ Menyimpan override...");

  try{
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "unspec_upsert",
        pin,
        no_tiket,
        teknisi_override,
        status_override,
        jenis_override,
        catatan
      })
    });

    const json = await res.json();
    if(!json.ok){
      setAdminResult(json.message || "❌ Gagal simpan override");
      return;
    }

    setAdminResult(json.message || "✅ Override tersimpan!");

    // auto refresh setelah save
    await loadAllSilent();
    switchTab("tickets");
  }catch(err){
    console.error(err);
    setAdminResult("❌ Error: " + String(err));
  }
}

// ---------------- FETCH ----------------
async function fetchJSON(url){
  const res = await fetch(url);
  return await res.json();
}

// ---------------- LOAD ----------------
async function loadAll(){
  try{
    const [summary, tickets, ranking, rankingSto] = await Promise.all([
      fetchJSON(`${API_URL}?action=summary`),
      fetchJSON(`${API_URL}?action=tickets`),
      fetchJSON(`${API_URL}?action=ranking`),
      fetchJSON(`${API_URL}?action=ranking_sto`),
    ]);

    summaryData = summary || null;
    ticketsData = tickets.rows || [];
    rankingData = ranking.rows || [];
    rankingStoData = rankingSto.rows || [];

    fillFilters();
    renderAll();
    renderSummaryUI();
  }catch(err){
    console.error(err);
    alert("Gagal load data. Pastikan API_URL benar + deploy Anyone.");
  }
}

// silent refresh
async function loadAllSilent(){
  try{
    const [summary, tickets, ranking, rankingSto] = await Promise.all([
      fetchJSON(`${API_URL}?action=summary`),
      fetchJSON(`${API_URL}?action=tickets`),
      fetchJSON(`${API_URL}?action=ranking`),
      fetchJSON(`${API_URL}?action=ranking_sto`),
    ]);

    summaryData = summary || null;
    ticketsData = tickets.rows || [];
    rankingData = ranking.rows || [];
    rankingStoData = rankingSto.rows || [];

    fillFilters();
    renderAll();
    renderSummaryUI();
  }catch(err){
    console.error("silent refresh gagal:", err);
  }
}

// ---------------- SUMMARY UI ----------------
function renderSummaryUI(){
  const last = (summaryData && summaryData.last_sync) ? summaryData.last_sync : "-";
  document.getElementById("sidebarLastSync").textContent = last;
  document.getElementById("topLastSyncPill").textContent = `Last Sync: ${last}`;
}

// ---------------- STO DROPDOWN ----------------
function bindStoDropdown(){
  const btn = document.getElementById("stoDropdownBtn");
  const menu = document.getElementById("stoDropdownMenu");
  const list = document.getElementById("stoDropdownList");
  if(!btn || !menu || !list) return;

  btn.addEventListener("click", ()=> menu.classList.toggle("show"));

  document.addEventListener("click", (e)=>{
    const root = document.getElementById("stoDropdown");
    if(root && !root.contains(e.target)) menu.classList.remove("show");
  });

  list.addEventListener("change", (e)=>{
    if(e.target.matches("input[type='checkbox']")){
      const val = String(e.target.value||"").trim().toUpperCase();
      if(e.target.checked) STO_SELECTED.add(val);
      else STO_SELECTED.delete(val);
      updateStoDropdownText_();
      renderAll();
    }
  });

  document.getElementById("stoSelectAllBtn")?.addEventListener("click", ()=>{
    list.querySelectorAll("input[type='checkbox']").forEach(c=>{
      c.checked = true;
      STO_SELECTED.add(String(c.value).trim().toUpperCase());
    });
    updateStoDropdownText_();
    renderAll();
  });

  document.getElementById("stoClearBtn")?.addEventListener("click", ()=>{
    list.querySelectorAll("input[type='checkbox']").forEach(c=>c.checked=false);
    STO_SELECTED.clear();
    updateStoDropdownText_();
    renderAll();
  });
}

function updateStoDropdownText_(){
  const text = document.getElementById("stoDropdownText");
  const selected = [...STO_SELECTED];
  if(selected.length===0) text.textContent = "Semua STO";
  else if(selected.length===1) text.textContent = selected[0];
  else text.textContent = `${selected.length} STO dipilih`;
}

function fillFilters(){
  // teknisi dropdown
  const tekSet = new Set(ticketsData.map(x=>String(x.teknisi||"").trim()).filter(Boolean));
  const tekSel = document.getElementById("filterTeknisi");
  if(tekSel){
    const cur = tekSel.value || "";
    tekSel.innerHTML = `<option value="">Semua Teknisi</option>` +
      [...tekSet].sort().map(v=>`<option value="${v}">${v}</option>`).join("");
    if(cur) tekSel.value = cur;
  }

  // sto checklist
  const stoSet = new Set(ticketsData.map(x=>String(x.sto||"").trim()).filter(Boolean));
  const stos = [...stoSet].sort();
  const list = document.getElementById("stoDropdownList");
  if(list){
    list.innerHTML = stos.map(sto=>{
      const val = sto.toUpperCase();
      const checked = STO_SELECTED.has(val) ? "checked" : "";
      return `<label class="multi-item">
        <input type="checkbox" value="${val}" ${checked}/>
        <span>${sto}</span>
      </label>`;
    }).join("");
  }

  updateStoDropdownText_();
}

// ---------------- FILTER ----------------
function getFilteredTickets(){
  const q = (document.getElementById("searchInput")?.value || "").toLowerCase();
  const teknisi = document.getElementById("filterTeknisi")?.value || "";
  const status = document.getElementById("filterStatus")?.value || "";
  const stoSelected = [...STO_SELECTED];
  const stoActive = stoSelected.length > 0;

  return ticketsData.filter(t=>{
    const sto = String(t.sto||"").trim().toUpperCase();
    if(stoActive && !stoSelected.includes(sto)) return false;
    if(teknisi && String(t.teknisi||"").trim() !== teknisi) return false;
    if(status && String(t.status||"").trim().toUpperCase() !== status) return false;
    if(q){
      const s = JSON.stringify(t).toLowerCase();
      if(!s.includes(q)) return false;
    }
    return true;
  });
}

// ---------------- RENDER ALL ----------------
function renderAll(){
  const filtered = getFilteredTickets();
  renderKPI(filtered);
  renderTickets(filtered);
  renderRankingGlobal();
  renderRankingSto();
  renderCharts(filtered);

  // jika tab teknisi aktif, update
  const tabTek = document.getElementById("tab-teknisi");
  if(tabTek && tabTek.classList.contains("active")){
    renderTeknisiDetail();
  }
}

function renderKPI(rows){
  const total = rows.length;
  const open = rows.filter(x=>String(x.status).toUpperCase()==="OPEN").length;
  const close = rows.filter(x=>String(x.status).toUpperCase()==="CLOSE").length;
  const progress = total ? Math.round((close/total)*100) : 0;
  const teknisiCount = new Set(rows.map(x=>String(x.teknisi||"").trim()).filter(Boolean)).size;

  document.getElementById("kpiTotal").textContent = total;
  document.getElementById("kpiOpen").textContent = open;
  document.getElementById("kpiClose").textContent = close;
  document.getElementById("kpiProgress").textContent = progress + "%";
  document.getElementById("kpiTeknisi").textContent = teknisiCount;
  document.getElementById("sidebarTeknisiCount").textContent = teknisiCount;
}

// ---------------- TABLES ----------------
function renderTickets(rows){
  const tbody = document.querySelector("#ticketsTable tbody");
  if(!tbody) return;

  const limit = 500;
  const sliced = rows.slice(0, limit);

  tbody.innerHTML = sliced.map((r, idx)=>`
    <tr data-idx="${idx}">
      <td>${r.tanggal||""}</td>
      <td>${r.sto||""}</td>
      <td>${r.teknisi||""}</td>
      <td><b>${r.no_tiket||""}</b></td>
      <td>${r.status||""}</td>
      <td>${r.jenis||""}</td>
      <td>${r.device||""}</td>
    </tr>
  `).join("");

  tbody.querySelectorAll("tr").forEach(tr=>{
    tr.addEventListener("click", ()=>{
      openTicketModal(sliced[Number(tr.dataset.idx)]);
    });
  });

  const note = document.getElementById("ticketsNote");
  if(note){
    note.textContent = rows.length > limit
      ? `Menampilkan ${limit} dari ${rows.length} tiket.`
      : `Menampilkan ${rows.length} tiket.`;
  }
}

function renderRankingGlobal(){
  const tbody = document.querySelector("#rankingTable tbody");
  if(!tbody) return;

  tbody.innerHTML = rankingData.slice(0,50).map(r=>`
    <tr data-teknisi="${r.teknisi}">
      <td>${r.rank}</td>
      <td><b>${r.teknisi}</b></td>
      <td>${r.total}</td>
      <td>${r.open}</td>
      <td>${r.close}</td>
      <td>${r.progress}</td>
      <td>${r.unspec}</td>
    </tr>
  `).join("");

  tbody.querySelectorAll("tr").forEach(tr=>{
    tr.addEventListener("click", ()=> openTeknisiDetail(tr.dataset.teknisi));
  });
}

function renderRankingSto(){
  const tbody = document.querySelector("#rankingStoTable tbody");
  if(!tbody) return;

  // tampilkan semua ranking per STO (ikut filter STO kalau selected)
  const stoSelected = [...STO_SELECTED];
  const stoActive = stoSelected.length > 0;

  const rows = stoActive
    ? rankingStoData.filter(r=>stoSelected.includes(String(r.sto||"").toUpperCase()))
    : rankingStoData;

  tbody.innerHTML = rows.slice(0,200).map(r=>`
    <tr data-teknisi="${r.teknisi}">
      <td>${r.sto}</td>
      <td>${r.rank}</td>
      <td><b>${r.teknisi}</b></td>
      <td>${r.total}</td>
      <td>${r.open}</td>
      <td>${r.close}</td>
      <td>${r.progress}</td>
      <td>${r.unspec}</td>
    </tr>
  `).join("");

  tbody.querySelectorAll("tr").forEach(tr=>{
    tr.addEventListener("click", ()=> openTeknisiDetail(tr.dataset.teknisi));
  });
}

// ---------------- CHARTS ----------------
function renderCharts(rows){
  // trend progress by tanggal
  const byDate = {};
  rows.forEach(t=>{
    const d = String(t.tanggal||"UNKNOWN").trim();
    if(!byDate[d]) byDate[d] = { total:0, close:0 };
    byDate[d].total++;
    if(String(t.status).toUpperCase()==="CLOSE") byDate[d].close++;
  });

  const dates = Object.keys(byDate).sort();
  const trend = dates.map(d=>{
    const x = byDate[d];
    return x.total ? Math.round((x.close/x.total)*100) : 0;
  });

  // top open
  const openByTek = {};
  rows.forEach(t=>{
    const tek = String(t.teknisi||"UNKNOWN").trim();
    if(!openByTek[tek]) openByTek[tek]=0;
    if(String(t.status).toUpperCase()==="OPEN") openByTek[tek]++;
  });
  const topOpen = Object.entries(openByTek).sort((a,b)=>b[1]-a[1]).slice(0,5);

  // sto open close
  const stoMap = {};
  rows.forEach(t=>{
    const sto = String(t.sto||"UNKNOWN").trim().toUpperCase();
    if(!stoMap[sto]) stoMap[sto] = { open:0, close:0 };
    if(String(t.status).toUpperCase()==="CLOSE") stoMap[sto].close++;
    else stoMap[sto].open++;
  });

  const stoLabels = Object.keys(stoMap).sort();
  const stoOpen = stoLabels.map(s=>stoMap[s].open);
  const stoClose = stoLabels.map(s=>stoMap[s].close);

  buildTrendChart(dates, trend);
  buildTopOpenChart(topOpen.map(x=>x[0]), topOpen.map(x=>x[1]));
  buildStoChart(stoLabels, stoOpen, stoClose);
}

function buildTrendChart(labels, data){
  const ctx = document.getElementById("trendChart");
  if(!ctx) return;
  if(trendChart) trendChart.destroy();

  trendChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets:[{ label:"Progress (%)", data }] },
    options:{ responsive:true, onClick: ()=> switchTab("tickets") }
  });
}

function buildTopOpenChart(labels, data){
  const ctx = document.getElementById("topOpenChart");
  if(!ctx) return;
  if(topOpenChart) topOpenChart.destroy();

  topOpenChart = new Chart(ctx, {
    type:"bar",
    data:{ labels, datasets:[{ label:"OPEN", data }]},
    options:{
      indexAxis:"y",
      responsive:true,
      onClick: (_e, els)=>{
        if(!els.length) return;
        openTeknisiDetail(labels[els[0].index]);
      }
    }
  });
}

function buildStoChart(labels, openData, closeData){
  const ctx = document.getElementById("stoChart");
  if(!ctx) return;
  if(stoChart) stoChart.destroy();

  stoChart = new Chart(ctx, {
    type:"bar",
    data:{ labels, datasets:[
      { label:"OPEN", data: openData },
      { label:"CLOSE", data: closeData }
    ]},
    options:{
      responsive:true,
      onClick: (_e, els)=>{
        if(!els.length) return;
        const sto = String(labels[els[0].index]||"").trim().toUpperCase();
        STO_SELECTED.clear();
        if(sto && sto!=="UNKNOWN") STO_SELECTED.add(sto);
        fillFilters();
        renderAll();
        switchTab("tickets");
      }
    }
  });
}

// ---------------- TEKNISI DETAIL ----------------
function openTeknisiDetail(teknisiName){
  ACTIVE_TEKNISI = String(teknisiName||"").trim();
  if(!ACTIVE_TEKNISI) return;

  const tekSel = document.getElementById("filterTeknisi");
  if(tekSel) tekSel.value = ACTIVE_TEKNISI;

  switchTab("teknisi");
  renderTeknisiDetail();
}

function renderTeknisiDetail(){
  const nameEl = document.getElementById("techName");
  const subEl = document.getElementById("techSub");
  if(!ACTIVE_TEKNISI){
    if(nameEl) nameEl.textContent = "-";
    if(subEl) subEl.textContent = "Pilih teknisi untuk melihat detail";
    return;
  }

  const rows = getFilteredTickets().filter(t => String(t.teknisi||"").trim() === ACTIVE_TEKNISI);

  const total = rows.length;
  const open = rows.filter(x=>String(x.status).toUpperCase()==="OPEN").length;
  const close = rows.filter(x=>String(x.status).toUpperCase()==="CLOSE").length;
  const progress = total ? Math.round((close/total)*100) : 0;

  nameEl.textContent = ACTIVE_TEKNISI;
  subEl.textContent = "Mengikuti filter aktif (STO/status/search)";

  document.getElementById("techTotal").textContent = total;
  document.getElementById("techOpen").textContent = open;
  document.getElementById("techClose").textContent = close;
  document.getElementById("techProgress").textContent = progress + "%";

  const tbody = document.querySelector("#techTicketsTable tbody");
  if(!tbody) return;

  const limit = 300;
  const sliced = rows.slice(0, limit);

  tbody.innerHTML = sliced.map((r, idx)=>`
    <tr data-idx="${idx}">
      <td>${r.tanggal||""}</td>
      <td>${r.sto||""}</td>
      <td><b>${r.no_tiket||""}</b></td>
      <td>${r.status||""}</td>
      <td>${r.jenis||""}</td>
      <td>${r.device||""}</td>
    </tr>
  `).join("");

  tbody.querySelectorAll("tr").forEach(tr=>{
    tr.addEventListener("click", ()=> openTicketModal(sliced[Number(tr.dataset.idx)]));
  });

  const note = document.getElementById("techTicketNote");
  if(note){
    note.textContent = rows.length > limit
      ? `Menampilkan ${limit} dari ${rows.length} tiket teknisi ini.`
      : `Menampilkan ${rows.length} tiket teknisi ini.`;
  }
}

// ---------------- MODAL ----------------
function bindModal(){
  const backdrop = document.getElementById("ticketModalBackdrop");
  const close1 = document.getElementById("closeModalBtn");
  const close2 = document.getElementById("closeModalBtn2");
  const copyBtn = document.getElementById("copyTicketBtn");

  backdrop.addEventListener("click", (e)=>{
    if(e.target === backdrop) closeTicketModal();
  });
  close1.addEventListener("click", closeTicketModal);
  close2.addEventListener("click", closeTicketModal);

  copyBtn.addEventListener("click", ()=>{
    const t = copyBtn.dataset.ticket || "";
    if(!t) return;
    navigator.clipboard.writeText(t);
    copyBtn.textContent = "✅ Copied!";
    setTimeout(()=>copyBtn.textContent="Copy No Tiket", 900);
  });

  document.addEventListener("keydown", (e)=>{
    if(e.key==="Escape") closeTicketModal();
  });
}

function  openTicketModal(ticket){
    LAST_OPENED_TICKET = ticket;
  if(!ticket) return;
  document.getElementById("modalTitle").textContent = ticket.no_tiket || "Detail Tiket";
  document.getElementById("modalSub").textContent = `${ticket.tanggal||""} • ${ticket.sto||""} • ${ticket.teknisi||""}`;

  const kv = (k,v)=>`
    <div class="kv">
      <div class="k">${k}</div>
      <div class="v">${v || "-"}</div>
    </div>
  `;

  document.getElementById("modalBody").innerHTML = `
    ${kv("Status", ticket.status)}
    ${kv("Jenis", ticket.jenis)}
    ${kv("Device", ticket.device)}
    ${kv("Keterangan", ticket.ket)}
    ${kv("No Tiket", ticket.no_tiket)}
    ${kv("STO", ticket.sto)}
    ${kv("Teknisi", ticket.teknisi)}
  `;

  const copyBtn = document.getElementById("copyTicketBtn");
  copyBtn.dataset.ticket = ticket.no_tiket || "";

  document.getElementById("ticketModalBackdrop").classList.add("show");
}

function closeTicketModal(){
  document.getElementById("ticketModalBackdrop").classList.remove("show");
}

// ---------------- EXPORT ----------------
function exportTicketsCSV(){
  const rows = getFilteredTickets();
  const header = ["tanggal","sto","teknisi","no_tiket","status","jenis","device","ket"];
  downloadCSV_("tickets_export.csv", header, rows);
}

function exportRankingCSV(){
  const rows = rankingData.map(r=>({
    rank:r.rank, teknisi:r.teknisi, total:r.total, open:r.open, close:r.close, progress:r.progress, unspec:r.unspec
  }));
  const header = ["rank","teknisi","total","open","close","progress","unspec"];
  downloadCSV_("ranking_export.csv", header, rows);
}

function downloadCSV_(filename, header, rows){
  const csv = [
    header.join(","),
    ...rows.map(r => header.map(k => `"${String(r[k]||"").replace(/"/g,'""')}"`).join(","))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------- AUTO REFRESH 5 MIN ----------------
setInterval(() => {
  console.log("🔄 Auto Refresh PRO MAX (5 menit)...");
  loadAllSilent();
}, 5 * 60 * 1000);
