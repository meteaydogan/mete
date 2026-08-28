const http = require('http');
const fs = require('fs');
const path = require('path');
const session = require('./server/session');
const db = require('./server/db');
const tools = require('./server/tools');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const AUDIT_FILE = path.join(ROOT, 'audit-log.jsonl');
const AUDIT_MAX_BYTES = 5 * 1024 * 1024;
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 1000;
const rateBuckets = new Map();
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};
const metrics = {
  startedAt: Date.now(),
  requests: 0,
  rateLimited: 0,
  errors: 0,
  assistantRequests: 0,
  toolCalls: 0
};

function sendJson(res, status, body){
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'});
  res.end(JSON.stringify(body));
}

function securityHeaders(res){
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' blob:; connect-src 'self'");
}

function rateLimitKey(req){
  return req.socket.remoteAddress || 'unknown';
}

function rateLimited(req){
  const now = Date.now();
  const key = rateLimitKey(req);
  const bucket = rateBuckets.get(key) || {startedAt:now, count:0};
  if(now - bucket.startedAt >= RATE_WINDOW_MS){
    bucket.startedAt = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return bucket.count > RATE_LIMIT;
}

function rotateAuditIfNeeded(){
  try{
    const stat = fs.statSync(AUDIT_FILE);
    if(stat.size > AUDIT_MAX_BYTES){
      fs.renameSync(AUDIT_FILE, AUDIT_FILE.replace(/\.jsonl$/, '.1.jsonl'));
    }
  }catch(e){
    // Dosya henüz yoksa rotasyona gerek yok.
  }
}

function audit(event, req, details){
  rotateAuditIfNeeded();
  const record = JSON.stringify({
    zaman:new Date().toISOString(),
    event,
    ip:rateLimitKey(req),
    ...details
  }) + '\n';
  fs.appendFile(AUDIT_FILE, record, () => {});
}

function readBody(req){
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if(body.length > 1024 * 1024){
        reject(new Error('İstek gövdesi çok büyük.'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function readJsonBody(req){
  const raw = await readBody(req);
  return raw ? JSON.parse(raw) : {};
}


async function handleAssistant(req, res){
  if(req.method !== 'POST') return sendJson(res, 405, {hata:'Sadece POST desteklenir.'});
  if(rateLimited(req)){
    metrics.rateLimited++;
    audit('rate_limit', req, {});
    res.setHeader('Retry-After', '60');
    return sendJson(res, 429, {hata:'Çok fazla istek gönderildi. Lütfen kısa süre sonra tekrar deneyin.'});
  }
  if(!process.env.ANTHROPIC_API_KEY){
    return sendJson(res, 503, {hata:'ANTHROPIC_API_KEY sunucu ortamında tanımlı değil.'});
  }

  try{
    const body = await readBody(req);
    const payload = JSON.parse(body);
    if(!payload || !Array.isArray(payload.messages) || typeof payload.system !== 'string'){
      return sendJson(res, 400, {hata:'Geçersiz assistant isteği.'});
    }
    metrics.assistantRequests++;
    audit('assistant_request', req, {mesaj_sayisi:payload.messages.length});
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{
        'content-type':'application/json',
        'x-api-key':process.env.ANTHROPIC_API_KEY,
        'anthropic-version':'2023-06-01'
      },
      body
    });
    const responseBody = await upstream.text();
    res.writeHead(upstream.status, {'Content-Type':'application/json; charset=utf-8'});
    res.end(responseBody);
  }catch(error){
    metrics.errors++;
    audit('assistant_error', req, {hata:error.message});
    sendJson(res, 400, {hata:error.message});
  }
}

// ---- Gerçek oturum + sunucu taraflı tool endpoint'leri ----

async function handleAuthLogin(req, res){
  if(req.method !== 'POST') return sendJson(res, 405, {hata:'Sadece POST desteklenir.'});
  try{
    const {siparis_no, contact} = await readJsonBody(req);
    const sonuc = tools.kimlik_dogrula({siparis_no, email_veya_telefon:contact});
    if(!sonuc.basarili){
      audit('login_failed', req, {siparis_no, supheli_desen: !!sonuc.supheli_desen});
      return sendJson(res, 401, {hata: sonuc.hata});
    }
    res.setHeader('Set-Cookie', session.buildSessionCookie(sonuc.email));
    audit('login_success', req, {email: sonuc.email});
    sendJson(res, 200, {ok:true, email: sonuc.email});
  }catch(error){
    metrics.errors++;
    sendJson(res, 400, {hata:error.message});
  }
}

function handleAuthLogout(req, res){
  res.setHeader('Set-Cookie', session.clearSessionCookie());
  sendJson(res, 200, {ok:true});
}

function handleAuthMe(req, res){
  const email = session.getSessionEmail(req);
  if(!email) return sendJson(res, 401, {hata:'Oturum yok.'});
  sendJson(res, 200, {email});
}

async function handleToolDispatch(req, res, toolName){
  if(req.method !== 'POST') return sendJson(res, 405, {hata:'Sadece POST desteklenir.'});
  if(rateLimited(req)){
    metrics.rateLimited++;
    return sendJson(res, 429, {hata:'Çok fazla istek gönderildi.'});
  }

  let input;
  try{
    ({input} = await readJsonBody(req));
  }catch(error){
    return sendJson(res, 400, {hata:'Geçersiz istek gövdesi.'});
  }

  if(toolName === 'kimlik_dogrula'){
    const sonuc = tools.kimlik_dogrula(input || {});
    if(sonuc.basarili) res.setHeader('Set-Cookie', session.buildSessionCookie(sonuc.email));
    metrics.toolCalls++;
    audit('tool_call', req, {tool:toolName, supheli_desen: !!sonuc.supheli_desen});
    return sendJson(res, 200, sonuc);
  }

  const impl = tools[toolName];
  if(!impl) return sendJson(res, 404, {hata:'Bilinmeyen tool: ' + toolName});

  const email = session.getSessionEmail(req);
  if(!email) return sendJson(res, 401, {hata:'Oturum gerekli. Önce kimlik_dogrula ile giriş yapın.'});

  try{
    const sonuc = await impl(input || {}, email);
    metrics.toolCalls++;
    audit('tool_call', req, {tool:toolName, email, supheli_desen: !!(sonuc && sonuc.supheli_desen)});
    sendJson(res, 200, sonuc);
  }catch(error){
    metrics.errors++;
    audit('tool_error', req, {tool:toolName, hata:error.message});
    sendJson(res, 400, {hata:error.message});
  }
}

function handleCasesList(req, res){
  const email = session.getSessionEmail(req);
  if(!email) return sendJson(res, 401, {hata:'Oturum gerekli.'});
  sendJson(res, 200, db.listCases());
}

async function handleCaseResolve(req, res, caseId){
  if(req.method !== 'POST') return sendJson(res, 405, {hata:'Sadece POST desteklenir.'});
  const email = session.getSessionEmail(req);
  if(!email) return sendJson(res, 401, {hata:'Oturum gerekli.'});
  const updated = await db.resolveCase(caseId);
  sendJson(res, 200, updated);
}

function handleMetrics(req, res){
  sendJson(res, 200, {...metrics, uptimeSaniye: Math.round((Date.now() - metrics.startedAt) / 1000)});
}

function serveStatic(req, res){
  const requested = decodeURIComponent(req.url.split('?')[0]);
  const relative = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, relative);
  if(!filePath.startsWith(ROOT + path.sep)) return sendJson(res, 403, {hata:'Erişim reddedildi.'});

  fs.readFile(filePath, (error, data) => {
    if(error) return sendJson(res, 404, {hata:'Dosya bulunamadı.'});
    res.writeHead(200, {'Content-Type':CONTENT_TYPES[path.extname(filePath)] || 'application/octet-stream'});
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  securityHeaders(res);
  metrics.requests++;
  if(req.method === 'OPTIONS'){
    res.writeHead(204);
    return res.end();
  }

  const pathname = req.url.split('?')[0];
  const toolMatch = pathname.match(/^\/api\/tools\/([a-z_]+)$/);
  const caseResolveMatch = pathname.match(/^\/api\/cases\/([A-Za-z0-9-]+)\/resolve$/);

  if(pathname === '/api/health') return sendJson(res, 200, {ok:true, servis:'depom-agent'});
  if(pathname === '/api/metrics') return handleMetrics(req, res);
  if(pathname === '/api/assistant') return handleAssistant(req, res);
  if(pathname === '/api/auth/login') return handleAuthLogin(req, res);
  if(pathname === '/api/auth/logout') return handleAuthLogout(req, res);
  if(pathname === '/api/auth/me') return handleAuthMe(req, res);
  if(pathname === '/api/cases' && req.method === 'GET') return handleCasesList(req, res);
  if(caseResolveMatch) return handleCaseResolve(req, res, caseResolveMatch[1]);
  if(toolMatch) return handleToolDispatch(req, res, toolMatch[1]);

  serveStatic(req, res);
});

server.requestTimeout = 30 * 1000;

server.listen(PORT, () => {
  console.log(`DEPOM http://localhost:${PORT}`);
});

function safeAuditSync(event, details){
  try{
    rotateAuditIfNeeded();
    fs.appendFileSync(AUDIT_FILE, JSON.stringify({zaman:new Date().toISOString(), event, ...details}) + '\n');
  }catch(e){
    // Audit yazımı başarısız olsa bile süreci durdurmayalım.
  }
}

process.on('uncaughtException', (err) => {
  console.error('[hata] Yakalanmamış istisna:', err);
  safeAuditSync('uncaught_exception', {hata: err.message});
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[hata] Yakalanmamış promise reddi:', reason);
  safeAuditSync('unhandled_rejection', {hata: String(reason && reason.message || reason)});
});

function shutdown(signal){
  console.log(`${signal} alındı, sunucu kapatılıyor...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
