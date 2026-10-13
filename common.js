// ===== كود مشترك بين كل الصفحات =====
window.__API = window.__API || 'https://script.google.com/macros/s/AKfycbxRr2PYw2kkY9TiAGVT0MfswIBsxYPtrVuRBvXjzrOTVdr7ueGHOSLjHkUEZkshPmEOFg/exec';
const API = window.__API;
const WA = '201096177756';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let token = sessionStorage.getItem('t'), me = null;
try { me = JSON.parse(sessionStorage.getItem('me') || 'null'); } catch (e) {}
const waEl = $('#wa'); if (waEl) waEl.href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent('السلام عليكم، أرغب في الاستفسار عن برامج همسة للسياحة');

async function api(action, data = {}) {
  const r = await (await fetch(API, { method: 'POST', body: JSON.stringify({ action, token, ...data }) })).json();
  if (r.error) { if (/سجّل الدخول/.test(r.error)) logout(); throw new Error(r.error); }
  return r;
}
function ui() {
  const l = $('#loginBtn'), a = $('#adminBtn');
  if (l) l.textContent = me ? 'خروج (' + me.name + ')' : 'تسجيل الدخول';
  if (a) { a.hidden = !me || me.role === 'staff'; a.textContent = me && me.role === 'visitor' ? 'حسابي' : 'لوحة التحكم'; }
  if (!me && typeof showAdmin === 'function') showAdmin(false);
}
function logout() { token = me = null; sessionStorage.clear(); if (window.onLogout) window.onLogout(); ui(); }
if ($('#loginBtn')) $('#loginBtn').onclick = () => me ? logout() : (location.href = 'login.html');
// الزر ده بيفتح لوحة التحكم/حسابي (في صفحة العروض بيتغيّر بكود الصفحة نفسها)
if ($('#adminBtn')) $('#adminBtn').onclick = () => { location.href = 'offers.html#admin'; };

// هيدر ثابت + حركة ظهور خفيفة للعناصر عند وصولها للشاشة
(() => {
  if (matchMedia('(prefers-reduced-motion:reduce)').matches || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(es => {
    es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || b.boundingClientRect.right - a.boundingClientRect.right).forEach((e, i) => {
      const el = e.target, d = Math.min(i, 6) * 90; io.unobserve(el); el.style.transitionDelay = d + 'ms'; el.classList.add('in');
      setTimeout(() => { el.classList.add('done'); el.style.transitionDelay = ''; }, d + 950);
    });
  }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
  const sel = '.fc,.ty,.gi,.hc,.hgh,.bn,.pst li,.hmc,#contact form,#pay h2,#contact h2';
  function scan() { document.querySelectorAll(sel).forEach(el => { if (el.dataset.rv) return; el.dataset.rv = 1; el.classList.add('rv'); io.observe(el); }); }
  let _sq; scan(); new MutationObserver(() => { cancelAnimationFrame(_sq); _sq = requestAnimationFrame(scan); }).observe(document.body, { childList: true, subtree: true });
})();
