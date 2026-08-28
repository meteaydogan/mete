// Node'un yerleşik test çalıştırıcısıyla çalışır: `node --test` veya `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// db.js'in bağımsız bir geçici veri klasörü kullanması için önce env değişkenini ayarla.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'depom-test-'));
process.env.DEPOM_DATA_DIR = tmpDir;

const tools = require('./tools');

test('kimlik_dogrula doğru e-posta ile başarılı olur', () => {
  const sonuc = tools.kimlik_dogrula({siparis_no:'SP-1042', email_veya_telefon:'ayse@example.com'});
  assert.equal(sonuc.basarili, true);
});

test('kimlik_dogrula yanlış iletişim bilgisiyle şüpheli desen döndürür', () => {
  const sonuc = tools.kimlik_dogrula({siparis_no:'SP-1042', email_veya_telefon:'baskasi@example.com'});
  assert.equal(sonuc.basarili, false);
  assert.equal(sonuc.supheli_desen, true);
});

test('siparis_sorgula başkasının siparişine erişimi reddeder', () => {
  const sonuc = tools.siparis_sorgula({siparis_no:'SP-2031'}, 'ayse@example.com');
  assert.ok(sonuc.hata);
  assert.equal(sonuc.supheli_desen, true);
});

test('siparis_sorgula sahibi için doğru veri döner', () => {
  const sonuc = tools.siparis_sorgula({siparis_no:'SP-1042'}, 'ayse@example.com');
  assert.equal(sonuc.urun, 'Kablosuz Kulaklık');
});

test('iade_baslat teslim edilmemiş siparişte reddedilir', async () => {
  const sonuc = await tools.iade_baslat({siparis_no:'SP-2031', sebep:'test'}, 'mehmet@example.com');
  assert.ok(sonuc.hata.includes('teslim edilmedi'));
});

test('iade_baslat teslim edilmiş ve süre içindeki siparişte onaylanır', async () => {
  const sonuc = await tools.iade_baslat({siparis_no:'SP-1090', sebep:'ilk talep'}, 'ayse@example.com');
  assert.equal(sonuc.basarili, true);
  assert.equal(sonuc.durum, 'onaylandi');
});

test('iade_baslat aynı sipariş için mükerrer talebi engeller', async () => {
  const ikinci = await tools.iade_baslat({siparis_no:'SP-1090', sebep:'ikinci talep'}, 'ayse@example.com');
  assert.ok(ikinci.hata.includes('daha önce'));
});

test('eskalasyon vaka oluşturur ve db.listCases içinde görünür', async () => {
  const db = require('./db');
  const sonucOnce = db.listCases().length;
  await tools.eskalasyon({sebep:'test sebebi', ozet:'test özeti'}, 'elif@example.com');
  assert.equal(db.listCases().length, sonucOnce + 1);
});
