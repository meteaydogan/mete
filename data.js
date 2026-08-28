/* =========================================================
   MOCK VERİTABANI — gerçek bir mağazanın sipariş/müşteri verisini simüle eder
   ========================================================= */
function bugunOlustur(){
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

const BUGUN = bugunOlustur();

const CUSTOMERS = {
  'ayse@example.com':   { ad: 'Ayşe Yılmaz', telefon:'0555 111 22 33', tercih:'Kısa ve net bilgilendirme' },
  'mehmet@example.com': { ad: 'Mehmet Kaya', telefon:'0555 222 33 44', tercih:'Detaylı kargo bilgisi' },
  'elif@example.com':   { ad: 'Elif Demir', telefon:'0555 333 44 55', tercih:'Nazik ve açıklayıcı ton' }
};

const ORDERS = {
  'SP-1042': {
    email:'ayse@example.com', urun:'Kablosuz Kulaklık', tutar:'1.249 TL',
    siparisTarihi:'2026-08-20', durum:'Kargoya Verildi',
    teslimTarihiTahmini:'2026-08-29', teslimTarihi:null,
    kargoAdimlari:[
      {adim:'Sipariş Alındı', tarih:'20 Ağu', tamam:true},
      {adim:'Hazırlanıyor', tarih:'21 Ağu', tamam:true},
      {adim:'Kargoya Verildi', tarih:'22 Ağu', tamam:true},
      {adim:'Dağıtım Merkezinde', tarih:'26 Ağu', tamam:true},
      {adim:'Teslim Edildi', tarih:'Tahmini 29 Ağu', tamam:false}
    ]
  },
  'SP-1090': {
    email:'ayse@example.com', urun:'Akıllı Saat', tutar:'3.499 TL',
    siparisTarihi:'2026-08-10', durum:'Teslim Edildi',
    teslimTarihiTahmini:'2026-08-14', teslimTarihi:'2026-08-14',
    kargoAdimlari:[
      {adim:'Sipariş Alındı', tarih:'10 Ağu', tamam:true},
      {adim:'Kargoya Verildi', tarih:'11 Ağu', tamam:true},
      {adim:'Teslim Edildi', tarih:'14 Ağu', tamam:true}
    ]
  },
  'SP-2031': {
    email:'mehmet@example.com', urun:'Kahve Makinesi', tutar:'2.199 TL',
    siparisTarihi:'2026-08-23', durum:'Yolda',
    teslimTarihiTahmini:'2026-08-28', teslimTarihi:null,
    kargoAdimlari:[
      {adim:'Sipariş Alındı', tarih:'23 Ağu', tamam:true},
      {adim:'Kargoya Verildi', tarih:'24 Ağu', tamam:true},
      {adim:'Dağıtım Merkezinde', tarih:'27 Ağu', tamam:true},
      {adim:'Teslim Edildi', tarih:'Tahmini 28 Ağu', tamam:false}
    ]
  },
  'SP-2050': {
    email:'mehmet@example.com', urun:'Kitap Seti (5 Kitap)', tutar:'899 TL',
    siparisTarihi:'2026-08-05', durum:'Teslim Edildi',
    teslimTarihiTahmini:'2026-08-08', teslimTarihi:'2026-08-08',
    kargoAdimlari:[
      {adim:'Sipariş Alındı', tarih:'5 Ağu', tamam:true},
      {adim:'Kargoya Verildi', tarih:'6 Ağu', tamam:true},
      {adim:'Teslim Edildi', tarih:'8 Ağu', tamam:true}
    ]
  },
  'SP-3010': {
    email:'elif@example.com', urun:'Masa Lambası', tutar:'459 TL',
    siparisTarihi:'2026-08-26', durum:'Hazırlanıyor',
    teslimTarihiTahmini:'2026-09-01', teslimTarihi:null,
    kargoAdimlari:[
      {adim:'Sipariş Alındı', tarih:'26 Ağu', tamam:true},
      {adim:'Hazırlanıyor', tarih:'27 Ağu', tamam:false}
    ]
  }
};

const IADE_SURESI_GUN = 14;
const SUPHELI_ESIK = 3;

// Tarayıcıda global script olarak, Node'da (server/) CommonJS modülü olarak kullanılabilir.
if(typeof module !== 'undefined' && module.exports){
  module.exports = { CUSTOMERS, ORDERS, IADE_SURESI_GUN, SUPHELI_ESIK, BUGUN };
}
