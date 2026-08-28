const test = require('node:test');
const assert = require('node:assert/strict');
const session = require('./session');

test('sign/verify aynı e-postayı doğru döner', () => {
  const token = session.sign('ayse@example.com');
  assert.equal(session.verify(token), 'ayse@example.com');
});

test('bozulmuş token reddedilir', () => {
  const token = session.sign('ayse@example.com');
  const bozuk = token.slice(0, -2) + 'xx';
  assert.equal(session.verify(bozuk), null);
});

test('süresi geçmiş token reddedilir', () => {
  const gecmisToken = session.sign('ayse@example.com', -1000);
  assert.equal(session.verify(gecmisToken), null);
});

test('parseCookies cookie header ayrıştırır', () => {
  const req = {headers:{cookie:'depom_session=abc123; theme=dark'}};
  const cookies = session.parseCookies(req);
  assert.equal(cookies.depom_session, 'abc123');
  assert.equal(cookies.theme, 'dark');
});
