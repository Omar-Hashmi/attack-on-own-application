const crypto = require('node:crypto');

// Helper to hash passwords securely with a unique salt
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

// In-memory user store with pre-hashed passwords
const users = [
  { id: 'user-alice', email: 'alice@example.test', passwordHash: hashPassword('AlicePass123!'), name: 'Alice' },
  { id: 'user-bob', email: 'bob@example.test', passwordHash: hashPassword('BobPass123!'), name: 'Bob' }
];

const sessions = new Map();

function cookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => {
        const [key, ...val] = part.trim().split('=');
        return [key, val.join('=')];
      })
      .filter(([key, value]) => key && value)
  );
}

function verifyPassword(password, storedHash) {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  
  return keyBuffer.length === derivedKey.length && crypto.timingSafeEqual(keyBuffer, derivedKey);
}

function login(email, password) {
  const user = users.find((candidate) => candidate.email === email && verifyPassword(password, candidate.passwordHash));
  if (!user) return null;
  
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(token, user.id);
  
  // Exclude passwordHash from returned user object
  const { passwordHash, ...safeUser } = user;
  return { user: safeUser, token };
}

function currentUser(request) {
  const sessionToken = cookies(request.headers?.cookie).session;
  if (!sessionToken) return null;
  
  const id = sessions.get(sessionToken);
  const user = users.find((u) => u.id === id);
  if (!user) return null;
  
  const { passwordHash, ...safeUser } = user;
  return safeUser;
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
