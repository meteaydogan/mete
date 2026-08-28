/* =========================================================
   KALICI HAFIZA — window.storage varsa onu, yoksa localStorage kullanır
   ========================================================= */
async function storageGet(key){
  if(window.storage?.get) return window.storage.get(key);

  const value = localStorage.getItem(key);
  if(value === null) throw new Error('Kayıt yok');

  return { value };
}

async function storageSet(key, value){
  if(window.storage?.set) return window.storage.set(key, value);

  localStorage.setItem(key, value);
  return true;
}

async function storageRemove(key){
  if(window.storage?.delete) return window.storage.delete(key);
  localStorage.removeItem(key);
  return true;
}

async function getMusteriGecmisi(email){
  try{
    const r = await storageGet('musteri-gecmis:' + email);
    return JSON.parse(r.value);
  }catch(e){
    const varsayilan = {
      iadeSayisi: email === 'ayse@example.com' ? 2 : 0,
      notlar: []
    };

    await storageSet('musteri-gecmis:' + email, JSON.stringify(varsayilan));
    return varsayilan;
  }
}

async function setMusteriGecmisi(email, veri){
  await storageSet('musteri-gecmis:' + email, JSON.stringify(veri));
}

function gunFarki(tarihStr){
  const t = new Date(tarihStr + 'T12:00:00');
  return Math.round((BUGUN - t) / (1000*60*60*24));
}

function gunEkle(gun){
  const d = new Date(BUGUN);
  d.setDate(d.getDate() + gun);
  return d.toLocaleDateString('tr-TR', {day:'2-digit', month:'short'});
}

function temizleContact(value){
  return String(value || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9@.+]/g, '');
}

function dogrulamaAnahtari(email, siparis_no){
  return `${email}|${siparis_no}`;
}

function siparisDogrulandiMi(siparis_no, email){
  return verifiedOrders.has(dogrulamaAnahtari(email, siparis_no));
}

function riskSkoruHesapla(email, ekSupheli){
  const orders = getCustomerOrders(email);
  const gecmisRaw = localStorage.getItem('musteri-gecmis:' + email);
  let iadeSayisi = email === 'ayse@example.com' ? 2 : 0;
  try{
    if(gecmisRaw) iadeSayisi = JSON.parse(gecmisRaw).iadeSayisi || iadeSayisi;
  }catch(e){}
  const teslimEdilen = orders.filter(o => o.durum === 'Teslim Edildi').length;
  const geciken = orders.filter(o => o.durum !== 'Teslim Edildi' && gunFarki(o.siparisTarihi) > 5).length;
  return Math.min(100, (iadeSayisi * 22) + (teslimEdilen ? 8 : 0) + (geciken * 10) + (ekSupheli ? 35 : 0));
}

/* =========================================================
   TOOL'LAR — agent'ın çağırabileceği gerçek işlevler
   ========================================================= */
async function kimlik_dogrula({siparis_no, email_veya_telefon}){
  return dogrulaSiparis(siparis_no, email_veya_telefon);
}

async function siparis_sorgula({siparis_no, email}){
  const o = ORDERS[siparis_no];
  if(!o) return {hata:'Sipariş bulunamadı: ' + siparis_no};
  if(o.email.toLowerCase() !== (email||'').toLowerCase()){
    return {hata:'Doğrulama başarısız: bu e-posta bu sipariş numarasıyla eşleşmiyor.', supheli_desen:true};
  }
  if(!siparisDogrulandiMi(siparis_no, email)){
    return {hata:'Kimlik doğrulaması gerekli. Lütfen sipariş numarasıyla birlikte e-posta veya telefon bilgisini doğrulayın.'};
  }
  return {
    siparis_no, urun:o.urun, tutar:o.tutar, durum:o.durum,
    siparis_tarihi:o.siparisTarihi, tahmini_teslimat:o.teslimTarihiTahmini,
    kargo_firmasi:o.kargoFirmasi || 'DEPOM Express', takip_no:o.takipNo || 'TRK-' + siparis_no.replace('SP-', '')
  };
}

async function kargo_takip({siparis_no, email}){
  const o = ORDERS[siparis_no];
  if(!o) return {hata:'Sipariş bulunamadı: ' + siparis_no};
  if(o.email.toLowerCase() !== (email||'').toLowerCase()){
    return {hata:'Doğrulama başarısız: e-posta eşleşmiyor.', supheli_desen:true};
  }
  if(!siparisDogrulandiMi(siparis_no, email)){
    return {hata:'Kimlik doğrulaması gerekli. Lütfen sipariş numarasıyla birlikte e-posta veya telefon bilgisini doğrulayın.'};
  }
  return {siparis_no, durum:o.durum, adimlar:o.kargoAdimlari, tahmini_teslimat:o.teslimTarihiTahmini, kargo_firmasi:o.kargoFirmasi || 'DEPOM Express', takip_no:o.takipNo || 'TRK-' + siparis_no.replace('SP-', '')};
}

async function iade_baslat({siparis_no, email, sebep, kargo_firmasi, fotograf_yuklendi}){
  const o = ORDERS[siparis_no];
  if(!o) return {hata:'Sipariş bulunamadı: ' + siparis_no};
  if(o.email.toLowerCase() !== (email||'').toLowerCase()){
    return {hata:'Doğrulama başarısız: e-posta eşleşmiyor.', supheli_desen:true};
  }
  if(!siparisDogrulandiMi(siparis_no, email)){
    return {hata:'Kimlik doğrulaması gerekli. Lütfen sipariş numarasıyla birlikte e-posta veya telefon bilgisini doğrulayın.'};
  }
  if(o.durum !== 'Teslim Edildi'){
    return {hata:'Bu sipariş henüz teslim edilmedi, teslim edilmeden iade başlatılamaz. Güncel durum: ' + o.durum};
  }

  const gecenGun = gunFarki(o.teslimTarihi);
  if(gecenGun > IADE_SURESI_GUN){
    return {hata:`İade süresi dolmuş: teslimattan bu yana ${gecenGun} gün geçmiş, yasal/politika sınırı ${IADE_SURESI_GUN} gün.`};
  }

  const gecmis = await getMusteriGecmisi(email);
  const mevcutTalep = (gecmis.notlar || []).find(n => n.siparis_no === siparis_no && n.tur === 'iade');
  if(mevcutTalep){
    return {hata:`${siparis_no} için daha önce bir iade talebi oluşturulmuş.`};
  }
  gecmis.iadeSayisi += 1;
  gecmis.notlar.push({siparis_no, sebep, tarih: BUGUN.toISOString().slice(0,10), tur:'iade'});
  await setMusteriGecmisi(email, gecmis);

  const supheli = gecmis.iadeSayisi >= SUPHELI_ESIK;
  return {
    basarili:true,
    siparis_no, sebep,
    teslimattan_bu_yana_gun: gecenGun,
    musterinin_toplam_iade_sayisi: gecmis.iadeSayisi,
    supheli_desen: supheli,
    durum: supheli ? 'incelemede' : 'onaylandi',
    iade_kodu: supheli ? null : ('IAD-' + Math.floor(1000+Math.random()*9000)),
    iade_etiketi: supheli ? null : ('ETK-' + siparis_no.replace('SP-', '') + '-' + Math.floor(100+Math.random()*900)),
    kargo_firmasi: kargo_firmasi || 'DEPOM Express',
    fotograf_yuklendi: !!fotograf_yuklendi,
    tahmini_ucret_iadesi: gunEkle(5)
  };
}

async function urun_degisim({siparis_no, email, sebep, kargo_firmasi, fotograf_yuklendi}){
  const o = ORDERS[siparis_no];

  if(!o) return {hata:'Sipariş bulunamadı: ' + siparis_no};

  if(o.email.toLowerCase() !== (email||'').toLowerCase()){
    return {hata:'Doğrulama başarısız: e-posta eşleşmiyor.', supheli_desen:true};
  }

  if(!siparisDogrulandiMi(siparis_no, email)){
    return {hata:'Kimlik doğrulaması gerekli. Lütfen sipariş numarasıyla birlikte e-posta veya telefon bilgisini doğrulayın.'};
  }

  if(o.durum !== 'Teslim Edildi'){
    return {hata:'Bu sipariş henüz teslim edilmedi, değişim başlatılamaz. Güncel durum: ' + o.durum};
  }

  const gecenGun = gunFarki(o.teslimTarihi);

  if(gecenGun > IADE_SURESI_GUN){
    return {hata:`Değişim süresi dolmuş: teslimattan bu yana ${gecenGun} gün geçmiş, politika sınırı ${IADE_SURESI_GUN} gün.`};
  }

  const gecmis = await getMusteriGecmisi(email);
  const mevcutTalep = (gecmis.notlar || []).find(n => n.siparis_no === siparis_no && n.tur === 'degisim');
  if(mevcutTalep){
    return {hata:`${siparis_no} için daha önce bir değişim talebi oluşturulmuş.`};
  }
  gecmis.notlar.push({siparis_no, sebep, tarih: BUGUN.toISOString().slice(0,10), tur:'degisim'});
  await setMusteriGecmisi(email, gecmis);

  return {
    basarili:true,
    siparis_no,
    urun:o.urun,
    sebep,
    teslimattan_bu_yana_gun: gecenGun,
    durum:'onaylandi',
    degisim_kodu:'DGS-' + Math.floor(1000+Math.random()*9000),
    kargo_firmasi: kargo_firmasi || 'DEPOM Express',
    fotograf_yuklendi: !!fotograf_yuklendi,
    yeni_urun_cikis_tahmini: gunEkle(3)
  };
}

async function eskalasyon({sebep, ozet}){
  const caseItem = {
    id:'CASE-' + Math.floor(10000 + Math.random()*90000),
    musteri: currentEmail,
    sebep,
    ozet: ozet || '',
    durum:'beklemede',
    oncelik: sebep && sebep.toLowerCase().includes('şüpheli') ? 'yüksek' : 'normal'
  };
  repCases.unshift(caseItem);
  await storageSet('depom-rep-cases', JSON.stringify(repCases));
  renderRepPanel();
  return {yonlendirildi:true, bilgi:'Talep bir müşteri temsilcisine aktarıldı: ' + sebep, ozet: ozet||'', vaka_no:caseItem.id};
}

async function durum_etiketle({duygu, oncelik, supheli_durum, not: notMetni}){
  return {kaydedildi:true, duygu, oncelik, supheli_durum, not:notMetni || ''};
}

function duyguAnalizEt(mesaj){
  const m = mesaj.toLowerCase();

  const tehdit = /(mahkeme|şikayet edeceğim|savcılık|dolandırıcı|rezil edeceğim|paramı verin|hemen çözün|yeter artık)/i.test(m);
  const cokSinirli = /(çok sinirliyim|çok öfkeliyim|bıktım|rezalet|berbat|asla kabul etmiyorum)/i.test(m);
  const sinirli = /(sinirliyim|kızgınım|öfkeliyim|hayal kırıklığı|bozuk|hasarlı|gecikti|şikayetçiyim)/i.test(m);
  const endiseli = /(endişeliyim|merak ediyorum|ulaşmadı|ne zaman|nerede|kayboldu mu)/i.test(m);

  if(tehdit || cokSinirli) return {duygu:'cok_sinirli', oncelik:'acil'};
  if(sinirli) return {duygu:'sinirli', oncelik:'yuksek'};
  if(endiseli) return {duygu:'endiseli', oncelik:'normal'};

  return {duygu:'sakin', oncelik:'normal'};
}

function supheliMetinAnalizEt(mesaj){
  const m = mesaj.toLowerCase();
  return /(üçüncü kez|3\. kez|defalarca|hep bozuk|sürekli hasarlı|aynı ürün yine hasarlı|yine bozuk)/i.test(m);
}

function durumLogNotuOlustur(mesaj, duygu, supheli){
  if(supheli) return 'Şüpheli desen: tekrar eden hasarlı/bozuk ürün iddiası.';
  if(duygu === 'cok_sinirli') return 'Kullanıcı çok sinirli veya tehditkar görünüyor.';
  if(duygu === 'sinirli') return 'Kullanıcı öfkeli veya hayal kırıklığı yaşıyor.';
  if(duygu === 'endiseli') return 'Kullanıcı teslimat/sipariş konusunda endişeli.';
  return 'Kullanıcı sakin.';
}
