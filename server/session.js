// İmzalı, HttpOnly çerez tabanlı basit oturum katmanı (harici bağımlılık yok).
const crypto = require('crypto');

const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 saat
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

if(!process.env.SESSION_SECRET){
  console.warn('[uyarı] SESSION_SECRET tanımlı değil; rastgele bir anahtar üretildi. Sunucu yeniden başladığında mevcut oturumlar geçersiz olur.');
}

function sign(email, maxAgeMs = SESSION_MAX_AGE_MS){
  const payload = Buffer.from(JSON.stringify({email, exp: Date.now() + maxAgeMs})).toString('base64url');
  const mac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${mac}`;
}

function verify(token){
  if(!token || !token.includes('.')) return null;
  const [payload, mac] = token.split('.');
  try{
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if(a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if(!data.exp || data.exp < Date.now()) return null;
    return data.email;
  }catch(e){
    return null;
  }
}

function parseCookies(req){
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if(idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if(key) out[key] = decodeURIComponent(value);
  });
  return out;
}

function buildSessionCookie(email){
  const token = sign(email);
  const maxAgeSec = Math.floor(SESSION_MAX_AGE_MS / 1000);
  return `depom_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSec}`;
}

function clearSessionCookie(){
  return 'depom_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0';
}

function getSessionEmail(req){
  const cookies = parseCookies(req);
  return verify(cookies.depom_session);
}

module.exports = { sign, verify, parseCookies, buildSessionCookie, clearSessionCookie, getSessionEmail };
