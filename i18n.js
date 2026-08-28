/* =========================================================
   STATİK ARAYÜZ METİNLERİ İÇİN İ18N KATMANI
   Not: Demo motorunun kural tabanlı sohbet yanıtları Türkçe anahtar
   kelimelere dayandığından şimdilik yalnızca Türkçe çalışır; bu katman
   sabit arayüz metinlerini (buton, etiket, yer tutucu) çevirir.
   ========================================================= */
const I18N_STRINGS = {
  tr: {
    tagline:'MÜŞTERİ DESTEK AGENT — SİPARİŞ · İADE · KARGO TAKİP · DEĞİŞİM',
    stamp:'CANLI DEMO',
    customerLabel:'Test müşterisi:',
    verifyOrderPlaceholder:'Sipariş no: SP-1042',
    verifyContactPlaceholder:'E-posta veya telefon',
    verifyBtn:'DOĞRULA',
    authStatusDefault:'Henüz sipariş doğrulanmadı. Hassas işlemler için sipariş no + e-posta/telefon eşleşmesi gerekir.',
    modeDemo:'Demo motoru (API gerekmez)',
    modeAi:'AI API modu',
    openOrdersBtn:'Müşterinin siparişleri',
    scenarioDefault:'Test senaryosu seç',
    runScenarioBtn:'Senaryoyu çalıştır',
    repPanelBtn:'Temsilci paneli',
    exportLogBtn:'Günlüğü indir',
    clearChatBtn:'Sohbeti temizle',
    resetMemoryBtn:'Hafızayı sıfırla',
    themeBtnDark:'Koyu tema',
    themeBtnLight:'Açık tema',
    langBtn:'EN',
    repPanelTitle:'İnsan Temsilci Kuyruğu',
    logbarLabel:"▤ SİSTEM GÜNLÜĞÜ (agent'ın çağırdığı tool'lar burada görünür)",
    chatAriaLabel:'Müşteri destek sohbeti',
    msgPlaceholder:'Mesajınızı yazın...',
    sendBtn:'GÖNDER',
    emptyState:'İpucu: Sipariş numarasıyla kargo sorgulayabilir, iade/değişim talebi başlatabilir veya müşteri geçmişini inceleyebilirsiniz.',
    greetingTemplate:'Merhaba {ad}, ben DEPOM destek asistanınızım. Sipariş durumu, kargo takibi, iade veya değişim konusunda yardımcı olabilirim.'
  },
  en: {
    tagline:'CUSTOMER SUPPORT AGENT — ORDERS · RETURNS · TRACKING · EXCHANGES',
    stamp:'LIVE DEMO',
    customerLabel:'Test customer:',
    verifyOrderPlaceholder:'Order no: SP-1042',
    verifyContactPlaceholder:'Email or phone',
    verifyBtn:'VERIFY',
    authStatusDefault:'No order verified yet. Sensitive actions require a matching order number + email/phone.',
    modeDemo:'Demo engine (no API needed)',
    modeAi:'AI API mode',
    openOrdersBtn:"Customer's orders",
    scenarioDefault:'Choose a test scenario',
    runScenarioBtn:'Run scenario',
    repPanelBtn:'Agent queue',
    exportLogBtn:'Export log',
    clearChatBtn:'Clear chat',
    resetMemoryBtn:'Reset memory',
    themeBtnDark:'Dark theme',
    themeBtnLight:'Light theme',
    langBtn:'TR',
    repPanelTitle:'Human Agent Queue',
    logbarLabel:'▤ SYSTEM LOG (tool calls made by the agent appear here)',
    chatAriaLabel:'Customer support chat',
    msgPlaceholder:'Type your message...',
    sendBtn:'SEND',
    emptyState:'Tip: you can look up shipping with an order number, start a return/exchange, or review customer history.',
    greetingTemplate:"Hello {ad}, I'm your DEPOM support assistant. I can help with order status, shipment tracking, returns, or exchanges."
  }
};

function i18nGetLang(){
  return localStorage.getItem('depom-lang') === 'en' ? 'en' : 'tr';
}

function i18nSetLang(lang){
  localStorage.setItem('depom-lang', lang === 'en' ? 'en' : 'tr');
}

function t(key){
  const lang = i18nGetLang();
  return (I18N_STRINGS[lang] && I18N_STRINGS[lang][key]) || I18N_STRINGS.tr[key] || key;
}
