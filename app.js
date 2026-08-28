/* =========================================================
   SOHBET DURUMU VE ARAYÜZ
   ========================================================= */
let messages = [];
let currentEmail = document.getElementById('customerSelect').value;
let pendingAction = null;
let logEntries = [];
let lastOrderNo = null;
let verifiedOrders = new Set();
let repCases = [];

const chatEl = document.getElementById('chat');
const logpanel = document.getElementById('logpanel');
const logbar = document.getElementById('logbar');
const logArrow = document.getElementById('logArrow');
const customerSummary = document.getElementById('customerSummary');
const modeSelect = document.getElementById('modeSelect');

logbar.addEventListener('click', toggleLog);
logbar.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' ') toggleLog(); });
function toggleLog(){
  const open = logpanel.classList.toggle('open');
  logbar.setAttribute('aria-expanded', open);
  logArrow.textContent = open ? '▴' : '▾';
}

function logLine(label, obj, tagClass){
  logEntries.push({zaman:new Date().toISOString(), label, detay:obj, tag:tagClass || ''});
  const div = document.createElement('div');
  div.className = 'logline' + (tagClass ? ' ' + tagClass : '');
  div.innerHTML = '<b>' + label + '</b>\n' + escapeHtml(JSON.stringify(obj));
  logpanel.appendChild(div);
  logpanel.scrollTop = logpanel.scrollHeight;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function addBubble(role, text){
  const row = document.createElement('div');
  row.className = 'row ' + (role === 'user' ? 'user' : 'agent');
  const who = document.createElement('div');
  who.className = 'who';
  who.textContent = role === 'user' ? 'SİZ' : 'DEPOM AGENT';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  row.appendChild(who);
  row.appendChild(bubble);
  chatEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function addEmptyState(){
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.textContent = t('emptyState');
  chatEl.appendChild(div);
}

function karsilamaMesaji(email){
  const ad = CUSTOMERS[email]?.ad || '';
  return t('greetingTemplate').replace('{ad}', ad);
}

function applyStaticI18n(){
  document.documentElement.lang = i18nGetLang();
  document.querySelector('header .tagline').textContent = t('tagline');
  document.querySelector('header .stamp').textContent = t('stamp');
  document.querySelector('.idbar span').textContent = t('customerLabel');
  document.getElementById('verifyOrderInput').placeholder = t('verifyOrderPlaceholder');
  document.getElementById('verifyContactInput').placeholder = t('verifyContactPlaceholder');
  document.getElementById('verifyBtn').textContent = t('verifyBtn');
  const authStatusEl = document.getElementById('authStatus');
  if(!authStatusEl.classList.contains('ok') && !authStatusEl.classList.contains('fail')){
    authStatusEl.textContent = t('authStatusDefault');
  }
  if(modeSelect.options[0]) modeSelect.options[0].textContent = t('modeDemo');
  if(modeSelect.options[1]) modeSelect.options[1].textContent = t('modeAi');
  document.getElementById('openOrdersBtn').textContent = t('openOrdersBtn');
  if(document.getElementById('scenarioSelect').options[0]) document.getElementById('scenarioSelect').options[0].textContent = t('scenarioDefault');
  document.getElementById('runScenarioBtn').textContent = t('runScenarioBtn');
  document.getElementById('repPanelBtn').textContent = t('repPanelBtn');
  document.getElementById('exportLogBtn').textContent = t('exportLogBtn');
  document.getElementById('clearChatBtn').textContent = t('clearChatBtn');
  document.getElementById('resetMemoryBtn').textContent = t('resetMemoryBtn');
  document.getElementById('themeBtn').textContent = document.body.classList.contains('dark') ? t('themeBtnLight') : t('themeBtnDark');
  document.getElementById('langBtn').textContent = t('langBtn');
  document.querySelector('.rep-panel h3').textContent = t('repPanelTitle');
  document.querySelector('#logbar span').textContent = t('logbarLabel');
  chatEl.setAttribute('aria-label', t('chatAriaLabel'));
  document.getElementById('msgInput').placeholder = t('msgPlaceholder');
  document.getElementById('sendBtn').textContent = t('sendBtn');
}

function getCustomerOrders(email){
  return Object.entries(ORDERS)
    .filter(([, order]) => order.email === email)
    .map(([siparisNo, order]) => ({siparisNo, ...order}));
}

async function renderCustomerSummary(){
  const gecmis = await getMusteriGecmisi(currentEmail);
  const orders = getCustomerOrders(currentEmail);
  const activeOrders = orders.filter(o => o.durum !== 'Teslim Edildi').length;
  const deliveredOrders = orders.filter(o => o.durum === 'Teslim Edildi').length;
  const riskScore = riskSkoruHesapla(currentEmail, false);
  const risk = riskScore >= 70 ? 'İnceleme gerekli' : (riskScore >= 45 ? 'Yakından izleniyor' : 'Normal');
  const verifiedCount = orders.filter(o => siparisDogrulandiMi(o.siparisNo, currentEmail)).length;

  customerSummary.innerHTML = `
    <div class="metric"><span class="label">Müşteri</span><span class="value">${escapeHtml(CUSTOMERS[currentEmail]?.ad || currentEmail)}</span></div>
    <div class="metric"><span class="label">Aktif sipariş</span><span class="value">${activeOrders}</span></div>
    <div class="metric"><span class="label">Risk skoru</span><span class="value">${riskScore}/100</span></div>
    <div class="mini-note">Risk: ${escapeHtml(risk)} · Doğrulanan sipariş: ${verifiedCount} · Teslim edilen: ${deliveredOrders} · Kayıtlı iade: ${gecmis.iadeSayisi} · Tercih: ${escapeHtml(CUSTOMERS[currentEmail]?.tercih || '-')} · Mod: ${modeSelect.value === 'demo' ? 'Demo motoru' : 'AI API'}</div>
  `;
}

function siparisNumaralariBul(text){
  const matches = text.toUpperCase().match(/SP-\d{4}/g) || [];
  return [...new Set(matches)];
}

function sebepBul(text, varsayilan){
  const sebepMatch = text.match(/sebep\s*:?\s*(.+)$/i);
  if(sebepMatch) return sebepMatch[1].trim();
  const virgullu = text.split(',').slice(1).join(',').trim();
  return virgullu || varsayilan;
}

function timelineHtml(adimlar){
  const sonTamam = adimlar.reduce((idx, a, i) => a.tamam ? i : idx, -1);
  return '<div class="timeline">' + adimlar.map((a, i) => {
    const cls = a.tamam ? 'done' : (i === sonTamam + 1 ? 'current' : '');
    return `<div class="timeline-step ${cls}"><span class="timeline-dot"></span><span>${escapeHtml(a.adim)}</span><span class="timeline-date">${escapeHtml(a.tarih)}</span></div>`;
  }).join('') + '</div>';
}

function showToast(text){
  const toast = document.getElementById('toast');
  toast.textContent = text;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'), 2200);
}

function badgeClassForStatus(durum){
  if(durum === 'Teslim Edildi' || durum === 'onaylandi') return 'green';
  if(durum === 'incelemede') return 'red';
  return 'orange';
}

function addStubCard(title, kvPairs, badgeText, badgeClass){
  const card = document.createElement('div');
  card.className = 'stubcard';
  let html = '<div class="stubtitle">' + escapeHtml(title) + '</div>';
  kvPairs.forEach(([k,v])=>{
    html += `<div class="kv"><span class="k">${escapeHtml(k)}</span><span>${escapeHtml(String(v))}</span></div>`;
  });
  card.innerHTML = html;
  if(badgeText){
    const b = document.createElement('div');
    b.className = 'badge ' + (badgeClass||'navy');
    b.textContent = badgeText;
    card.appendChild(b);
  }
  chatEl.appendChild(card);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function addTimelineCard(title, result){
  const card = document.createElement('div');
  card.className = 'stubcard';
  card.innerHTML = `
    <div class="stubtitle">${escapeHtml(title)}</div>
    <div class="kv"><span class="k">kargo firması</span><span>${escapeHtml(result.kargo_firmasi || 'DEPOM Express')}</span></div>
    <div class="kv"><span class="k">takip no</span><span>${escapeHtml(result.takip_no || '-')}</span></div>
    <div class="kv"><span class="k">tahmini teslimat</span><span>${escapeHtml(result.tahmini_teslimat || '-')}</span></div>
    ${timelineHtml(result.adimlar || [])}
  `;
  const b = document.createElement('div');
  b.className = 'badge ' + badgeClassForStatus(result.durum);
  b.textContent = result.durum;
  card.appendChild(b);
  chatEl.appendChild(card);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function addEscalationBanner(text){
  const d = document.createElement('div');
  d.className = 'escalation-banner';
  d.textContent = '⚠ ' + text;
  chatEl.appendChild(d);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function renderToolResultCard(name, input, result){
  if(result.hata){
    addStubCard('⚠ ' + name, [['sipariş no', input?.siparis_no || '-'], ['hata', result.hata]], 'HATA', 'red');
    return;
  }
  if(name === 'kimlik_dogrula'){
    addStubCard('KİMLİK DOĞRULAMA · ' + input.siparis_no,
      [['durum', 'Doğrulandı'], ['iletişim', 'Gizlendi']],
      'GÜVENLİ',
      'green');
  } else if(name === 'siparis_sorgula'){
    addStubCard('SİPARİŞ · ' + result.siparis_no,
      [['ürün', result.urun], ['tutar', result.tutar], ['durum', result.durum], ['kargo firması', result.kargo_firmasi || 'DEPOM Express'], ['takip no', result.takip_no || '-'], ['tahmini teslimat', result.tahmini_teslimat]],
      result.durum, badgeClassForStatus(result.durum));
  } else if(name === 'kargo_takip'){
    addTimelineCard('KARGO TAKİP · ' + result.siparis_no, result);
  } else if(name === 'iade_baslat'){
    addStubCard('İADE TALEBİ · ' + result.siparis_no,
      [['sebep', result.sebep], ['teslimattan bu yana', result.teslimattan_bu_yana_gun + ' gün'],
       ['toplam iade sayısı', result.musterinin_toplam_iade_sayisi],
       ['kargo firması', result.kargo_firmasi || '—'],
       ['fotoğraf', result.fotograf_yuklendi ? 'Yüklendi' : 'Yok'],
       ['iade etiketi', result.iade_etiketi || '—'],
       ['tahmini ücret iadesi', result.tahmini_ucret_iadesi || '—'],
       ['iade kodu', result.iade_kodu || '—']],
      result.durum === 'incelemede' ? 'İNCELEMEDE' : 'ONAYLANDI',
      badgeClassForStatus(result.durum));
  } else if(name === 'urun_degisim'){
    addStubCard('ÜRÜN DEĞİŞİMİ · ' + result.siparis_no,
      [['ürün', result.urun], ['sebep', result.sebep],
       ['teslimattan bu yana', result.teslimattan_bu_yana_gun + ' gün'],
       ['kargo firması', result.kargo_firmasi || '—'],
       ['fotoğraf', result.fotograf_yuklendi ? 'Yüklendi' : 'Yok'],
       ['yeni ürün çıkışı', result.yeni_urun_cikis_tahmini || '—'],
       ['değişim kodu', result.degisim_kodu || '—']],
      'ONAYLANDI',
      'green');
  } else if(name === 'eskalasyon'){
    addEscalationBanner(result.bilgi);
  }
}

async function toolCalistirVeGoster(name, input, tagClass){
  const impl = TOOL_IMPL[name];
  let result;

  try{
    result = impl ? await impl(input) : {hata:'Bilinmeyen tool: ' + name};
  }catch(e){
    result = {hata:'Tool çalıştırma hatası: ' + e.message};
  }

  logLine(name + '(' + JSON.stringify(input) + ')', result, result.supheli_desen ? 'tag-supheli' : tagClass);

  if(name !== 'durum_etiketle'){
    renderToolResultCard(name, input, result);
  }

  if(result.supheli_desen){
    const eskSonuc = await eskalasyon({
      sebep:'Şüpheli işlem deseni',
      ozet:`Tool sonucu şüpheli desen döndürdü. Tool: ${name}, Sipariş: ${input?.siparis_no || '-'}`
    });
    logLine('eskalasyon(' + JSON.stringify({sebep:'Şüpheli işlem deseni', ozet: input?.siparis_no || '-'}) + ')', eskSonuc, 'tag-supheli');
    renderToolResultCard('eskalasyon', {}, eskSonuc);
  }

  await renderCustomerSummary();
  return result;
}

function iadeVeyaDegisimUygunlukKontrol(siparis_no, email, islemAdi){
  const o = ORDERS[siparis_no];
  if(!o) return {uygun:false, hata:'Sipariş bulunamadı: ' + siparis_no};
  if(o.email.toLowerCase() !== email.toLowerCase()){
    return {uygun:false, supheli:true, hata:'Doğrulama başarısız: bu sipariş seçili müşteriyle eşleşmiyor.'};
  }
  if(o.durum !== 'Teslim Edildi'){
    return {uygun:false, hata:`Bu sipariş henüz teslim edilmedi; ${islemAdi} başlatılamaz. Güncel durum: ${o.durum}`};
  }
  const gecenGun = gunFarki(o.teslimTarihi);
  if(gecenGun > IADE_SURESI_GUN){
    return {uygun:false, hata:`${islemAdi} süresi dolmuş: teslimattan bu yana ${gecenGun} gün geçmiş. Politika sınırı ${IADE_SURESI_GUN} gün.`};
  }
  return {uygun:true, gecenGun, order:o};
}

async function siparisleriGoster(){
  const orders = getCustomerOrders(currentEmail);
  if(!orders.length){
    addBubble('agent', 'Bu müşteri için kayıtlı sipariş bulunamadı.');
    return;
  }

  orders.forEach(o => addStubCard('SİPARİŞ ÖZETİ · ' + o.siparisNo,
    [['ürün', o.urun], ['durum', o.durum], ['tutar', o.tutar], ['tahmini teslimat', o.teslimTarihiTahmini]],
    o.durum,
    badgeClassForStatus(o.durum)
  ));
  addBubble('agent', 'Müşteriye ait siparişleri listeledim. İsterseniz belirli bir sipariş için kargo, iade veya değişim işlemi yapabilirim.');
}

function dogrulaSiparis(siparis_no, contact){
  const order = ORDERS[siparis_no];
  const customer = CUSTOMERS[currentEmail];
  const authStatus = document.getElementById('authStatus');
  const normalizedContact = temizleContact(contact);

  if(!order){
    authStatus.className = 'auth-status fail';
    authStatus.textContent = 'Doğrulama başarısız: sipariş bulunamadı.';
    return {basarili:false, hata:'Sipariş bulunamadı.'};
  }

  const emailMatches = temizleContact(order.email) === normalizedContact;
  const phoneMatches = temizleContact(customer?.telefon) === normalizedContact;
  const selectedCustomerOwnsOrder = order.email === currentEmail;

  if(selectedCustomerOwnsOrder && (emailMatches || phoneMatches)){
    verifiedOrders.add(dogrulamaAnahtari(currentEmail, siparis_no));
    lastOrderNo = siparis_no;
    authStatus.className = 'auth-status ok';
    authStatus.textContent = `Doğrulama başarılı: ${siparis_no} artık bu oturumda güvenli işlem için açık.`;
    logLine('kimlik_dogrula(' + JSON.stringify({siparis_no, contact:'***'}) + ')', {basarili:true}, '');
    renderCustomerSummary();
    return {basarili:true};
  }

  authStatus.className = 'auth-status fail';
  authStatus.textContent = 'Doğrulama başarısız: sipariş numarası ile e-posta/telefon eşleşmiyor.';
  logLine('kimlik_dogrula(' + JSON.stringify({siparis_no, contact:'***'}) + ')', {basarili:false, supheli_desen:true}, 'tag-supheli');
  return {basarili:false, hata:'Doğrulama başarısız.', supheli_desen:true};
}

function contactMesajdanBul(text){
  const email = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if(email) return email[0];
  const phone = text.match(/0?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/);
  return phone ? phone[0] : null;
}

async function dogrulamaYoksaSor(siparisNo, text){
  if(siparisDogrulandiMi(siparisNo, currentEmail)) return true;

  const contact = contactMesajdanBul(text);
  if(contact){
    const sonuc = dogrulaSiparis(siparisNo, contact);
    if(sonuc.basarili) return true;
    await toolCalistirVeGoster('eskalasyon', {sebep:'Tutarsız kimlik doğrulama bilgisi', ozet:text}, 'tag-supheli');
    addBubble('agent', 'Talebiniz inceleme sürecine alındı. Sipariş bilgisi ile iletişim bilgisi eşleşmedi.');
    return false;
  }

  document.getElementById('verifyOrderInput').value = siparisNo;
  document.getElementById('verifyContactInput').value = currentEmail;
  addBubble('agent', `${siparisNo} için işlem yapmadan önce kimliğinizi doğrulamam gerekiyor. Üstteki doğrulama alanından e-posta veya telefon bilgisini onaylayın.`);
  return false;
}

function renderActionForm(action){
  const form = document.createElement('div');
  form.className = 'inline-form';
  const title = action.type === 'iade' ? 'İade Detayları' : 'Ürün Değişimi Detayları';
  form.innerHTML = `
    <h3>${title} · ${escapeHtml(action.siparis_no)}</h3>
    <div class="form-grid">
      <label>Sebep
        <select data-field="reason">
          <option>Beğenmedim</option>
          <option>Hasarlı geldi</option>
          <option>Yanlış ürün geldi</option>
          <option>Eksik parça var</option>
          <option>Diğer</option>
        </select>
      </label>
      <label>Kargo firması
        <select data-field="carrier">
          <option>DEPOM Express</option>
          <option>Yurtiçi Kargo</option>
          <option>Aras Kargo</option>
          <option>MNG Kargo</option>
        </select>
      </label>
      <label>Fotoğraf simülasyonu
        <input data-field="photo" type="file" accept="image/*">
        <span class="file-status" data-field="file-status">Dosya seçilmedi</span>
        <img data-field="preview" alt="Seçilen fotoğraf önizlemesi" hidden>
      </label>
      <label>Ek not
        <input data-field="note" type="text" placeholder="İsteğe bağlı açıklama">
      </label>
    </div>
    <div class="actions">
      <button class="confirm" type="button">Onayla ve başlat</button>
      <button class="cancel" type="button">Vazgeç</button>
    </div>
  `;
  form.querySelector('.confirm').addEventListener('click', ()=>{
    const reason = form.querySelector('[data-field="reason"]').value;
    const carrier = form.querySelector('[data-field="carrier"]').value;
    const note = form.querySelector('[data-field="note"]').value.trim();
    const photo = form.querySelector('[data-field="photo"]').files.length > 0;
    pendingAction = {...action, sebep: note ? `${reason} - ${note}` : reason, kargo_firmasi: carrier, fotograf_yuklendi: photo};
    form.remove();
    handleSend(`${action.siparis_no} ${action.type === 'iade' ? 'iade' : 'değişim'} işlemini onaylıyorum, sebep: ${pendingAction.sebep}`);
  });
  form.querySelector('.cancel').addEventListener('click', ()=>{
    pendingAction = null;
    form.remove();
    addBubble('agent', 'İşlem iptal edildi. Başka bir konuda yardımcı olabilirim.');
  });
  form.querySelector('[data-field="photo"]').addEventListener('change', e=>{
    const file = e.target.files[0];
    const preview = form.querySelector('[data-field="preview"]');
    form.querySelector('[data-field="file-status"]').textContent = file ? file.name : 'Dosya seçilmedi';
    if(file){
      preview.src = URL.createObjectURL(file);
      preview.hidden = false;
    }else{
      preview.removeAttribute('src');
      preview.hidden = true;
    }
  });
  chatEl.appendChild(form);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function renderRepPanel(){
  const caseList = document.getElementById('caseList');
  if(!caseList) return;
  if(!repCases.length){
    caseList.innerHTML = '<div class="mini-note">Bekleyen temsilci vakası yok.</div>';
    return;
  }
  caseList.innerHTML = repCases.map(c => `
    <div class="case-card" data-case-id="${escapeHtml(c.id)}">
      <b>${escapeHtml(c.id)}</b> · ${escapeHtml(c.oncelik)} · ${escapeHtml(c.durum)}<br>
      Müşteri: ${escapeHtml(c.musteri)}<br>
      Sebep: ${escapeHtml(c.sebep)}<br>
      Özet: ${escapeHtml(c.ozet)}<br>
      <button type="button" data-resolve="${escapeHtml(c.id)}">Çözüldü işaretle</button>
    </div>
  `).join('');
  caseList.querySelectorAll('[data-resolve]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      repCases = repCases.map(c => c.id === btn.dataset.resolve ? {...c, durum:'çözüldü'} : c);
      storageSet('depom-rep-cases', JSON.stringify(repCases));
      renderRepPanel();
      showToast('Vaka çözüldü olarak işaretlendi.');
    });
  });
}

async function loadRepCases(){
  try{
    const saved = await storageGet('depom-rep-cases');
    const parsed = JSON.parse(saved.value);
    if(Array.isArray(parsed)) repCases = parsed;
  }catch(e){
    repCases = [];
  }
  renderRepPanel();
}

async function processDemoMessage(text, analiz, supheliMetin){
  const bulunanSiparisNolar = siparisNumaralariBul(text);
  if(bulunanSiparisNolar.length > 1 && !pendingAction){
    addBubble('agent', `Mesajınızda birden fazla sipariş numarası gördüm (${bulunanSiparisNolar.join(', ')}). Lütfen tek seferde bir sipariş numarasıyla devam edin.`);
    return;
  }
  const bulunanSiparisNo = bulunanSiparisNolar[0] || null;
  const siparisNo = bulunanSiparisNo || lastOrderNo;
  const lower = text.toLowerCase();
  const onayVar = /(onaylıyorum|onayliyorum|evet|tamam|başlat|baslat|onayla)/i.test(lower);
  const redVar = /(hayır|hayir|vazgeçtim|vazgectim|iptal)/i.test(lower);

  if(pendingAction && redVar){
    const iptal = pendingAction;
    pendingAction = null;
    addBubble('agent', `${iptal.siparis_no} için bekleyen ${iptal.type === 'iade' ? 'iade' : 'değişim'} işlemini başlatmadım.`);
    return;
  }

  if(pendingAction && onayVar){
    const action = pendingAction;
    pendingAction = null;
    const toolName = action.type === 'iade' ? 'iade_baslat' : 'urun_degisim';
    const result = await toolCalistirVeGoster(toolName, {
      siparis_no: action.siparis_no,
      email: currentEmail,
      sebep: sebepBul(text, action.sebep),
      kargo_firmasi: action.kargo_firmasi,
      fotograf_yuklendi: action.fotograf_yuklendi
    });

    if(result.supheli_desen || result.durum === 'incelemede'){
      addBubble('agent', 'Talebiniz inceleme sürecine alındı. Bir müşteri temsilcisi süreci kontrol edecek.');
    }else if(result.hata){
      addBubble('agent', result.hata);
    }else{
      addBubble('agent', `${action.siparis_no} için ${action.type === 'iade' ? 'iade' : 'değişim'} talebiniz oluşturuldu. Kod: ${result.iade_kodu || result.degisim_kodu}`);
    }
    return;
  }

  if(/siparişler|siparisler|siparişlerim|siparislerim|müşterinin siparişleri/i.test(lower)){
    await siparisleriGoster();
    return;
  }

  if(!siparisNo){
    addBubble('agent', 'İşlem yapabilmem için lütfen sipariş numaranızı yazın. Örnek: SP-1042');
    return;
  }

  lastOrderNo = siparisNo;

  const dogrulandi = await dogrulamaYoksaSor(siparisNo, text);
  if(!dogrulandi) return;

  if(/iade/i.test(lower)){
    const uygunluk = iadeVeyaDegisimUygunlukKontrol(siparisNo, currentEmail, 'İade');
    if(!uygunluk.uygun){
      const result = {hata: uygunluk.hata, supheli_desen: !!uygunluk.supheli};
      logLine('iade_uygunluk_kontrol(' + JSON.stringify({siparis_no:siparisNo, email:currentEmail}) + ')', result, result.supheli_desen ? 'tag-supheli' : '');
      renderToolResultCard('iade_uygunluk_kontrol', {siparis_no:siparisNo}, result);
      if(result.supheli_desen) await toolCalistirVeGoster('eskalasyon', {sebep:'Tutarsız müşteri/sipariş bilgisi', ozet:text}, 'tag-supheli');
      addBubble('agent', uygunluk.hata);
      return;
    }

    await toolCalistirVeGoster('siparis_sorgula', {siparis_no:siparisNo, email:currentEmail});
    pendingAction = {type:'iade', siparis_no:siparisNo, sebep:sebepBul(text, 'Müşteri iade talebi'), kargo_firmasi:'DEPOM Express', fotograf_yuklendi:false};
    addBubble('agent', `${siparisNo} iade süresi içinde görünüyor. İade işlemini onaylıyor musunuz?`);
    renderActionForm(pendingAction);
    return;
  }

  if(/değişim|degisim|değiştir|degistir/i.test(lower)){
    const uygunluk = iadeVeyaDegisimUygunlukKontrol(siparisNo, currentEmail, 'Değişim');
    if(!uygunluk.uygun){
      const result = {hata: uygunluk.hata, supheli_desen: !!uygunluk.supheli};
      logLine('degisim_uygunluk_kontrol(' + JSON.stringify({siparis_no:siparisNo, email:currentEmail}) + ')', result, result.supheli_desen ? 'tag-supheli' : '');
      renderToolResultCard('degisim_uygunluk_kontrol', {siparis_no:siparisNo}, result);
      if(result.supheli_desen) await toolCalistirVeGoster('eskalasyon', {sebep:'Tutarsız müşteri/sipariş bilgisi', ozet:text}, 'tag-supheli');
      addBubble('agent', uygunluk.hata);
      return;
    }

    await toolCalistirVeGoster('siparis_sorgula', {siparis_no:siparisNo, email:currentEmail});
    pendingAction = {type:'degisim', siparis_no:siparisNo, sebep:sebepBul(text, 'Müşteri değişim talebi'), kargo_firmasi:'DEPOM Express', fotograf_yuklendi:false};
    addBubble('agent', `${siparisNo} değişim süresi içinde görünüyor. Ürün değişimi işlemini onaylıyor musunuz?`);
    renderActionForm(pendingAction);
    return;
  }

  if(/kargo|nerede|ulaşır|ulasir|takip|teslim/i.test(lower)){
    const result = await toolCalistirVeGoster('kargo_takip', {siparis_no:siparisNo, email:currentEmail});
    if(result.hata){
      addBubble('agent', result.hata);
    }else{
      addBubble('agent', `${siparisNo} güncel durum: ${result.durum}. Tahmini teslimat: ${result.tahmini_teslimat}.`);
    }
    return;
  }

  const result = await toolCalistirVeGoster('siparis_sorgula', {siparis_no:siparisNo, email:currentEmail});
  if(result.hata){
    addBubble('agent', result.hata);
  }else{
    addBubble('agent', `${siparisNo} siparişinizin durumu: ${result.durum}. Ürün: ${result.urun}. Tahmini teslimat: ${result.tahmini_teslimat}.`);
  }
}

/* =========================================================
   API ÇAĞRISI + TOOL DÖNGÜSÜ
   ========================================================= */
async function callClaude(msgs, system){
  const res = await fetch('/api/assistant', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      model:'claude-sonnet-4-6',
      max_tokens:1000,
      system,
      tools: TOOL_DEFS,
      messages: msgs
    })
  });
  if(!res.ok){
    const t = await res.text();
    throw new Error('API hatası: ' + res.status + ' ' + t);
  }
  return res.json();
}

async function handleSend(text){
  if(!text.trim()) return;

  setInputDisabled(true);
  addBubble('user', text);
  messages.push({role:'user', content: text});

  const analiz = duyguAnalizEt(text);
  const supheliMetin = supheliMetinAnalizEt(text);
  const logNotu = durumLogNotuOlustur(text, analiz.duygu, supheliMetin);

  const durumSonucu = await durum_etiketle({
    duygu: analiz.duygu,
    oncelik: analiz.oncelik,
    supheli_durum: supheliMetin,
    not: logNotu
  });

  logLine(
    'durum_etiketle(' + JSON.stringify({
      duygu: analiz.duygu,
      oncelik: analiz.oncelik,
      supheli_durum: supheliMetin,
      not: logNotu
    }) + ')',
    durumSonucu,
    supheliMetin ? 'tag-supheli' : 'tag-' + analiz.duygu
  );

  if(analiz.duygu === 'cok_sinirli' || supheliMetin){
    const eskSebep = supheliMetin
      ? 'Şüpheli tekrar eden hasarlı/bozuk ürün bildirimi'
      : 'Çok sinirli veya tehditkar kullanıcı mesajı';
    const eskalasyonSonucu = await eskalasyon({ sebep: eskSebep, ozet: text });

    logLine('eskalasyon(' + JSON.stringify({sebep: eskSebep, ozet: text}) + ')', eskalasyonSonucu, 'tag-supheli');
    renderToolResultCard('eskalasyon', {}, eskalasyonSonucu);
    addBubble('agent', 'Yaşadığınız deneyim için üzgünüz. Talebiniz inceleme sürecine alındı ve bir müşteri temsilcisine aktarıldı.');

    setInputDisabled(false);
    return;
  }

  if(modeSelect.value === 'demo'){
    try{
      await processDemoMessage(text, analiz, supheliMetin);
    }catch(err){
      addBubble('agent', 'Demo motorunda beklenmeyen bir hata oluştu: ' + err.message);
    }finally{
      setInputDisabled(false);
    }
    return;
  }

  const typingEl = document.createElement('div');
  typingEl.className = 'typing';
  typingEl.textContent = 'Agent yazıyor…';
  chatEl.appendChild(typingEl);
  chatEl.scrollTop = chatEl.scrollHeight;

  try{
    const system = await buildSystemPrompt(currentEmail);
    let loopGuard = 0;
    let data = await callClaude(messages, system);

    while(data.stop_reason === 'tool_use' && loopGuard < 6){
      loopGuard++;
      messages.push({role:'assistant', content: data.content});

      const toolResultsContent = [];
      for(const block of data.content){
        if(block.type !== 'tool_use') continue;
        const impl = TOOL_IMPL[block.name];
        let result;
        try{
          result = impl ? await impl(block.input) : {hata:'Bilinmeyen tool: ' + block.name};
        }catch(e){
          result = {hata:'Tool çalıştırma hatası: ' + e.message};
        }

        logLine(block.name + '(' + JSON.stringify(block.input) + ')', result,
          result.supheli_desen ? 'tag-supheli' : '');

        if(block.name !== 'durum_etiketle'){
          renderToolResultCard(block.name, block.input, result);
        }

        if(result.supheli_desen){
          const eskSonuc = await eskalasyon({
            sebep:'Şüpheli işlem deseni',
            ozet:`Tool sonucu şüpheli desen döndürdü. Tool: ${block.name}, Sipariş: ${block.input?.siparis_no || '-'}`
          });

          logLine('eskalasyon(' + JSON.stringify({
            sebep:'Şüpheli işlem deseni',
            ozet:`Tool sonucu şüpheli desen döndürdü. Tool: ${block.name}, Sipariş: ${block.input?.siparis_no || '-'}`
          }) + ')', eskSonuc, 'tag-supheli');

          renderToolResultCard('eskalasyon', {}, eskSonuc);
        }

        toolResultsContent.push({
          type:'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result)
        });
      }

      messages.push({role:'user', content: toolResultsContent});
      data = await callClaude(messages, system);
    }

    if(data.stop_reason === 'tool_use'){
      typingEl.remove();
      addBubble('agent', 'İşlem beklenenden uzun sürdü ve tamamlanamadı. Lütfen talebinizi kısaca tekrar yazın veya bir müşteri temsilcisinden yardım isteyin.');
      logLine('tool_loop_guard', {mesaj:'Tool çağrı döngüsü sınırına ulaşıldı.'}, 'tag-supheli');
      setInputDisabled(false);
      return;
    }

    messages.push({role:'assistant', content: data.content});
    const finalText = data.content.filter(b=>b.type==='text').map(b=>b.text).join('\n').trim();
    typingEl.remove();
    if(finalText) addBubble('agent', finalText);

  }catch(err){
    typingEl.remove();
    logLine('api_fallback', {hata:err.message, aksiyon:'Demo motoruna geçildi'}, 'tag-sinirli');
    addBubble('agent', 'AI API bağlantısı kurulamadı; işlemi demo motoruyla sürdürüyorum.');
    try{
      await processDemoMessage(text, analiz, supheliMetin);
    }catch(fallbackErr){
      addBubble('agent', 'Demo motorunda beklenmeyen bir hata oluştu: ' + fallbackErr.message);
    }
  }finally{
    setInputDisabled(false);
  }
}

function setInputDisabled(disabled){
  document.getElementById('sendBtn').disabled = disabled;
  document.getElementById('msgInput').disabled = disabled;
}

document.getElementById('sendBtn').addEventListener('click', ()=>{
  const input = document.getElementById('msgInput');
  const text = input.value;
  input.value = '';
  handleSend(text);
});
document.getElementById('msgInput').addEventListener('keydown', e=>{
  if(e.key === 'Enter'){
    const text = e.target.value;
    e.target.value = '';
    handleSend(text);
  }
});
document.querySelectorAll('.suggestions button').forEach(btn=>{
  btn.addEventListener('click', ()=> handleSend(btn.dataset.msg));
});
document.getElementById('openOrdersBtn').addEventListener('click', async ()=>{
  await siparisleriGoster();
});
document.getElementById('verifyBtn').addEventListener('click', async ()=>{
  const siparisNo = document.getElementById('verifyOrderInput').value.trim().toUpperCase();
  const contact = document.getElementById('verifyContactInput').value.trim();
  const sonuc = dogrulaSiparis(siparisNo, contact);
  if(sonuc.basarili){
    addBubble('agent', `${siparisNo} için kimlik doğrulaması tamamlandı. Artık sipariş, kargo, iade veya değişim işlemi yapabilirim.`);
    showToast('Kimlik doğrulandı');
  }else{
    const esk = await eskalasyon({sebep:'Başarısız kimlik doğrulama', ozet:`Sipariş: ${siparisNo}`});
    renderToolResultCard('eskalasyon', {}, esk);
    addBubble('agent', 'Bilgiler eşleşmedi. Talebiniz inceleme sürecine alındı.');
  }
});
document.getElementById('runScenarioBtn').addEventListener('click', ()=>{
  const scenario = document.getElementById('scenarioSelect').value;
  if(!scenario){
    showToast('Önce bir test senaryosu seçin.');
    return;
  }
  handleSend(scenario);
});
document.getElementById('repPanelBtn').addEventListener('click', ()=>{
  const panel = document.getElementById('repPanel');
  panel.classList.toggle('open');
  renderRepPanel();
});
document.getElementById('exportLogBtn').addEventListener('click', ()=>{
  const payload = JSON.stringify(logEntries, null, 2);
  const blob = new Blob([payload], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'depom-agent-gunluk.json';
  a.click();
  URL.revokeObjectURL(url);
});
document.getElementById('clearChatBtn').addEventListener('click', async ()=>{
  messages = [];
  pendingAction = null;
  chatEl.innerHTML = '';
  logpanel.innerHTML = '';
  logEntries = [];
  addBubble('agent', 'Sohbet temizlendi. Yeni bir işlem için sipariş numaranızı yazabilirsiniz.');
  addEmptyState();
  await renderCustomerSummary();
});
document.getElementById('resetMemoryBtn').addEventListener('click', async ()=>{
  await storageRemove('musteri-gecmis:ayse@example.com');
  await storageRemove('musteri-gecmis:mehmet@example.com');
  await storageRemove('musteri-gecmis:elif@example.com');
  await storageRemove('depom-rep-cases');
  verifiedOrders = new Set();
  repCases = [];
  pendingAction = null;
  lastOrderNo = null;
  logLine('hafiza_sifirla', {basarili:true}, '');
  document.getElementById('authStatus').className = 'auth-status';
  document.getElementById('authStatus').textContent = 'Hafıza sıfırlandı. Hassas işlemler için yeniden doğrulama gerekir.';
  await renderCustomerSummary();
  showToast('Hafıza sıfırlandı');
});
document.getElementById('themeBtn').addEventListener('click', ()=>{
  const dark = document.body.classList.toggle('dark');
  document.getElementById('themeBtn').textContent = dark ? t('themeBtnLight') : t('themeBtnDark');
  localStorage.setItem('depom-theme', dark ? 'dark' : 'light');
});
document.getElementById('langBtn').addEventListener('click', ()=>{
  i18nSetLang(i18nGetLang() === 'tr' ? 'en' : 'tr');
  applyStaticI18n();
});
modeSelect.addEventListener('change', renderCustomerSummary);
document.getElementById('customerSelect').addEventListener('change', e=>{
  currentEmail = e.target.value;
  messages = [];
  pendingAction = null;
  chatEl.innerHTML = '';
  logpanel.innerHTML = '';
  logEntries = [];
  document.getElementById('verifyOrderInput').value = '';
  document.getElementById('verifyContactInput').value = CUSTOMERS[currentEmail]?.telefon || currentEmail;
  document.getElementById('authStatus').className = 'auth-status';
  document.getElementById('authStatus').textContent = 'Müşteri değişti. Yeni işlem için sipariş no + e-posta/telefon doğrulaması gerekir.';
  addBubble('agent', karsilamaMesaji(currentEmail));
  addEmptyState();
  renderCustomerSummary();
});

if(localStorage.getItem('depom-theme') === 'dark'){
  document.body.classList.add('dark');
}
document.getElementById('verifyContactInput').value = CUSTOMERS[currentEmail]?.telefon || currentEmail;
applyStaticI18n();
loadRepCases();
addBubble('agent', karsilamaMesaji(currentEmail));
addEmptyState();
renderCustomerSummary();
