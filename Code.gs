// ===== همسة للسياحة — الخلفية (Apps Script) =====
// الخطوات: افتح Google Sheet جديد > Extensions > Apps Script > الصق الملف ده
// غيّر OWNER_PASS تحت، ثم شغّل الدالة setup() مرة واحدة، ثم Deploy > New deployment > Web app
// (Execute as: Me — Who has access: Anyone)
const OWNER_USER = 'admin';
const OWNER_PASS = 'غيّر-كلمة-السر-دي-قبل-التشغيل';
const OWNER_NAME = 'المدير الرئيسي';
const NOTIFY_EMAIL = ''; // اختياري: إيميل يوصله تنبيه عند كل طلب جديد

const COLS = {
  Offers: ['id','title','category','priceFrom','price','details','hotel','stars','city','airline','duration','image','status','updatedBy','updatedAt'],
  Leads: ['id','time','name','phone','governorate','service','people','travelDate','payment','notes','status','account'],
  Users: ['username','name','role','salt','hash','active'],
  Log: ['time','user','action','offerId','data'],
  Favs: ['username','ids']
};

function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(COLS).forEach(n => {
    let s = ss.getSheetByName(n) || ss.insertSheet(n);
    if (s.getLastRow() === 0) s.appendRow(COLS[n]);
    else { const h = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0]; COLS[n].filter(c => !h.includes(c)).forEach((c, i) => s.getRange(1, h.length + i + 1).setValue(c)); } // يضيف أي عمود جديد
  });
  if (!rows('Users').length) addUserRow(OWNER_USER, OWNER_NAME, 'owner', OWNER_PASS);
  if (!rows('Offers').length) seed();
}

// لو نسيت كلمة سر المدير أو غيّرت OWNER_PASS بعد setup(): غيّرها فوق ثم شغّل الدالة دي مرة واحدة
function resetOwnerPassword() {
  addUserRow(OWNER_USER, OWNER_NAME, 'owner', OWNER_PASS);
  CacheService.getScriptCache().remove('f_' + OWNER_USER); // يفك قفل المحاولات الغلط
}

// ---------- أدوات ----------
const now = () => new Date().toISOString();
const sh = n => SpreadsheetApp.getActive().getSheetByName(n);
function table(n) { const s = sh(n), v = s.getDataRange().getValues(), h = v.shift(); return { s, h, v }; }
function rows(n) { const t = table(n); return t.v.map(r => Object.fromEntries(t.h.map((k, i) => [k, r[i]]))); }
function upsert(n, key, o, fix) { // أسرع: يقرأ العمود المفتاحي والصف المطلوب بس، ويرجّع الصف القديم
  const s = sh(n), lc = s.getLastColumn(), lr = s.getLastRow();
  const h = s.getRange(1, 1, 1, lc).getValues()[0], ki = h.indexOf(key);
  let i = -1, cur = null;
  if (lr > 1) { i = s.getRange(2, ki + 1, lr - 1, 1).getValues().findIndex(r => String(r[0]) === String(o[key])); if (i >= 0) cur = s.getRange(i + 2, 1, 1, lc).getValues()[0]; }
  const old = cur ? Object.fromEntries(h.map((k, c) => [k, cur[c]])) : null;
  if (fix) fix(old, o);
  const row = h.map((k, c) => o[k] !== undefined ? o[k] : (cur ? cur[c] : ''));
  if (i >= 0) s.getRange(i + 2, 1, 1, row.length).setValues([row]); else s.appendRow(row);
  return old;
}
const bust = () => CacheService.getScriptCache().remove('pub'); // يمسح كاش صفحة الزوار بعد أي تعديل
function log(user, action, offerId, data) { sh('Log').appendRow([now(), user, action, offerId || '', JSON.stringify(data || '')]); }
function hash(p, s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s + p).map(b => ('0' + (b & 255).toString(16)).slice(-2)).join(''); }
function addUserRow(username, name, role, pass) {
  const salt = Utilities.getUuid();
  upsert('Users', 'username', { username, name, role, salt, hash: hash(pass, salt), active: true });
}
const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);

// ---------- الدخول ----------
function userOf(u) { // كاش 5 دقايق عشان ما نقراش شيت المستخدمين في كل طلب
  const c = CacheService.getScriptCache(), k = 'u_' + u, j = c.get(k);
  if (j) return JSON.parse(j);
  const x = rows('Users').find(x => x.username === u && x.active === true);
  if (!x) return null;
  const r = { username: x.username, name: x.name, role: x.role }; c.put(k, JSON.stringify(r), 300); return r;
}
function auth(token, ownerOnly, anyRole) {
  const u = token && CacheService.getScriptCache().get('s_' + token);
  if (!u) throw new Error('سجّل الدخول من جديد');
  const user = userOf(u);
  if (!user) throw new Error('الحساب موقوف');
  if (!anyRole && user.role === 'visitor') throw new Error('غير مسموح');
  if (ownerOnly && user.role !== 'owner') throw new Error('الصلاحية للمدير الرئيسي فقط');
  return user;
}
function login(u, p) {
  u = String(u || '').trim(); const c = CacheService.getScriptCache(), k = 'f_' + u.toLowerCase();
  if (Number(c.get(k) || 0) >= 5) throw new Error('محاولات كتير. جرّب بعد 10 دقايق');
  const user = rows('Users').find(x => String(x.username).toLowerCase() === u.toLowerCase() && x.active === true);
  if (!user || user.hash !== hash(p, user.salt)) { c.put(k, String(Number(c.get(k) || 0) + 1), 600); throw new Error('بيانات الدخول غلط'); }
  const token = Utilities.getUuid() + Utilities.getUuid();
  c.put('s_' + token, user.username, 21600);
  return { token, name: user.name, role: user.role };
}

// ---------- الواجهة العامة ----------
function doGet() {
  const c = CacheService.getScriptCache(); let j = c.get('pub');
  if (!j) {
    j = JSON.stringify({ offers: rows('Offers').filter(o => o.status === 'active').map(o => { delete o.updatedBy; return o; }) });
    try { c.put('pub', j, 120); } catch (x) {}
  }
  return ContentService.createTextOutput(j).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    switch (d.action) {
      case 'login': return out(login(d.u, d.p));
      case 'register': {
        const c = CacheService.getScriptCache(), n = Number(c.get('reg') || 0);
        if (n >= 30) throw new Error('حاول مرة تانية بعد شوية');
        const email = String(d.email || '').trim().toLowerCase(), name = String(d.name || '').trim().slice(0, 60);
        if (name.length < 2) throw new Error('اكتب اسمك');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 80) throw new Error('اكتب إيميل صحيح');
        if (String(d.password || '').length < 8) throw new Error('كلمة السر 8 حروف أو أكتر');
        if (rows('Users').some(x => String(x.username).toLowerCase() === email)) throw new Error('الإيميل ده مسجّل قبل كده. سجّل دخول');
        c.put('reg', String(n + 1), 3600);
        addUserRow(email, name, 'visitor', d.password); return out({ ok: true });
      }
      case 'favs': case 'toggleFav': {
        const u = auth(d.token, false, true), r0 = rows('Favs').find(x => x.username === u.username);
        const set = new Set(r0 && r0.ids ? String(r0.ids).split(',') : []);
        if (d.action === 'toggleFav') { const id = String(d.id || '').replace(/[^\w-]/g, '').slice(0, 40); if (id) { set.has(id) ? set.delete(id) : set.add(id); } upsert('Favs', 'username', { username: u.username, ids: [...set].slice(0, 100).join(',') }); }
        return out({ ids: [...set] });
      }
      case 'myLeads': { const u = auth(d.token, false, true); return out({ leads: rows('Leads').filter(x => x.account === u.username).map(x => ({ time: x.time, service: x.service, status: x.status })).reverse() }); }
      case 'lead': {
        if (d.website) return out({ ok: true }); // فخ للروبوتات
        let acc = ''; try { if (d.token) acc = auth(d.token, false, true).username; } catch (x) {}
        const name = String(d.name || '').trim().slice(0, 100), phone = String(d.phone || '').replace(/[^\d+]/g, '').slice(0, 20);
        if (name.length < 2 || phone.length < 8) throw new Error('اكتب الاسم ورقم الموبايل صح');
        const L = o => String(o || '').slice(0, 300);
        upsert('Leads', 'id', { id: Utilities.getUuid(), time: now(), name, phone, governorate: L(d.governorate), service: L(d.service), people: L(d.people), travelDate: L(d.travelDate), payment: L(d.payment), notes: L(d.notes), status: 'جديد', account: acc });
        if (NOTIFY_EMAIL) try { MailApp.sendEmail(NOTIFY_EMAIL, 'طلب جديد من الموقع', name + ' — ' + phone + ' — ' + L(d.service)); } catch (x) {}
        return out({ ok: true });
      }
      case 'allOffers': auth(d.token); return out({ offers: rows('Offers') });
      case 'saveOffer': {
        const u = auth(d.token), o = d.offer;
        if (!String(o.title || '').trim()) throw new Error('اكتب عنوان العرض');
        o.id = o.id || Utilities.getUuid(); o.updatedBy = u.username; o.updatedAt = now();
        const old = upsert('Offers', 'id', o, (old, n) => { if (u.role !== 'owner') n.status = old ? old.status : 'active'; }); // الموظف ما يغيّرش الإخفاء
        bust(); log(u.username, old ? 'edit' : 'add', o.id, { before: old, after: o });
        return out({ ok: true, id: o.id });
      }
      case 'patchOffers': { // تعديل/إخفاء عدة عروض دفعة واحدة (قراءة وكتابة واحدة بس)
        const u = auth(d.token), items = (d.items || []).slice(0, 60), OK = ['title', 'category', 'priceFrom', 'price', 'details', 'hotel', 'stars', 'city', 'airline', 'duration', 'image', 'status'];
        if (items.some(it => it.status !== undefined) && u.role !== 'owner') throw new Error('الصلاحية للمدير الرئيسي فقط');
        const lock = LockService.getScriptLock(); lock.waitLock(15000);
        try {
          const t = table('Offers'), ix = k => t.h.indexOf(k), pos = {}; let n = 0;
          t.v.forEach((r, i) => pos[String(r[ix('id')])] = i);
          items.forEach(it => {
            const i = pos[String(it.id)]; if (i === undefined) return;
            OK.forEach(k => { if (it[k] === undefined) return; if (k === 'status' && it[k] !== 'active' && it[k] !== 'hidden') return; t.v[i][ix(k)] = it[k]; });
            t.v[i][ix('updatedBy')] = u.username; t.v[i][ix('updatedAt')] = now(); n++;
          });
          if (n) t.s.getRange(2, 1, t.v.length, t.h.length).setValues(t.v);
          bust(); log(u.username, 'patch', '', JSON.stringify(items).slice(0, 4000));
          return out({ ok: true, n });
        } finally { lock.releaseLock(); }
      }
      case 'setStatus': {
        const u = auth(d.token, true);
        upsert('Offers', 'id', { id: d.id, status: d.status, updatedBy: u.username, updatedAt: now() }); bust();
        log(u.username, d.status === 'active' ? 'show' : 'hide', d.id); return out({ ok: true });
      }
      case 'leads': auth(d.token); return out({ leads: rows('Leads').reverse() });
      case 'leadStatus': auth(d.token); upsert('Leads', 'id', { id: d.id, status: d.status }); return out({ ok: true });
      case 'users': auth(d.token, true); return out({ users: rows('Users').filter(u => u.role !== 'visitor').map(u => ({ username: u.username, name: u.name, role: u.role, active: u.active })) });
      case 'addUser': {
        const u = auth(d.token, true);
        if (!/^[a-zA-Z0-9_.@-]{3,40}$/.test(d.username) || String(d.password).length < 8) throw new Error('اسم المستخدم 3 حروف إنجليزي أو أكتر، وكلمة السر 8 أو أكتر');
        if (rows('Users').some(x => x.username === d.username)) throw new Error('اسم المستخدم موجود');
        addUserRow(d.username, d.name, 'staff', d.password); log(u.username, 'addUser', '', d.username); return out({ ok: true });
      }
      case 'setActive': {
        const u = auth(d.token, true);
        if (d.username === u.username) throw new Error('مينفعش توقف حسابك');
        upsert('Users', 'username', { username: d.username, active: !!d.active }); CacheService.getScriptCache().remove('u_' + d.username); log(u.username, 'setActive', '', d); return out({ ok: true });
      }
      default: throw new Error('طلب غير معروف');
    }
  } catch (err) { return out({ error: err.message }); }
}

// ---------- بيانات مبدئية من الصفحات القديمة ----------
function seed() {
  const note = '\nالأسعار للنصف الأول من شهر 9 حسب معامل ريال 13.4 جنيه — اسأل عن الطيران والإضافات.';
  const O = (title, category, priceFrom, price, details, hotel, stars, city, airline, duration) =>
    upsert('Offers', 'id', { id: Utilities.getUuid(), title, category, priceFrom, price, details, hotel, stars, city, airline, duration, image: '', status: 'active', updatedBy: 'seed', updatedAt: now() });
  const city = 'مكة والمدينة', madina = 'المدينة: نسك المدينة / درة الإيمان / طيبة هيلز — 3 ليالي\n';
  octoberOffers();
  [[1000, 24], [1250, 24], [1500, 24], [2000, 12], [2500, 12], [3000, 12], [4000, 12, 'الذهبية'], [5000, 12, 'البلاتينية']].forEach(a => {
    const f = n => n.toLocaleString('en-US');
    O('عمرة التيسير' + (a[2] ? ' ' + a[2] : '') + ' — ' + f(a[0]) + ' شهريًا', 'tayseer', a[0] * a[1], f(a[0]) + ' ج.م شهريًا × ' + a[1] + ' شهر', 'الإجمالي: ' + f(a[0] * a[1]) + ' ج.م\nبدون مقدم وبدون فوائد وبدون مصاريف إدارية\nقرعة كل 3 شهور: ' + (a[1] === 24 ? '8 قرعات' : '4 قرعات') + ' خلال المدة، واسمك بيطلع في واحدة منها\nتختار الوقت والبرنامج وتدفع الفرق بين إجمالي أقساطك وسعر البرنامج\nالسفر بسعر الموسم كاش وقتها\nكل المشتركين يدخلون سحب عمرة مجانية', '', '', city, '', '7 أو 10 أو 15 يوم');
  });
  O('تيسير شعبان ورمضان', 'tayseer', 42000, '3,500 ج.م شهريًا × 12 شهر', 'الإجمالي: 42,000 ج.م', '', '', city, '', '');
  O('تثبيت سعر رمضان', 'tayseer', 45000, '45,000 ج.م (بدون تذاكر الطيران)', 'سعر ثابت لرمضان', '', '', city, '', '');
  O('الحج السياحي', 'hajj', 395000, 'من 395,000 إلى 650,000 ج.م', 'عدة مستويات وبرامج بتفاصيل مختلفة للإقامة والقرب من الحرم. (حدّث التفاصيل من لوحة التحكم)', '', '', city, '', '');
  O('الحج الميسر', 'hajj', 0, 'اسأل عن السعر', 'برنامج حج ميسر بخدمات متكاملة وخيارات متعددة. (حدّث الأسعار من لوحة التحكم)', '', '', city, '', '');
  O('الحج الميسر بالتقسيط', 'hajj', 0, 'تقسيط حتى 120,000 ج.م', 'قسّط جزءًا من سعر أي برنامج حج على 24 شهرًا بواقع 5,000 ج.م شهريًا، وادفع باقي السعر مقدمًا.', '', '', city, '', '');
}

// ---------- عروض أكتوبر (من الفلايرات) ----------
// لو شغّلت setup() قبل كده: شغّل octoberOffers() مرة واحدة بس، وأخفي العروض القديمة من لوحة التحكم
function octoberOffers() {
  const ex = {}; rows('Offers').forEach(o => ex[o.title] = o.id);
  const mk = 'مكة: قصر العليان أو أبراج القصواء أو النخبة 1 — 11 ليلة', md = 'المدينة: نسك المدينة أو وردة الريان أو طيبة هيلز — 3 ليالي';
  const T = (d, img, air, flight, p, mkt) => ({
    title: 'رحلة ' + d + ' أكتوبر — ' + air, category: 'cash', priceFrom: p[0], price: 'تبدأ من ' + p[0].toLocaleString('en-US') + ' ج.م',
    details: ['الطيران: ' + air + ' (' + flight + ')', 'مستوى ريع بخش (اقتصادي بالمواصلات)', mkt || mk, md, 'رباعي: ' + p[0], 'ثلاثي: ' + p[1], 'ثنائي: ' + p[2], 'سينجل: ' + p[3], 'طفل: ' + p[4], 'رضيع: ' + p[5]].join('\n'),
    airline: air, duration: '14 يوم', image: 'images/' + img + '.jpg' });
  [T(9, 'oct-9', 'الطيران السعودي', 'مكة أولًا: برج - جدة - برج', [40600, 43600, 49200, 64200, 31600, 17500], 'مكة: قصر العليان — 11 ليلة'),
   T(17, 'oct-17', 'إير كايرو', 'مدينة مباشر: برج - مدينة - جدة - برج', [41900, 44900, 50900, 65500, 32900, 17500]),
   T(26, 'oct-26', 'الطيران السعودي', 'مكة أولًا: برج - جدة - برج', [40600, 43600, 49200, 64200, 31600, 17500]),
   T(31, 'oct-31', 'إير كايرو', 'مدينة أولًا: برج - جدة - برج', [39900, 42900, 48500, 63500, 30900, 17500])
  ].forEach(o => {
    if (ex[o.title]) upsert('Offers', 'id', Object.assign({ id: ex[o.title], updatedBy: 'seed', updatedAt: now() }, o)); // يحدّث العرض الموجود (التفاصيل والصورة) من غير ما يغيّر الإخفاء
    else upsert('Offers', 'id', Object.assign({ id: Utilities.getUuid(), hotel: '', stars: '', city: 'مكة والمدينة', status: 'active', updatedBy: 'seed', updatedAt: now() }, o));
  });
  bust();
}
