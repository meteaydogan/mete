const TOOL_IMPL = {
  kimlik_dogrula,
  siparis_sorgula,
  kargo_takip,
  iade_baslat,
  urun_degisim,
  eskalasyon,
  durum_etiketle
};

const TOOL_DEFS = [
  {
    name:'kimlik_dogrula',
    description:'Sipariş numarası ile e-posta veya telefon bilgisinin eşleştiğini doğrular. Hassas sipariş/kargo/iade/değişim işlemlerinden önce çağrılmalıdır.',
    input_schema:{ type:'object', properties:{
      siparis_no:{type:'string'},
      email_veya_telefon:{type:'string'}
    }, required:['siparis_no','email_veya_telefon']}
  },
  {
    name:'siparis_sorgula',
    description:'Bir sipariş numarasının güncel durumunu, ürününü ve tahmini teslimat tarihini getirir. Kimlik doğrulama için müşterinin e-postası da gereklidir.',
    input_schema:{ type:'object', properties:{
      siparis_no:{type:'string', description:'Örn: SP-1042'},
      email:{type:'string', description:'Müşterinin doğrulanmış e-postası'}
    }, required:['siparis_no','email']}
  },
  {
    name:'kargo_takip',
    description:'Bir siparişin kargo adımlarını ve tahmini teslimat tarihini getirir.',
    input_schema:{ type:'object', properties:{
      siparis_no:{type:'string'}, email:{type:'string'}
    }, required:['siparis_no','email']}
  },
  {
    name:'iade_baslat',
    description:'Teslim edilmiş bir sipariş için iade süreci başlatır. Sadece 14 gün içinde ve kimlik doğrulaması yapıldıktan sonra çağrılmalı. Geri alınamaz bir işlemdir; agent çağırmadan önce kullanıcıdan açık onay almalıdır.',
    input_schema:{ type:'object', properties:{
      siparis_no:{type:'string'}, email:{type:'string'}, sebep:{type:'string', description:'İade sebebi'},
      kargo_firmasi:{type:'string'}, fotograf_yuklendi:{type:'boolean'}
    }, required:['siparis_no','email','sebep']}
  },
  {
    name:'urun_degisim',
    description:'Teslim edilmiş ve süre içinde olan bir sipariş için ürün değişimi talebi başlatır. Kimlik doğrulama gerekir. Geri alınamaz işlem olduğu için agent çağırmadan önce kullanıcıdan açık onay almalıdır.',
    input_schema:{ type:'object', properties:{
      siparis_no:{type:'string'},
      email:{type:'string'},
      sebep:{type:'string', description:'Değişim sebebi'},
      kargo_firmasi:{type:'string'},
      fotograf_yuklendi:{type:'boolean'}
    }, required:['siparis_no','email','sebep']}
  },
  {
    name:'eskalasyon',
    description:'Agent çözemediği, kimlik doğrulaması başarısız olan, çok öfkeli/tehditkar veya şüpheli bir durumda talebi insan temsilciye aktarır.',
    input_schema:{ type:'object', properties:{
      sebep:{type:'string'}, ozet:{type:'string', description:'Konuşmanın kısa özeti'}
    }, required:['sebep']}
  },
  {
    name:'durum_etiketle',
    description:'Kullanıcının duygu durumunu ve önceliğini etiketler. Kullanıcıya gösterilmez, sadece iç günlük içindir.',
    input_schema:{ type:'object', properties:{
      duygu:{type:'string', enum:['sakin','endiseli','sinirli','cok_sinirli']},
      oncelik:{type:'string', enum:['dusuk','normal','yuksek','acil']},
      supheli_durum:{type:'boolean'},
      not:{type:'string', description:'Kısa iç not'}
    }, required:['duygu','oncelik','supheli_durum']}
  }
];

async function buildSystemPrompt(email){
  const gecmis = await getMusteriGecmisi(email);

  return `Sen DEPOM adlı e-ticaret sitesi için çalışan bir müşteri destek agent'ısın.
Görevin müşterilerin taleplerini anlamak ve sana tanımlı tool'ları kullanarak gerçek işlemleri yapmaktır.

Şu anki müşterinin doğrulanmış e-postası: ${email}
Müşteri geçmişi: son kayıtlı iade sayısı ${gecmis.iadeSayisi}. Notlar: ${JSON.stringify(gecmis.notlar || [])}

KİMLİK DOĞRULAMA:
- Kullanıcı sipariş numarasıyla birlikte e-posta veya telefon verirse önce kimlik_dogrula tool'unu çağır.
- Sipariş, kargo, iade ve değişim işlemlerinde tool çağrılarında email parametresi olarak doğrulanmış e-postayı kullan.
- Sipariş numarası ile e-posta eşleşmezse hassas bilgi paylaşma.
- Doğrulama başarısızsa veya tutarsız bilgi varsa eskalasyon tool'unu çağır.

GÖREVLER:
1. Sipariş sorgulama:
   - siparis_sorgula tool'unu çağır.
   - Durum, ürün ve tahmini teslimat bilgisini kısa ilet.

2. Kargo takip:
   - kargo_takip tool'unu çağır.
   - Güncel adımları ve tahmini teslimatı bildir.
   - Tahmin yürütme.

3. İade başlatma:
   - iade_baslat geri alınamaz bir işlemdir.
   - Çağırmadan önce kullanıcıya mutlaka "iade işlemini onaylıyor musunuz?" diye sor.
   - Açık onay almadan iade_baslat çağırma.
   - Tool hata döndürürse net ve nazikçe açıkla.
   - supheli_desen:true dönerse kullanıcıya "talebiniz inceleme sürecine alındı" de ve eskalasyon çağır.

4. Ürün değişimi:
   - Ürün değişimi istenirse urun_degisim tool'unu kullan.
   - Çağırmadan önce kullanıcıdan açık onay al.
   - Teslim edilmemiş, süre dışı veya doğrulama başarısız siparişlerde işlem yapma.

DUYGU VE ÖNCELİK:
- Kullanıcının duygu durumu sistem tarafından ayrıca loglanır.
- Kullanıcı sinirli görünüyorsa empatik başla.
- Kullanıcı çok sinirli, tehditkar veya şüpheli görünüyorsa işlem yapmadan eskalasyon çağır.

SAHTEKÂRLIK / KÖTÜYE KULLANIM:
- Kısa sürede çok sayıda iade, eşleşmeyen e-posta/sipariş veya tekrar eden hasarlı ürün iddialarında işlemi durdur.
- Kullanıcıya "talebiniz inceleme sürecine alındı" de.
- eskalasyon tool'unu çağır.

GENEL KURALLAR:
- Türkçe, kısa, net, samimi ama profesyonel yanıt ver.
- Bilmediğin konuda uydurma bilgi verme.
- Tool kapsamı dışında kalan taleplerde eskalasyon kullan.
- Kullanıcıya iç log JSON'u gösterme.`;
}
