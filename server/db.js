// Dosya tabanlı, bağımlılıksız kalıcı katman. Küçük ölçekli demo/başlangıç amaçlıdır;
// gerçek üretimde bunun yerine Postgres/SQLite gibi bir veritabanı kullanılmalıdır.
const fs = require('fs');
const path = require('path');
const { CUSTOMERS, ORDERS } = require('../data.js');

const DATA_DIR = process.env.DEPOM_DATA_DIR || path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const CASES_FILE = path.join(DATA_DIR, 'cases.json');

let writeQueue = Promise.resolve();
function enqueueWrite(fn){
  writeQueue = writeQueue.then(fn, fn);
  return writeQueue;
}

function readJsonSync(file, fallback){
  try{
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }catch(e){
    return fallback;
  }
}

function writeJsonSync(file, data){
  fs.mkdirSync(DATA_DIR, {recursive:true});
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function defaultHistory(email){
  return { iadeSayisi: email === 'ayse@example.com' ? 2 : 0, notlar: [] };
}

function getOrder(siparisNo){
  return ORDERS[siparisNo] || null;
}

function getCustomer(email){
  return CUSTOMERS[email] || null;
}

function findOrdersByEmail(email){
  return Object.entries(ORDERS)
    .filter(([, order]) => order.email === email)
    .map(([siparisNo, order]) => ({siparisNo, ...order}));
}

function getHistory(email){
  const all = readJsonSync(HISTORY_FILE, {});
  return all[email] || defaultHistory(email);
}

async function saveHistory(email, history){
  return enqueueWrite(() => {
    const all = readJsonSync(HISTORY_FILE, {});
    all[email] = history;
    writeJsonSync(HISTORY_FILE, all);
  });
}

async function appendHistoryEntry(email, entry){
  const history = getHistory(email);
  history.notlar = history.notlar || [];
  history.notlar.push(entry);
  if(entry.tur === 'iade') history.iadeSayisi = (history.iadeSayisi || 0) + 1;
  await saveHistory(email, history);
  return history;
}

function hasExistingRequest(email, siparisNo, tur){
  const history = getHistory(email);
  return (history.notlar || []).some(n => n.siparis_no === siparisNo && n.tur === tur);
}

function listCases(){
  return readJsonSync(CASES_FILE, []);
}

async function addCase(caseItem){
  return enqueueWrite(() => {
    const cases = readJsonSync(CASES_FILE, []);
    cases.unshift(caseItem);
    writeJsonSync(CASES_FILE, cases);
    return cases;
  });
}

async function resolveCase(id){
  return enqueueWrite(() => {
    const cases = readJsonSync(CASES_FILE, []);
    const updated = cases.map(c => c.id === id ? {...c, durum:'çözüldü'} : c);
    writeJsonSync(CASES_FILE, updated);
    return updated;
  });
}

async function resetAll(){
  return enqueueWrite(() => {
    writeJsonSync(HISTORY_FILE, {});
    writeJsonSync(CASES_FILE, []);
  });
}

module.exports = {
  DATA_DIR,
  getOrder, getCustomer, findOrdersByEmail,
  getHistory, appendHistoryEntry, hasExistingRequest,
  listCases, addCase, resolveCase, resetAll
};
