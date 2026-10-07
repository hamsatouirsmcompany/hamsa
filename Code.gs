/**
 * Hamsa Tourism - Apps Script backend
 * 1) افتح Google Sheet جديد > Extensions > Apps Script وألصق هذا الكود
 * 2) Project Settings > Script properties: أضف ADMIN_USER و ADMIN_PASS
 * 3) Deploy > New deployment > Web app (Execute as: Me, Access: Anyone)
 */
const SHEET = 'Offers';
const HEAD = ['id', 'section', 'title', 'price', 'details', 'image', 'link', 'updated'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) { sh = ss.insertSheet(SHEET); sh.appendRow(HEAD); }
  return sh;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const rows = sheet_().getDataRange().getValues();
  const offers = rows.slice(1).filter(r => r[0]).map(r => {
    const o = {};
    HEAD.forEach((h, i) => o[h] = r[i]);
    return o;
  });
  return json_({ ok: true, offers: offers });
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad' }); }
  const props = PropertiesService.getScriptProperties();
  const cache = CacheService.getScriptCache();

  if (d.action === 'login') {
    Utilities.sleep(800); // يبطّئ التخمين
    if (d.user === props.getProperty('ADMIN_USER') && d.pass === props.getProperty('ADMIN_PASS')) {
      const token = Utilities.getUuid();
      cache.put('tok_' + token, '1', 21600); // 6 ساعات
      return json_({ ok: true, token: token });
    }
    return json_({ ok: false });
  }

  if (!d.token || !cache.get('tok_' + d.token)) return json_({ ok: false, error: 'auth' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_();
    const data = sh.getDataRange().getValues();
    const find = id => data.findIndex((r, i) => i > 0 && String(r[0]) === String(id));

    if (d.action === 'save') {
      const o = d.offer || {};
      const id = o.id || Utilities.getUuid();
      const row = [id, o.section, o.title, o.price, o.details, o.image, o.link, new Date()];
      const idx = o.id ? find(o.id) : -1;
      if (idx > 0) sh.getRange(idx + 1, 1, 1, row.length).setValues([row]);
      else sh.appendRow(row);
      return json_({ ok: true, id: id });
    }
    if (d.action === 'delete') {
      const idx = find(d.id);
      if (idx > 0) sh.deleteRow(idx + 1);
      return json_({ ok: true });
    }
    return json_({ ok: false, error: 'unknown' });
  } finally {
    lock.releaseLock();
  }
}
