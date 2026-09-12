const http = require('node:http');
const { currentUser, login, requireUser, sendJson } = require('./auth');

const books = { 'book-quiet': 'Quiet: The Power of Introverts', 'book-ocean': 'The Sea Around Us', 'book-garden': 'The Secret Garden' };
const appointments = [
  { id: 'apt-alice', userId: 'user-alice', bookId: 'book-quiet', slot: '2026-09-15T10:00' },
  { id: 'apt-bob', userId: 'user-bob', bookId: 'book-ocean', slot: '2026-09-16T14:00' }
];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function html(response, status, content, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  response.end(content);
}

async function jsonBody(request) {
  let raw = '';
  for await (const chunk of request) raw += chunk;
  try { return JSON.parse(raw || '{}'); } catch { return null; }
}

function dashboard(user) {
  const mine = appointments.filter((appointment) => appointment.userId === user.id);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Papertrail Pickup</title><link rel="stylesheet" href="/styles.css"><body><header><a href="/dashboard">Papertrail</a><form method="post" action="/logout"><button>Sign out</button></form></header><main><p class="eyebrow">Pickup desk</p><h1>Hello, ${escapeHtml(user.name)}.</h1><p>Reserve a pickup time for your next book.</p><section><h2>Your appointments</h2>${mine.length ? `<ul>${mine.map((item) => `<li><strong>${escapeHtml(books[item.bookId])}</strong><span>${escapeHtml(item.slot)}</span></li>`).join('')}</ul>` : '<p>No pickups booked.</p>'}</section><section><h2>Book a pickup</h2><form id="appointment-form"><label>Book<select name="bookId">${Object.entries(books).map(([id, title]) => `<option value="${id}">${escapeHtml(title)}</option>`).join('')}</select></label><label>Time<input type="datetime-local" name="slot" required></label><button>Reserve pickup</button></form><p id="result" role="status"></p></section></main><script>document.querySelector('#appointment-form').addEventListener('submit',async(e)=>{e.preventDefault();const f=new FormData(e.target);const r=await fetch('/api/appointments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(f))});document.querySelector('#result').textContent=r.ok?'Pickup reserved. Refresh to view it.':'Unable to reserve pickup.'})</script></body></html>`;
}

function createApp() {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const user = currentUser(request);
    if (request.method === 'GET' && url.pathname === '/styles.css') return html(response, 200, require('node:fs').readFileSync(require('node:path').join(__dirname, '../public/styles.css')), { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    if (request.method === 'GET' && url.pathname === '/') { response.writeHead(303, { Location: user ? '/dashboard' : '/login' }); return response.end(); }
    if (request.method === 'GET' && url.pathname === '/login') return html(response, 200, '<!doctype html><link rel="stylesheet" href="/styles.css"><main><p class="eyebrow">Papertrail pickup</p><h1>Sign in</h1><form method="post" action="/login"><label>Email<input name="email" type="email" required></label><label>Password<input name="password" type="password" required></label><button>Sign in</button></form></main>');
    if (request.method === 'POST' && url.pathname === '/login') {
      let raw = ''; for await (const chunk of request) raw += chunk;
      const fields = new URLSearchParams(raw); const session = login(fields.get('email'), fields.get('password'));
      if (!session) return html(response, 401, '<h1>Invalid credentials</h1>');
      response.writeHead(303, { Location: '/dashboard', 'Set-Cookie': `session=${session.token}; HttpOnly; SameSite=Lax; Path=/` }); return response.end();
    }
    if (request.method === 'POST' && url.pathname === '/logout') { response.writeHead(303, { Location: '/login', 'Set-Cookie': 'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' }); return response.end(); }
    if (request.method === 'GET' && url.pathname === '/dashboard') return user ? html(response, 200, dashboard(user)) : html(response, 401, '<h1>Authentication required</h1>');
    const appointmentMatch = url.pathname.match(/^\/api\/appointments\/([a-z0-9-]+)$/);
    if (request.method === 'GET' && appointmentMatch) {
      if (!requireUser(response, user)) return;
      const appointment = appointments.find((item) => item.id === appointmentMatch[1]);
      if (!appointment) return sendJson(response, 404, { error: 'Appointment not found' });
      if (appointment.userId !== user.id) return sendJson(response, 403, { error: 'You cannot access another customer\'s appointment' });
      return sendJson(response, 200, appointment);
    }
    if (request.method === 'POST' && url.pathname === '/api/appointments') {
      if (!requireUser(response, user)) return;
      const input = await jsonBody(request);
      if (!input || Object.keys(input).some((key) => !['bookId', 'slot'].includes(key))) return sendJson(response, 400, { error: 'Only bookId and slot may be submitted' });
      if (typeof input.bookId !== 'string' || !books[input.bookId]) return sendJson(response, 422, { error: 'Choose a valid book' });
      if (typeof input.slot !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.slot)) return sendJson(response, 422, { error: 'Choose a valid pickup time' });
      const appointment = { id: `apt-${Math.random().toString(36).slice(2, 10)}`, userId: user.id, bookId: input.bookId, slot: input.slot };
      appointments.push(appointment);
      return sendJson(response, 201, appointment);
    }
    sendJson(response, 404, { error: 'Not found' });
  });
}

if (require.main === module) createApp().listen(3000, () => console.log('Pickup app running at http://localhost:3000'));
module.exports = { createApp };
