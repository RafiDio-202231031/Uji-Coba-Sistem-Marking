// =====================================================================
//  app.js - JAVASCRIPT: seluruh interaksi halaman dengan server
// =====================================================================
const $ = id => document.getElementById(id);
const state = { user:null, role:null, batch:[], list:[], cetakItems:[] };

async function api(url, opts={}){
  opts.headers = Object.assign({"Content-Type":"application/json"}, opts.headers||{});
  const r = await fetch(url, opts);
  const d = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.error || ("HTTP "+r.status));
  return d;
}
const show = (el,on=true)=> el.classList.toggle("hidden", !on);

// ---------- MODAL ----------
let modalOkFn = null;
function openModal(title, bodyHTML, onOk, okText="✅ Ya"){
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = bodyHTML;
  $("modalOk").textContent = okText;
  modalOkFn = onOk; show($("modal"));
}
$("modalBatal").onclick = ()=> show($("modal"), false);
$("modalOk").onclick = ()=>{ show($("modal"), false); if(modalOkFn) modalOkFn(); };

// ---------- AUTH ----------
async function init(){
  const me = await api("/api/me");
  if(me.user){ state.user=me.user; state.role=me.role; masukUI(); }
}
function masukUI(){
  show($("viewLogin"), false); show($("viewMain"));
  $("userName").textContent = state.user; show($("btnUser"));
  document.querySelectorAll(".admin-only").forEach(e=> show(e, state.role==="admin"));
  muatWarna(); muatKode();
}
$("btnLogin").onclick = async ()=>{
  try{
    const d = await api("/api/login",{method:"POST",body:JSON.stringify(
      {username:$("loginUser").value, password:$("loginPass").value})});
    state.user=d.user; state.role=d.role; masukUI();
  }catch(e){ $("loginErr").textContent=e.message; show($("loginErr")); }
};
$("btnUser").onclick = ()=> show($("userMenu"), $("userMenu").classList.contains("hidden"));
$("btnKeluar").onclick = async ()=>{ await api("/api/logout",{method:"POST"}); location.reload(); };
$("btnGantiSandi").onclick = ()=> openModal("🔑 Ganti Kata Sandi",
  `<label>Kata sandi lama</label><input id="mLama" type="password">
   <label>Kata sandi baru</label><input id="mBaru" type="password">`,
  async ()=>{ try{ await api("/api/ganti_sandi",{method:"POST",body:JSON.stringify(
    {lama:$("mLama").value, baru:$("mBaru").value})}); alert("Kata sandi diganti."); }
    catch(e){ alert(e.message); } }, "💾 Simpan");
$("btnManajemen").onclick = ()=> openModal("👥 Tambah Pengguna",
  `<label>Username</label><input id="mUser">
   <label>Kata sandi</label><input id="mPass" type="password">
   <label>Peran</label><select id="mRole"><option>staff</option><option>admin</option></select>`,
  async ()=>{ try{ await api("/api/tambah_user",{method:"POST",body:JSON.stringify(
    {username:$("mUser").value, password:$("mPass").value, role:$("mRole").value})});
    alert("Pengguna ditambahkan."); } catch(e){ alert(e.message); } }, "➕ Tambah");

// ---------- TAB ----------
document.querySelectorAll(".tab").forEach(t=> t.onclick = ()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  t.classList.add("active");
  document.querySelectorAll(".tabview").forEach(v=> show(v, v.id==="tab-"+t.dataset.tab));
  if(t.dataset.tab==="cetak"){ muatShipsCetak(); muatLogCetak(); }
});

// ---------- REFERENSI ----------
async function muatWarna(){
  const w = await api("/api/warna");
  $("warna").innerHTML = w.map(x=>`<option>${x}</option>`).join("") +
    `<option value="__lain">Lainnya (ketik manual)</option>`;
  $("filterWarna").innerHTML = `<option>Semua warna</option>` +
    w.map(x=>`<option>${x}</option>`).join("");
}
$("warna").onchange = ()=> show($("wrapWarnaBaru"), $("warna").value==="__lain");
async function muatKode(){
  const k = await api("/api/kode_buyer");
  const opts = k.map(x=>`<option>${x}</option>`).join("") +
    `<option value="__manual">— ketik manual —</option>`;
  $("kodeBuyer").innerHTML = opts; $("cetakKode").innerHTML = opts;
}
$("kodeBuyer").onchange = ()=> show($("wrapManual"), $("kodeBuyer").value==="__manual");
$("cetakKode").onchange = ()=>{ show($("wrapCetakManual"), $("cetakKode").value==="__manual");
  muatShipsCetak(); };

// ---------- MENU 1: BUAT ----------
$("mode").onchange = ()=> show($("wrapJumlah"), $("mode").value==="borongan");
async function preview(){
  const s=$("shipment").value.trim(), u=$("utama").value.trim();
  const j = $("mode").value==="borongan" ? (+$("jumlah").value||1) : 1;
  if(s && /^\d+$/.test(u)){
    const d = await api(`/api/next?shipment=${encodeURIComponent(s)}&utama=${u}&jumlah=${j}`);
    if(d.first){ $("previewNo").textContent =
      `Akan diterbitkan: ${d.first} s/d ${d.last} (${j} label)`; show($("previewNo")); return; }
  }
  show($("previewNo"), false);
}
["shipment","utama","jumlah"].forEach(id=> $(id).addEventListener("input", preview));
$("btnTerbitkan").onclick = async ()=>{
  const body = { shipment:$("shipment").value, utama:$("utama").value,
    jumlah: $("mode").value==="borongan" ? (+$("jumlah").value||1) : 1,
    code:$("code").value, description:$("desc").value, size:$("size").value,
    colour: $("warna").value==="__lain" ? $("warnaBaru").value.trim() : $("warna").value,
    qty:$("qty").value, replacement:$("repl").checked,
    warna_baru: $("warna").value==="__lain" ? $("warnaBaru").value.trim() : null };
  try{
    const d = await api("/api/labels",{method:"POST",body:JSON.stringify(body)});
    state.batch = d.items;
    $("buatMsg").className="ok";
    $("buatMsg").textContent = `${d.items.length} label diterbitkan: `+
      `${d.items[0].packing_no} s/d ${d.items[d.items.length-1].packing_no}.`;
    show($("hasilBuat")); $("tabelHasil").innerHTML = tabelHTML(state.batch);
  }catch(e){ $("buatMsg").className="err"; $("buatMsg").textContent=e.message; }
};
$("btnPrintHasil").onclick = ()=> cetakLabels(state.batch);
$("btnExcelHasil").onclick = ()=> unduhExcel(state.batch, "packing.xlsx");

// ---------- MENU 2: DAFTAR ----------
$("btnMuat").onclick = muatDaftar;
async function muatDaftar(){
  const manual = $("kodeBuyer").value==="__manual" ? $("manualPrefix").value.trim() : "";
  const q = new URLSearchParams({kode: manual?"":$("kodeBuyer").value, manual,
                                 warna: $("filterWarna").value});
  state.list = await api("/api/labels?"+q);
  const ring = {};
  state.list.forEach(i=> ring[i.shipment_no]=(ring[i.shipment_no]||0)+1);
  $("ringkasan").innerHTML = `<table><tr><th>Shipment</th><th>Jumlah koli</th></tr>`+
    Object.entries(ring).map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join("")+`</table>`;
  $("tabelDaftar").innerHTML = tabelHTML(state.list);
  $("kelolaShip").innerHTML = Object.keys(ring).sort().map(s=>`<option>${s}</option>`).join("");
  isiKelolaPack();
}
$("kelolaShip").onchange = isiKelolaPack;
function isiKelolaPack(){
  const s = $("kelolaShip").value;
  $("kelolaPack").innerHTML = state.list.filter(i=>i.shipment_no===s)
    .map(i=>`<option>${i.packing_no}</option>`).join("");
}
const cariRow = (s,p)=> state.list.find(i=>i.shipment_no===s && i.packing_no===p);
$("btnEditShip").onclick = ()=>{ const ship=$("kelolaShip").value;
  openModal("✏️ Edit Shipment "+ship, `<label>Shipment No baru</label><input id="mShip" value="${ship}">`,
  async ()=>{ try{ await api("/api/shipment",{method:"PUT",
    body:JSON.stringify({lama:ship, baru:$("mShip").value.trim()})}); muatDaftar(); }
    catch(e){ alert(e.message); } }, "💾 Simpan"); };
$("btnHapusShip").onclick = ()=>{ const ship=$("kelolaShip").value;
  const n = state.list.filter(i=>i.shipment_no===ship).length;
  openModal("⚠️ Konfirmasi Hapus",
  `<p>Shipment <b>${ship}</b> berisi <b>${n} koli</b> akan dihapus permanen.</p>`,
  async ()=>{ await api("/api/shipment",{method:"DELETE",body:JSON.stringify({ship})}); muatDaftar(); },
  "✅ Ya, Hapus Semua"); };
$("btnEditPack").onclick = ()=>{ const r=cariRow($("kelolaShip").value,$("kelolaPack").value); if(!r)return;
  openModal("✏️ Edit Label "+r.packing_no,
  `<label>Packing No</label><input id="mPack" value="${r.packing_no}">
   <label>Shipment No</label><input id="mShip2" value="${r.shipment_no}">
   <label>Code</label><input id="mCode" value="${r.code||""}">
   <label>Description</label><input id="mDesc" value="${r.description||""}">
   <label>Size</label><input id="mSize" value="${r.size||""}">
   <label>Colour</label><input id="mColour" value="${r.colour||""}">
   <label>Qty</label><input id="mQty" value="${r.qty||""}">
   <label class="check"><input type="checkbox" id="mRepl" ${r.replacement?"checked":""}> REPLACEMENT</label>`,
  async ()=>{ try{ await api("/api/labels/"+r.id,{method:"PUT",body:JSON.stringify({
    packing_no:$("mPack").value.trim(), shipment_no:$("mShip2").value.trim(),
    code:$("mCode").value, description:$("mDesc").value, size:$("mSize").value,
    colour:$("mColour").value, qty:$("mQty").value, replacement:$("mRepl").checked})});
    muatDaftar(); } catch(e){ alert(e.message); } }, "💾 Simpan"); };
$("btnHapusPack").onclick = ()=>{ const r=cariRow($("kelolaShip").value,$("kelolaPack").value); if(!r)return;
  openModal("⚠️ Konfirmasi Hapus",
  `<p>Nomor <b>${r.packing_no}</b> (shipment <b>${r.shipment_no}</b>) akan dihapus permanen.</p>`,
  async ()=>{ await api("/api/labels/"+r.id,{method:"DELETE"}); muatDaftar(); }, "✅ Ya, Hapus"); };
$("btnExcelDaftar").onclick = ()=> unduhExcel(state.list, "packing_daftar.xlsx");

// ---------- MENU 3: CETAK ULANG ----------
async function muatShipsCetak(){
  const manual = $("cetakKode").value==="__manual" ? $("cetakManual").value.trim() : "";
  state.cetakItems = await api("/api/labels?"+new URLSearchParams(
    {kode: manual?"":$("cetakKode").value, manual, warna:"Semua warna"}));
  const ships = [...new Set(state.cetakItems.map(i=>i.shipment_no))].sort();
  $("cetakShip").innerHTML = ships.map(s=>`<option>${s}</option>`).join("");
  isiCetakPack();
}
$("cetakShip").onchange = isiCetakPack;
function isiCetakPack(){
  $("cetakPack").innerHTML = (state.cetakItems||[])
    .filter(i=>i.shipment_no===$("cetakShip").value)
    .map(i=>`<option>${i.packing_no}</option>`).join("");
}
$("btnCetakUlang").onclick = ()=>{
  const r = (state.cetakItems||[]).find(i=>i.shipment_no===$("cetakShip").value
    && i.packing_no===$("cetakPack").value); if(!r) return;
  openModal("🖨️ Cetak Ulang",
  `<p>Cetak ulang nomor <b>${r.packing_no}</b>? Kejadian ini akan dicatat.</p>
   <label>Alasan</label><input id="mAlasan" value="Label sobek">`,
  async ()=>{ await api("/api/reprint",{method:"POST",body:JSON.stringify(
    {shipment_no:r.shipment_no, packing_no:r.packing_no, alasan:$("mAlasan").value})});
    cetakLabels([r]); muatLogCetak(); }, "🖨️ Cetak");
};
async function muatLogCetak(){
  const logs = await api("/api/reprint_log");
  $("logCetak").innerHTML = logs.length ?
   `<table><tr><th>Waktu</th><th>Shipment</th><th>Packing</th><th>Alasan</th><th>Oleh</th></tr>`+
   logs.map(l=>`<tr><td>${l.created_at}</td><td>${l.shipment_no}</td><td>${l.packing_no}</td>
   <td>${l.alasan}</td><td>${l.dicetak_oleh}</td></tr>`).join("")+`</table>` : "";
}

// ---------- MENU 4: AUDIT ----------
$("btnAudit").onclick = ()=>{
  const hit = {};
  $("auditData").value.split("\n").map(x=>x.trim()).filter(Boolean)
    .forEach(x=> hit[x]=(hit[x]||0)+1);
  const dup = Object.entries(hit).filter(([k,v])=>v>1);
  $("auditHasil").innerHTML = dup.length ?
   `<p class="err">Ditemukan ${dup.length} nomor ganda!</p>
    <table><tr><th>Packing</th><th>Muncul</th></tr>`+
   dup.map(([k,v])=>`<tr><td><b>${k}</b></td><td>${v} kali</td></tr>`).join("")+`</table>`
   : `<p class="ok">Tidak ada duplikasi. Data bersih.</p>`;
};

// ---------- UTIL ----------
function tabelHTML(items){
  return `<table><tr><th>Packing</th><th>Shipment</th><th>Code</th><th>Description</th>
  <th>Size</th><th>Colour</th><th>Qty</th><th>Ket</th></tr>`+
  items.map(i=>`<tr><td><b>${i.packing_no}</b></td><td>${i.shipment_no}</td><td>${i.code||""}</td>
  <td>${i.description||""}</td><td>${i.size||""}</td><td>${i.colour||""}</td><td>${i.qty||""}</td>
  <td>${i.replacement?"REPLACEMENT":""}</td></tr>`).join("")+`</table>`;
}
function labelHTML(d){
  const ship = d.shipment_no + (d.replacement ?
    ' <span style="color:#d40000;font-weight:bold"># REPLACEMENT</span>' : "");
  const c = "border:2px solid #000;padding:6px 10px;font-family:Arial";
  return `<table style="border-collapse:collapse;width:430px">
  <tr><td style="${c};width:140px">PACKING NO</td>
  <td style="${c};font-size:46px;font-weight:bold;text-align:center">${d.packing_no}</td></tr>
  <tr><td style="${c}">SHIPMENT NO</td><td style="${c};font-weight:bold">${ship}</td></tr>
  <tr><td style="${c}">CODE</td><td style="${c};font-weight:bold">${d.code||""}</td></tr>
  <tr><td style="${c}">DESCRIPTION</td><td style="${c};font-weight:bold">${d.description||""}</td></tr>
  <tr><td style="${c}">SIZE</td><td style="${c};font-weight:bold">${d.size||""}</td></tr>
  <tr><td style="${c}">COLOUR</td><td style="${c};font-weight:bold">${d.colour||""}</td></tr>
  <tr><td style="${c}">QTY</td><td style="${c};font-weight:bold">${d.qty||""}</td></tr></table>`;
}
function cetakLabels(items){
  const blok = items.map(d=>`<div style="margin-bottom:14px;page-break-inside:avoid">
    ${labelHTML(d)}</div>`).join("");
  const w = window.open("", "_blank");
  w.document.write(`<html><head><style>body{zoom:1.2}</style></head>
  <body onload="window.print()">${blok}</body></html>`);
  w.document.close();
}
async function unduhExcel(items, nama){
  const r = await fetch("/api/export",{method:"POST",
    headers:{"Content-Type":"application/json"}, body:JSON.stringify({items})});
  if(!r.ok){ alert("Gagal export Excel."); return; }
  const b = await r.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b); a.download = nama; a.click();
}

init();