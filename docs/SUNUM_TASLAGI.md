# Sunum Slayt Taslağı — DEPOM Müşteri Destek Agent

> 12-15 slaytlık tipik bir bitirme projesi savunması için taslak. Her madde bir slayt önerisidir; içerikleri kendi cümlelerinizle kısaltarak (maddeler hâlinde, uzun paragraf olmadan) slayta aktarınız.

## 1. Kapak
- Proje adı, öğrenci adı, danışman adı, bölüm, tarih

## 2. Problem ve Motivasyon
- Müşteri destek süreçlerinde tekrarlayan işlemler ve insan kaynağı maliyeti
- Tam otomasyonun riskleri (yanlış iade, dolandırıcılık, güven kaybı)

## 3. Proje Amacı ve Kapsamı
- Ne yapılıyor, ne yapılmıyor (kapsam dışı maddeler)

## 4. Özgün Katkı
- Bu projenin ayırt edici 2-3 noktası (rapor bölüm 1.3'ten)

## 5. Genel Mimari (Görsel)
- `docs/PROJE_RAPORU.md` içindeki flowchart diyagramını slayta görsel olarak ekleyin

## 6. Tool-Calling Akışı
- Kullanıcı mesajı → duygu analizi → tool çağrısı → sonuç kartı → yanıt
- Sequence diyagramını gösterin (README.md)

## 7. Güvenlik Tasarımı
- Kimlik doğrulama, oturum, hız sınırlama, audit log
- "Neden önemli": impersonation ve dolandırıcılık örnekleri

## 8. Öne Çıkan İş Kuralları
- 14 günlük iade penceresi, mükerrer talep engeli, risk skorlama

## 9. Canlı Demo (1)
- Başarılı kargo sorgulama + iade onay akışı

## 10. Canlı Demo (2)
- Şüpheli/sinirli müşteri senaryosu → otomatik eskalasyon → temsilci paneli

## 11. Test Yaklaşımı ve Sonuçlar
- Birim test listesi, `npm test` çıktısı (gerçek sayılarla doldurunuz)

## 12. Karşılaşılan Zorluklar
- [Kendi deneyiminizden 2-3 madde: ör. "geri alınamaz işlemlerde onay akışının tasarımı", "oturum güvenliği"]

## 13. Bilinen Sınırlar ve Gelecek Çalışmalar
- Rapor bölüm 6'dan özet

## 14. Sonuç
- Tek paragraflık kapanış mesajı

## 15. Sorular
- "Sorularınız?" slaytı

---

### Sunum Provası İçin Notlar
- Canlı demo öncesi `npm start` çalıştığından ve `http://localhost:3000` açıldığından emin olun; internet kesilirse Demo motoru (API gerektirmez) moduna geçebileceğinizi jüriye belirtin.
- Olası soru: "Neden gerçek bir veritabanı kullanmadınız?" → Rapor bölüm 6 / README "Bilinen sınırlar" cevabını hazırlayın.
- Olası soru: "Bu bir bitirme projesi için yeterince karmaşık mı?" → Mimari katman sayısını (istemci demo motoru, backend proxy, oturum, kalıcı veri, güvenlik, test) vurgulayın.
