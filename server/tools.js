// Sunucu taraflı kanonik tool implementasyonları. tools.js'deki tarayıcı sürümünden
// farkı: e-posta her zaman oturumdan alınır, istemciden gelen email alanına güvenilmez.
const db = require('./db');
const { BUGUN, IADE_SURESI_GUN, SUPHELI_ESIK } = require('../data.js');

function gunFarki(tarihStr){
  const t = new Date(tarihStr + 'T12:00:00');
  return Math.round((BUGUN - t) / (1000 * 60 * 60 * 24));
}

function gunEkle(gun){
  const d = new Date(BUGUN);
  d.setDate(d.getDate() + gun);
  return d.toLocaleDateString('tr-TR', {day:'2-digit', month:'short'});
}

function temizleContact(value){
  return String(value || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9@.+]/g, '');
}

function requireOwnedOrder(siparisNo, email){
  const order = db.getOrder(siparisNo);
  if(!order) return {hata:'Sipariş bulunamadı: ' + siparisNo};
  if(order.email.toLowerCase() !== (email || '').toLowerCase()){
    return {hata:'Bu sipariş oturum sahibine ait değil.', supheli_desen:true};
  }
  return {order};
}

function kimlik_dogrula({siparis_no, email_veya_telefon}){
  const order = db.getOrder(siparis_no);
  if(!order) return {basarili:false, hata:'Sipariş bulunamadı.'};
  const customer = db.getCustomer(order.email);
  const contact = temizleContact(email_veya_telefon);
  const emailMatches = temizleContact(order.email) === contact;
  const phoneMatches = temizleContact(customer && customer.telefon) === contact;
  if(emailMatches || phoneMatches){
    return {basarili:true, email: order.email};
  }
  return {basarili:false, hata:'Doğrulama başarısız: sipariş numarası ile e-posta/telefon eşleşmiyor.', supheli_desen:true};
}

function siparis_sorgula({siparis_no}, email){
  const check = requireOwnedOrder(siparis_no, email);
  if(check.hata) return check;
  const o = check.order;
  return {
    siparis_no, urun:o.urun, tutar:o.tutar, durum:o.durum,
    siparis_tarihi:o.siparisTarihi, tahmini_teslimat:o.teslimTarihiTahmini,
    kargo_firmasi:o.kargoFirmasi || 'DEPOM Express',
    takip_no:o.takipNo || 'TRK-' + siparis_no.replace('SP-', '')
  };
}

function kargo_takip({siparis_no}, email){
  const check = requireOwnedOrder(siparis_no, email);
  if(check.hata) return check;
  const o = check.order;
  return {
    siparis_no, durum:o.durum, adimlar:o.kargoAdimlari, tahmini_teslimat:o.teslimTarihiTahmini,
    kargo_firmasi:o.kargoFirmasi || 'DEPOM Express',
    takip_no:o.takipNo || 'TRK-' + siparis_no.replace('SP-', '')
  };
}

async function iade_baslat({siparis_no, sebep, kargo_firmasi, fotograf_yuklendi}, email){
  const check = requireOwnedOrder(siparis_no, email);
  if(check.hata) return check;
  const o = check.order;

  if(o.durum !== 'Teslim Edildi'){
    return {hata:'Bu sipariş henüz teslim edilmedi, iade başlatılamaz. Güncel durum: ' + o.durum};
  }
  const gecenGun = gunFarki(o.teslimTarihi);
  if(gecenGun > IADE_SURESI_GUN){
    return {hata:`İade süresi dolmuş: teslimattan bu yana ${gecenGun} gün geçmiş, politika sınırı ${IADE_SURESI_GUN} gün.`};
  }
  if(db.hasExistingRequest(email, siparis_no, 'iade')){
    return {hata:`${siparis_no} için daha önce bir iade talebi oluşturulmuş.`};
  }

  const history = await db.appendHistoryEntry(email, {siparis_no, sebep, tarih: BUGUN.toISOString().slice(0, 10), tur:'iade'});
  const supheli = history.iadeSayisi >= SUPHELI_ESIK;

  return {
    basarili:true, siparis_no, sebep,
    teslimattan_bu_yana_gun: gecenGun,
    musterinin_toplam_iade_sayisi: history.iadeSayisi,
    supheli_desen: supheli,
    durum: supheli ? 'incelemede' : 'onaylandi',
    iade_kodu: supheli ? null : ('IAD-' + Math.floor(1000 + Math.random() * 9000)),
    iade_etiketi: supheli ? null : ('ETK-' + siparis_no.replace('SP-', '') + '-' + Math.floor(100 + Math.random() * 900)),
    kargo_firmasi: kargo_firmasi || 'DEPOM Express',
    fotograf_yuklendi: !!fotograf_yuklendi,
    tahmini_ucret_iadesi: gunEkle(5)
  };
}

async function urun_degisim({siparis_no, sebep, kargo_firmasi, fotograf_yuklendi}, email){
  const check = requireOwnedOrder(siparis_no, email);
  if(check.hata) return check;
  const o = check.order;

  if(o.durum !== 'Teslim Edildi'){
    return {hata:'Bu sipariş henüz teslim edilmedi, değişim başlatılamaz. Güncel durum: ' + o.durum};
  }
  const gecenGun = gunFarki(o.teslimTarihi);
  if(gecenGun > IADE_SURESI_GUN){
    return {hata:`Değişim süresi dolmuş: teslimattan bu yana ${gecenGun} gün geçmiş, politika sınırı ${IADE_SURESI_GUN} gün.`};
  }
  if(db.hasExistingRequest(email, siparis_no, 'degisim')){
    return {hata:`${siparis_no} için daha önce bir değişim talebi oluşturulmuş.`};
  }

  await db.appendHistoryEntry(email, {siparis_no, sebep, tarih: BUGUN.toISOString().slice(0, 10), tur:'degisim'});

  return {
    basarili:true, siparis_no, urun:o.urun, sebep,
    teslimattan_bu_yana_gun: gecenGun,
    durum:'onaylandi',
    degisim_kodu:'DGS-' + Math.floor(1000 + Math.random() * 9000),
    kargo_firmasi: kargo_firmasi || 'DEPOM Express',
    fotograf_yuklendi: !!fotograf_yuklendi,
    yeni_urun_cikis_tahmini: gunEkle(3)
  };
}

async function eskalasyon({sebep, ozet}, email){
  const caseItem = {
    id:'CASE-' + Math.floor(10000 + Math.random() * 90000),
    musteri: email || 'bilinmiyor',
    sebep, ozet: ozet || '',
    durum:'beklemede',
    oncelik: sebep && sebep.toLowerCase().includes('şüpheli') ? 'yüksek' : 'normal'
  };
  await db.addCase(caseItem);
  return {yonlendirildi:true, bilgi:'Talep bir müşteri temsilcisine aktarıldı: ' + sebep, ozet: ozet || '', vaka_no:caseItem.id};
}

function durum_etiketle({duygu, oncelik, supheli_durum, not: notMetni}){
  return {kaydedildi:true, duygu, oncelik, supheli_durum, not:notMetni || ''};
}

module.exports = {
  gunFarki, gunEkle, temizleContact,
  kimlik_dogrula, siparis_sorgula, kargo_takip, iade_baslat, urun_degisim, eskalasyon, durum_etiketle
};
