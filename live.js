// يحوّل أي لينك (Cloudflare / YouTube / Facebook) لرابط تضمين آمن. بيرفض أي موقع تاني.
function liveSrc(u) {
  u = String(u || '').trim(); const m = u.match(/src=["']([^"']+)["']/i); if (m) u = m[1].replace(/&amp;/g, '&'); // يقبل كود iframe كامل
  let x; try { x = new URL(u); } catch (e) { return null; }
  if (x.protocol !== 'https:') return null;
  const h = x.hostname.replace(/^(www|m)\./, '');
  if (/(^|\.)cloudflarestream\.com$/.test(h)) {
    x.pathname = x.pathname.replace(/\/(watch|iframe)?\/?$/, '') + '/iframe'; x.searchParams.set('autoplay', 'true'); x.searchParams.set('muted', 'true');
    return { k: 'cf', src: x.href, open: u };
  }
  if (h === 'youtu.be' || h === 'youtube.com' || h === 'youtube-nocookie.com') {
    const p = x.pathname; let id = h === 'youtu.be' ? p.slice(1) : x.searchParams.get('v') || (p.match(/^\/(?:live|embed|shorts)\/([\w-]{6,})/) || [])[1];
    const ch = (p.match(/^\/channel\/(UC[\w-]+)/) || [])[1] || (/live_stream/.test(p) ? x.searchParams.get('channel') : '');
    const q = '?autoplay=1&mute=1&rel=0&playsinline=1';
    if (id && /^[\w-]{6,20}$/.test(id)) return { k: 'yt', src: 'https://www.youtube-nocookie.com/embed/' + id + q, open: u };
    if (ch && /^UC[\w-]+$/.test(ch)) return { k: 'yt', src: 'https://www.youtube-nocookie.com/embed/live_stream?channel=' + ch + '&autoplay=1&mute=1', open: u };
    return null;
  }
  if (h === 'facebook.com' || h === 'fb.watch') return { k: 'fb', src: 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(u) + '&show_text=false&autoplay=true&mute=1', open: u };
  return null;
}
