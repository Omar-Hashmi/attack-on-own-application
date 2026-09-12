const crypto = require('node:crypto');

const users = [
  { id: 'user-alice', email: 'alice@example.test', password: 'AlicePass123!', name: 'Alice' },
  { id: 'user-bob', email: 'bob@example.test', password: 'BobPass123!', name: 'Bob' }
];
const sessions = new Map();

function cookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => part.trim().split('=')).filter(([key, value]) => key && value));
}

function login(email, password) {
  const user = users.find((candidate) => candidate.email === email && secureEqual(candidate.password, password));
  if (!user) return null;
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(token, user.id);
  return { user, token };
}

function currentUser(request) {
  const id = sessions.get(cookies(request.headers.cookie).session);
  return users.find((user) => user.id === id) || null;
}

function secureEqual(left, right) {
  const a = Buffer.from(left || '');
  const b = Buffer.from(right || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireUser(response, user) {
  if (user) return true;
  sendJson(response, 401, { error: 'Authentication required' });
  return false;
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
}

module.exports = { currentUser, login, requireUser, sendJson };
