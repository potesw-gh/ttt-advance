/**
 * Advance Tracker — Ten Ten Ten Co., Ltd
 * ตัวเชื่อมระหว่างหน้าเว็บกรอกเงิน advance กับ Google Sheet
 *
 * วิธีติดตั้ง (ทำครั้งเดียว)
 *   1. สร้าง Google Sheet เปล่า 1 ไฟล์ ตั้งชื่อว่า "Advance TenTenTen"
 *   2. ในชีตนั้น เมนู Extensions > Apps Script
 *   3. ลบโค้ดเดิมทิ้ง วางไฟล์นี้แทน แล้วกด Save
 *   4. กด Deploy > New deployment > เลือก type เป็น Web app
 *        Execute as        : Me
 *        Who has access    : Anyone
 *   5. กด Deploy แล้วอนุญาตสิทธิ์ (จะมีหน้าเตือน Google ยังไม่ verify — กด Advanced > Go to ...)
 *   6. คัดลอก Web app URL (ลงท้ายด้วย /exec) ส่งกลับมาให้ผม
 *
 * โครงข้อมูลที่หน้าเว็บส่งมา (POST, body เป็น JSON ใน text/plain)
 *   { items: [ {id, type:'out'|'in', date:'YYYY-MM-DD', amount, note,
 *               photo, by, updatedAt, deleted} ] }
 * ตอบกลับ
 *   { ok:true, items:[...], deleted:[id,...], savedAt }
 */

const SHEET_MAIN  = 'รายการ';
const SHEET_TRASH = 'ลบแล้ว';
const SHEET_SUM   = 'สรุป';
const SLIP_FOLDER = 'สลิป Advance TenTenTen';

/* คอลัมน์: เรียงให้คนอ่านง่าย ส่วน id ไว้ท้ายสุดแล้วซ่อน */
const HEAD = ['วันที่', 'ประเภท', 'รายละเอียด', 'จำนวนเงิน', 'สลิป', 'ผู้บันทึก', 'อัปเดตล่าสุด', 'id'];
const C = {date:0, type:1, note:2, amount:3, slip:4, by:5, updated:6, id:7};

/* ---------------------------------------------------------------- helpers */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name, head) {
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head])
      .setFontWeight('bold').setBackground('#1a1a1a').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 95);   // วันที่
    sh.setColumnWidth(2, 80);   // ประเภท
    sh.setColumnWidth(3, 260);  // รายละเอียด
    sh.setColumnWidth(4, 110);  // จำนวนเงิน
    sh.setColumnWidth(5, 150);  // สลิป
    if (name === SHEET_MAIN) sh.hideColumns(C.id + 1);
  }
  return sh;
}

function readRows_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, HEAD.length).getValues();
}

/** แปลงวันที่ 'YYYY-MM-DD' เป็น Date แบบไม่เพี้ยน timezone */
function toDate_(s) {
  const p = String(s || '').split('-').map(Number);
  if (p.length !== 3 || !p[0] || isNaN(p[0])) return new Date();   // กันข้อมูลขาด
  return new Date(p[0], p[1] - 1, p[2]);
}
function toISO_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, ss_().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  }
  return String(v || '').slice(0, 10);
}

/** เก็บรูปสลิปลง Drive แล้วคืนลิงก์ที่เปิดดูได้ */
function saveSlip_(dataUrl, id) {
  const m = String(dataUrl).match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!m) return String(dataUrl);          // เป็นลิงก์อยู่แล้ว ไม่ต้องทำอะไร

  const folders = DriveApp.getFoldersByName(SLIP_FOLDER);
  const folder  = folders.hasNext() ? folders.next() : DriveApp.createFolder(SLIP_FOLDER);

  const ext  = m[1] === 'image/png' ? 'png' : 'jpg';
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], 'slip-' + id + '.' + ext);

  /* ถ้ามีไฟล์ชื่อเดิมอยู่แล้ว (แก้ไขรายการเดิม) ให้ทิ้งของเก่าก่อน */
  const old = folder.getFilesByName(blob.getName());
  while (old.hasNext()) old.next().setTrashed(true);

  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function rowOf_(it) {
  const r = [];
  r[C.date]    = toDate_(it.date);
  r[C.type]    = it.type === 'in' ? 'รายรับ' : 'รายจ่าย';
  r[C.note]    = it.note || '';
  r[C.amount]  = Number(it.amount) || 0;
  r[C.slip]    = it.photo || '';
  r[C.by]      = it.by || '';
  r[C.updated] = new Date(Number(it.updatedAt) || Date.now());
  r[C.id]      = it.id;
  return r;
}

function itemOf_(r) {
  return {
    id:        String(r[C.id]),
    type:      r[C.type] === 'รายรับ' ? 'in' : 'out',
    date:      toISO_(r[C.date]),
    note:      String(r[C.note] || ''),
    amount:    Number(r[C.amount]) || 0,
    photo:     String(r[C.slip] || '') || null,
    by:        String(r[C.by] || ''),
    updatedAt: r[C.updated] instanceof Date ? r[C.updated].getTime() : Number(r[C.updated]) || 0,
  };
}

/* ------------------------------------------------------------------- sync */

function sync_(incoming) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);                     // กันสองเครื่องเขียนชนกัน
  try {
    const main  = sheet_(SHEET_MAIN,  HEAD);
    const trash = sheet_(SHEET_TRASH, HEAD);

    /* --- อ่านของที่มีอยู่ --- */
    const byId = new Map();
    readRows_(main).forEach(r => { if (r[C.id]) byId.set(String(r[C.id]), itemOf_(r)); });

    const dead = new Set();
    readRows_(trash).forEach(r => { if (r[C.id]) dead.add(String(r[C.id])); });

    /* --- รวมของใหม่เข้าไป: id เดิม = แก้ทับ, updatedAt ใหม่กว่าเท่านั้นถึงชนะ --- */
    const trashAdd = [];
    (incoming || []).forEach(it => {
      if (!it || !it.id) return;
      const id  = String(it.id);
      const cur = byId.get(id);
      const ts  = Number(it.updatedAt) || 0;

      if (it.deleted) {
        if (byId.has(id)) { trashAdd.push(rowOf_(Object.assign({}, cur, it))); byId.delete(id); }
        else if (!dead.has(id)) { trashAdd.push(rowOf_(it)); }
        dead.add(id);
        return;
      }
      if (dead.has(id)) return;                       // ลบไปแล้ว อย่าปลุกกลับมา
      if (cur && ts <= cur.updatedAt) return;         // ของในชีตใหม่กว่า เก็บของเดิมไว้

      const clean = Object.assign({}, it);
      if (clean.photo) clean.photo = saveSlip_(clean.photo, id);
      byId.set(id, itemOf_(rowOf_(clean)));
    });

    /* --- เขียนกลับ เรียงวันที่ใหม่สุดอยู่บน --- */
    const items = [...byId.values()].sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : b.updatedAt - a.updatedAt);

    if (main.getLastRow() > 1) main.getRange(2, 1, main.getLastRow() - 1, HEAD.length).clearContent();
    if (items.length) {
      main.getRange(2, 1, items.length, HEAD.length).setValues(items.map(rowOf_));
      main.getRange(2, C.date + 1,   items.length, 1).setNumberFormat('d mmm yyyy');
      main.getRange(2, C.amount + 1, items.length, 1).setNumberFormat('#,##0.00');
      main.getRange(2, C.updated + 1, items.length, 1).setNumberFormat('d mmm yyyy HH:mm');
    }
    if (trashAdd.length) trash.getRange(trash.getLastRow() + 1, 1, trashAdd.length, HEAD.length).setValues(trashAdd);

    summary_(items);
    return {ok: true, items: items, deleted: [...dead], savedAt: Date.now()};
  } finally {
    lock.releaseLock();
  }
}

/** แท็บสรุปยอด — คำนวณใหม่ทุกครั้งที่ซิงก์ */
function summary_(items) {
  const sh = sheet_(SHEET_SUM, ['หัวข้อ', 'จำนวนเงิน']);
  const inSum  = items.filter(i => i.type === 'in').reduce((s, i) => s + i.amount, 0);
  const outSum = items.filter(i => i.type === 'out').reduce((s, i) => s + i.amount, 0);

  const byMonth = {};
  items.forEach(i => {
    const k = i.date.slice(0, 7);
    byMonth[k] = byMonth[k] || {in: 0, out: 0};
    byMonth[k][i.type] += i.amount;
  });

  const rows = [
    ['รับมาทั้งหมด', inSum],
    ['ใช้ไปทั้งหมด', outSum],
    ['คงเหลือในมือ', inSum - outSum],
    ['', ''],
    ['แยกตามเดือน', ''],
  ];
  Object.keys(byMonth).sort().reverse().forEach(k => {
    rows.push([k + '  รับ', byMonth[k].in]);
    rows.push([k + '  ใช้', byMonth[k].out]);
  });

  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).clearContent();
  sh.getRange(2, 1, rows.length, 2).setValues(rows);
  sh.getRange(2, 2, rows.length, 1).setNumberFormat('#,##0.00');
  sh.getRange(4, 1, 1, 2).setFontWeight('bold');
}

/* ---------------------------------------------------------------- web app */

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  try {
    const main  = sheet_(SHEET_MAIN,  HEAD);
    const trash = sheet_(SHEET_TRASH, HEAD);
    const items = readRows_(main).filter(r => r[C.id]).map(itemOf_);
    const dead  = readRows_(trash).filter(r => r[C.id]).map(r => String(r[C.id]));
    return json_({ok: true, items: items, deleted: dead, savedAt: Date.now()});
  } catch (err) {
    return json_({ok: false, error: String(err)});
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return json_(sync_(body.items || []));
  } catch (err) {
    return json_({ok: false, error: String(err)});
  }
}

/* กดรันฟังก์ชันนี้ครั้งเดียวหลังวางโค้ด เพื่อสร้างแท็บและขออนุญาตสิทธิ์ Drive */
function setup() {
  sheet_(SHEET_MAIN, HEAD);
  sheet_(SHEET_TRASH, HEAD);
  summary_([]);
  SpreadsheetApp.getUi().alert('สร้างแท็บเรียบร้อย — ต่อไปกด Deploy > New deployment > Web app');
}
