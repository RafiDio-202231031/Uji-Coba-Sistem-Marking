// =====================================================================
//  app.js - JAVASCRIPT client-side (GitHub Pages ready)
//  Data tersimpan di localStorage browser — TIDAK butuh server Python
// =====================================================================
const $ = id => document.getElementById(id);
const state = { user:null, role:null, batch:[], list:[], cetakItems:[] };
const WARNA_OPSI = ["Natural Waterbase","Black Burnt","Black","Dirty Brown",
                    "Rustic","White Bleached","Bleached"];

const DB = {
  get(k, d){ try{ const v = JSON.parse(localStorage.getItem(k));
    return (v===null || v===undefined) ? d : v; }catch(e){ return d; } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};
const loadPacking = () => DB.get("jva_packing", []);
const savePacking = v => DB.set("jva_packing", v);
const warnaList  = () => WARNA_OPSI.concat(DB.get("jva_warna", []));
const kunci = no => String(no).split(/[.\-]/).filter(x=>/^\d+$/.test(x)).map(Number);
function cmpKunci(a,b){ const ka=kunci(a), kb=kunci(b);
  for(let i=0;i<Math.max(ka.length,kb.length);i++){ const x=ka[i]||0, y=kb[i]||0;
    if(x!==y) return x-y; } return 0; }
const now = () => new Date().toLocaleString("id-ID");

async function sha256(t){
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function seedUsers(){
  if(!DB.get("jva_users", null)){
    const h = await sha256("admin123");
    DB.set("jva_users", [{username:"admin", hash:h, role:"admin"}]);
  }
}
function logAudit(aksi, ship, pack, detail=""){
  const l = DB.get("jva_audit", []);
  l.unshift({created_at:now(), aksi, shipment_no:ship, packing_no:pack, detail,
             oleh:state.user||""});
  DB.set("jva_audit", l.slice(0, 50));
}
const show = (el,on=true)=> el.classList.toggle("hidden", !on);

// ---------------- MODAL ----------------
let modalOkFn = null;
function openModal(title, bodyHTML, onOk, okText="✅ Ya"){
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = bodyHTML;
  $("modalOk").textContent = okText;
  modalOkFn = onOk; show($("modal"));
}
$("modalBatal").onclick = ()=> show($("modal"), false);
$("modalOk").onclick = ()=>{ show($("modal"), false); if(modalOkFn) modalOkFn(); };

// ---------------- AUTH ----------------
async function init(){
  await seedUsers();
  const s = DB.get("jva_session", null);
  if(s){ state.user=s.user; state.role=s.role; masukUI(); }
}
function masukUI(){
  show($("viewLogin"), false); show($("viewMain"));
  $("userName").textContent = state.user; show($("btnUser"));
  document.querySelectorAll(".admin-only").forEach(e=> show(e, state.role==="admin"));
  muatWarna(); muatKode();
}
$("btnLogin").onclick = async ()=>{
  const u = $("loginUser").value.trim(), p = $("loginPass").value;
  const h = await sha256(p);
  const row = DB.get("jva_users", []).find(x=>x.username===u && x.hash===h);
  if(row){ state.user=row.username; state.role=row.role;
    DB.set("jva_session", {user:row.username, role:row.role}); masukUI(); }
  else { $("loginErr").textContent="Nama pengguna atau kata sandi salah."; show($("loginErr")); }
};
$("btnUser").onclick = ()=> show($("userMenu"), $("userMenu").classList.contains("hidden"));
$("btnKeluar").onclick = ()=>{ localStorage.removeItem("jva_session"); location.reload(); };
$("btnGantiSandi").onclick = ()=> openModal("🔑 Ganti Kata Sandi",
  `<label>Kata sandi lama</label><input id="mLama" type="password">
   <label>Kata sandi baru</label><input id="mBaru" type="password">`,
  async ()=>{
    const users = DB.get("jva_users", []);
    const me = users.find(x=>x.username===state.user);
    if(await sha256($("mLama").value) !== me.hash){ alert("Kata sandi lama salah."); return; }
    if($("mBaru").value.length < 6){ alert("Kata sandi baru minimal 6 karakter."); return; }
    me.hash = await sha256($("mBaru").value);
    DB.set("jva_users", users); alert("Kata sandi diganti.");
  }, "💾 Simpan");
$("btnManajemen").onclick = ()=> openModal("👥 Tambah Pengguna",
  `<label>Username</label><input id="mUser">
   <label>Kata sandi</label><input id="mPass" type="password">
   <label>Peran</label><select id="mRole"><option>staff</option><option>admin</option></select>`,
  async ()=>{
    const users = DB.get("jva_users", []);
    const u = $("mUser").value.trim();
    if(!u || $("mPass").value.length < 6){ alert("Lengkapi username & sandi (min. 6)."); return; }
    if(users.find(x=>x.username===u)){ alert("Username sudah dipakai."); return; }
    users.push({username:u, hash:await sha256($("mPass").value), role:$("mRole").value});
    DB.set("jva_users", users); alert("Pengguna ditambahkan.");
  }, "➕ Tambah");

// ---------------- TAB ----------------
document.querySelectorAll(".tab").forEach(t=> t.onclick = ()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  t.classList.add("active");
  document.querySelectorAll(".tabview").forEach(v=> show(v, v.id==="tab-"+t.dataset.tab));
  if(t.dataset.tab==="cetak"){ muatShipsCetak(); muatLogCetak(); }
});

// ---------------- REFERENSI ----------------
function muatWarna(){
  const w = warnaList();
  $("warna").innerHTML = w.map(x=>`<option>${x}</option>`).join("") +
    `<option value="__lain">Lainnya (ketik manual)</option>`;
  $("filterWarna").innerHTML = `<option>Semua warna</option>` +
    w.map(x=>`<option>${x}</option>`).join("");
}
$("warna").onchange = ()=> show($("wrapWarnaBaru"), $("warna").value==="__lain");
function muatKode(){
  const kode = [...new Set(loadPacking().map(i=>{
    const m = String(i.shipment_no).match(/^[A-Za-z]+/); return m ? m[0] : "";
  }).filter(Boolean))].sort();
  const opts = kode.map(x=>`<option>${x}</option>`).join("") +
    `<option value="__manual">— ketik manual —</option>`;
  $("kodeBuyer").innerHTML = opts; $("cetakKode").innerHTML = opts;
}
$("kodeBuyer").onchange = ()=> show($("wrapManual"), $("kodeBuyer").value==="__manual");
$("cetakKode").onchange = ()=>{ show($("wrapCetakManual"), $("cetakKode").value==="__manual");
  muatShipsCetak(); };

// ---------------- MENU 1: BUAT ----------------
$("mode").onchange = ()=> show($("wrapJumlah"), $("mode").value==="borongan");
function nextRange(ship, utama, jumlah){
  const subs = loadPacking()
    .filter(i=>i.shipment_no===ship && String(i.packing_no).startsWith(utama+"."))
    .map(i=>parseInt(String(i.packing_no).split(".")[1]))
    .filter(n=>!isNaN(n));
  const start = subs.length ? Math.max(...subs)+1 : 1;
  return {start, first:`${utama}.${start}`, last:`${utama}.${start+jumlah-1}`};
}
function preview(){
  const s=$("shipment").value.trim(), u=$("utama").value.trim();
  const j = $("mode").value==="borongan" ? (+$("jumlah").value||1) : 1;
  if(s && /^\d+$/.test(u)){
    const r = nextRange(s,u,j);
    $("previewNo").textContent = `Akan diterbitkan: ${r.first} s/d ${r.last} (${j} label)`;
    show($("previewNo"));
  } else show($("previewNo"), false);
}
["shipment","utama","jumlah"].forEach(id=> $(id).addEventListener("input", preview));
$("btnTerbitkan").onclick = ()=>{
  const ship = $("shipment").value.trim(), utama = $("utama").value.trim();
  const jumlah = $("mode").value==="borongan" ? (+$("jumlah").value||1) : 1;
  if(!ship || !/^\d+$/.test(utama)){ alert("Shipment No dan Nomor Utama (angka) wajib diisi."); return; }
  const warna = $("warna").value==="__lain" ? $("warnaBaru").value.trim() : $("warna").value;
  if($("warna").value==="__lain" && !warna){ alert("Ketik nama warnanya dahulu."); return; }
  if($("warna").value==="__lain"){
    const w = DB.get("jva_warna", []);
    if(!w.includes(warna)){ w.push(warna); DB.set("jva_warna", w); }
  }
  const all = loadPacking();
  const exist = new Set(all.map(i=>i.shipment_no+"|"+i.packing_no));
  const r = nextRange(ship, utama, jumlah);
  const items = [];
  let id = all.reduce((m,i)=>Math.max(m,i.id||0),0);
  for(let i=0;i<jumlah;i++){
    const no = `${utama}.${r.start+i}`;
    if(exist.has(ship+"|"+no)){ alert("Nomor "+no+" sudah ada."); return; }
    items.push({id:++id, packing_no:no, shipment_no:ship, code:$("code").value,
      description:$("desc").value, size:$("size").value, colour:warna,
      qty:$("qty").value, replacement:$("repl").checked?1:0,
      created_at:now(), created_by:state.user});
  }
  savePacking(all.concat(items));
  state.batch = items;
  $("buatMsg").className="ok";
  $("buatMsg").textContent = `${items.length} label diterbitkan: ${items[0].packing_no} s/d ${items[items.length-1].packing_no}.`;
  show($("hasilBuat")); $("tabelHasil").innerHTML = tabelHTML(items);
  muatKode();
};
$("btnPrintHasil").onclick = ()=> cetakLabels(state.batch);
$("btnExcelHasil").onclick = ()=> unduhCSV(state.batch, "packing.csv");

// ---------------- MENU 2: DAFTAR ----------------
$("btnMuat").onclick = muatDaftar;
function filterList(){
  const manual = $("kodeBuyer").value==="__manual" ? $("manualPrefix").value.trim() : "";
  const kode = manual ? "" : $("kodeBuyer").value;
  const warna = $("filterWarna").value;
  let items = loadPacking();
  items = manual ? items.filter(i=>i.shipment_no.startsWith(manual))
    : items.filter(i=> i.shipment_no.startsWith(kode+"/") || i.shipment_no.startsWith(kode+" "));
  if(warna!=="Semua warna")
    items = items.filter(i=>(i.colour||"").trim().toLowerCase()===warna.toLowerCase());
  items.sort((a,b)=> a.shipment_no===b.shipment_no ? cmpKunci(a.packing_no,b.packing_no)
    : a.shipment_no.localeCompare(b.shipment_no));
  return items;
}
function muatDaftar(){
  state.list = filterList();
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
  ()=>{ const baru=$("mShip").value.trim(); if(!baru){alert("Wajib diisi.");return;}
    const all = loadPacking();
    const punya = new Set(all.filter(i=>i.shipment_no===baru).map(i=>i.packing_no));
    const konflik = all.filter(i=>i.shipment_no===ship && punya.has(i.packing_no));
    if(konflik.length){ alert("Gagal: sebagian nomor sudah ada di shipment tujuan."); return; }
    all.forEach(i=>{ if(i.shipment_no===ship) i.shipment_no=baru; });
    savePacking(all); logAudit("EDIT SHIPMENT", baru, "-", "dari: "+ship); muatDaftar();
  }, "💾 Simpan"); };
$("btnHapusShip").onclick = ()=>{ const ship=$("kelolaShip").value;
  const n = state.list.filter(i=>i.shipment_no===ship).length;
  openModal("⚠️ Konfirmasi Hapus",
  `<p>Shipment <b>${ship}</b> berisi <b>${n} koli</b> akan dihapus permanen.</p>`,
  ()=>{ savePacking(loadPacking().filter(i=>i.shipment_no!==ship));
    logAudit("HAPUS SHIPMENT", ship, "-", n+" koli dihapus"); muatDaftar(); },
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
  ()=>{ const all = loadPacking();
    const dup = all.find(i=>i.id!==r.id && i.shipment_no===$("mShip2").value.trim()
      && i.packing_no===$("mPack").value.trim());
    if(dup){ alert("Kombinasi Shipment + Packing No sudah dipakai."); return; }
    const t = all.find(i=>i.id===r.id);
    Object.assign(t, {packing_no:$("mPack").value.trim(), shipment_no:$("mShip2").value.trim(),
      code:$("mCode").value, description:$("mDesc").value, size:$("mSize").value,
      colour:$("mColour").value, qty:$("mQty").value, replacement:$("mRepl").checked?1:0});
    savePacking(all); logAudit("EDIT LABEL", t.shipment_no, t.packing_no, "via web"); muatDaftar();
  }, "💾 Simpan"); };
$("btnHapusPack").onclick = ()=>{ const r=cariRow($("kelolaShip").value,$("kelolaPack").value); if(!r)return;
  openModal("⚠️ Konfirmasi Hapus",
  `<p>Nomor <b>${r.packing_no}</b> (shipment <b>${r.shipment_no}</b>) akan dihapus permanen.</p>`,
  ()=>{ savePacking(loadPacking().filter(i=>i.id!==r.id));
    logAudit("HAPUS LABEL", r.shipment_no, r.packing_no, "description: "+(r.description||""));
    muatDaftar(); }, "✅ Ya, Hapus"); };
$("btnExcelDaftar").onclick = ()=> unduhCSV(state.list, "packing_daftar.csv");

// ---------------- MENU 3: CETAK ULANG ----------------
function muatShipsCetak(){
  const manual = $("cetakKode").value==="__manual" ? $("cetakManual").value.trim() : "";
  const kode = manual ? "" : $("cetakKode").value;
  state.cetakItems = loadPacking().filter(i=> manual
    ? i.shipment_no.startsWith(manual)
    : (i.shipment_no.startsWith(kode+"/") || i.shipment_no.startsWith(kode+" ")));
  const ships = [...new Set(state.cetakItems.map(i=>i.shipment_no))].sort();
  $("cetakShip").innerHTML = ships.map(s=>`<option>${s}</option>`).join("");
  isiCetakPack();
}
$("cetakShip").onchange = isiCetakPack;
function isiCetakPack(){
  $("cetakPack").innerHTML = (state.cetakItems||[])
    .filter(i=>i.shipment_no===$("cetakShip").value)
    .sort((a,b)=>cmpKunci(a.packing_no,b.packing_no))
    .map(i=>`<option>${i.packing_no}</option>`).join("");
}
$("btnCetakUlang").onclick = ()=>{
  const r = (state.cetakItems||[]).find(i=>i.shipment_no===$("cetakShip").value
    && i.packing_no===$("cetakPack").value); if(!r) return;
  openModal("🖨️ Cetak Ulang",
  `<p>Cetak ulang nomor <b>${r.packing_no}</b>? Kejadian ini akan dicatat.</p>
   <label>Alasan</label><input id="mAlasan" value="Label sobek">`,
  ()=>{ const l = DB.get("jva_reprint", []);
    l.unshift({created_at:now(), shipment_no:r.shipment_no, packing_no:r.packing_no,
      alasan:$("mAlasan").value, oleh:state.user});
    DB.set("jva_reprint", l.slice(0,50));
    cetakLabels([r]); muatLogCetak(); }, "🖨️ Cetak");
};
function muatLogCetak(){
  const logs = DB.get("jva_reprint", []);
  $("logCetak").innerHTML = logs.length ?
   `<table><tr><th>Waktu</th><th>Shipment</th><th>Packing</th><th>Alasan</th><th>Oleh</th></tr>`+
   logs.map(l=>`<tr><td>${l.created_at}</td><td>${l.shipment_no}</td><td>${l.packing_no}</td>
   <td>${l.alasan}</td><td>${l.oleh}</td></tr>`).join("")+`</table>` : "";
}

// ---------------- MENU 4: AUDIT ----------------
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

// ---------------- UTIL ----------------
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
function unduhCSV(items, nama){
  const head = ["packing_no","shipment_no","code","description","size","colour","qty","replacement"];
  const esc = v => '"' + String(v === undefined || v === null ? "" : v).replace(/"/g,'""') + '"';
  const rows = items.map(i=> head.map(h=> esc(i[h])).join(","));
  const blob = new Blob(["\ufeff" + head.join(",") + "\n" + rows.join("\n")],
    {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nama; a.click();
}

init();
