const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/server');

let server; let origin;
test.before(async () => { server = createApp(); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`; });
test.after(() => new Promise((resolve) => server.close(resolve)));
async function signIn(email, password) { const response = await fetch(`${origin}/login`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email, password }) }); return response.headers.get('set-cookie').split(';')[0]; }
async function api(path, options = {}) { return fetch(`${origin}${path}`, { redirect: 'manual', ...options }); }

test('attempt 1: Alice cannot change an id to read Bob appointment', async () => { const cookie = await signIn('alice@example.test', 'AlicePass123!'); const response = await api('/api/appointments/apt-bob', { headers: { cookie } }); assert.equal(response.status, 403); assert.deepEqual(await response.json(), { error: "You cannot access another customer's appointment" }); });
test('attempt 2: mass-assignment userId is rejected', async () => { const cookie = await signIn('alice@example.test', 'AlicePass123!'); const response = await api('/api/appointments', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId: 'book-garden', slot: '2026-09-20T10:00', userId: 'user-bob' }) }); assert.equal(response.status, 400); assert.match((await response.json()).error, /Only bookId and slot/); });
test('attempt 3: script-tag input is rejected instead of stored or reflected', async () => { const cookie = await signIn('alice@example.test', 'AlicePass123!'); const response = await api('/api/appointments', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId: '<script>alert(1)</script>', slot: '2026-09-20T10:00' }) }); assert.equal(response.status, 422); assert.match((await response.json()).error, /valid book/); });
test('attempt 4: logged-out callers cannot reach an appointment endpoint', async () => { const response = await api('/api/appointments/apt-alice'); assert.equal(response.status, 401); assert.deepEqual(await response.json(), { error: 'Authentication required' }); });
test('attempt 5: a forged random session cookie is not accepted', async () => { const response = await api('/api/appointments/apt-alice', { headers: { cookie: 'session=admin-user-alice' } }); assert.equal(response.status, 401); assert.deepEqual(await response.json(), { error: 'Authentication required' }); });
test('attempt 6: Bob cannot access Alice appointment by changing the appointment id', async () => {
  const cookie = await signIn('bob@example.test', 'BobPass123!');

  const response = await api('/api/appointments/apt-alice', {
    headers: { cookie }
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: "You cannot access another customer's appointment"
  });
});

test('attempt 7: unexpected fields cannot be used during appointment creation', async () => {
  const cookie = await signIn('alice@example.test', 'AlicePass123!');

  const response = await api('/api/appointments', {
    method: 'POST',
    headers: {
      cookie,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      bookId: 'book-garden',
      slot: '2026-09-20T11:00',
      role: 'admin',
      isAdmin: true
    })
  });

  assert.equal(response.status, 400);
  assert.match(
    (await response.json()).error,
    /Only bookId and slot/
  );
});
