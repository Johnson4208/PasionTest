/*
 * GitHub Pages compatibility layer.
 * The original application uses a Python /api backend. GitHub Pages is static,
 * so this file provides a browser-only demo backend while leaving the UI/components
 * and their styles untouched.
 */
const STATIC_MODE = true;
const SESSION_KEY = 'pasion.githubpages.session';
const USERS_KEY = 'pasion.githubpages.users';

function readUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch { return []; }
}
function writeUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
function currentUser() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
function json(data, status=200) {
  return new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json'}});
}
function demoUser() {
  return {id:'github-pages-demo', name:'Demo User', email:'demo@solvai.com', isAdmin:true};
}
function seed() {
  if (!readUsers().length) writeUsers([demoUser()]);
}
async function handle(url, options={}) {
  const path = new URL(url, window.location.origin).pathname;
  const method = (options.method || 'GET').toUpperCase();
  let body = {};
  try { body = options.body ? JSON.parse(options.body) : {}; } catch {}
  seed();

  if (path === '/api/session' && method === 'GET') {
    const user = currentUser();
    return json(user ? {authenticated:true, isAdmin:Boolean(user.isAdmin), user} : {authenticated:false});
  }

  if (path === '/api/login' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const users = readUsers();
    const found = users.find(u => u.email.toLowerCase() === email);
    // Static-hosting demo: preserve the original demo credentials and allow
    // locally-created accounts. No server-side authentication exists here.
    if ((email === 'demo@solvai.com' && body.password === 'SolvAI2024!') || found) {
      const user = found || demoUser();
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      return json({message:'You are signed in to PASION.', isAdmin:Boolean(user.isAdmin), user});
    }
    return json({message:'For the GitHub Pages demo, use demo@solvai.com / SolvAI2024!'}, 401);
  }

  if (path === '/api/register' && method === 'POST') {
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    if (!name || !email || String(body.password || '').length < 8) return json({message:'Please provide a name, email, and password of at least 8 characters.'},400);
    const users = readUsers();
    if (users.some(u => u.email.toLowerCase() === email)) return json({message:'An account with this email already exists.'},409);
    const user = {id:crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), name, email, isAdmin:false};
    users.push(user); writeUsers(users);
    return json({message:'Account created. Please sign in.'});
  }

  if (path === '/api/logout' && method === 'POST') {
    localStorage.removeItem(SESSION_KEY);
    return json({message:'Signed out.'});
  }

  if (path === '/api/change-password' && method === 'POST') {
    return json({message:'Password changes are not available on the static GitHub Pages demo. Use the full backend deployment for account security.'}, 400);
  }

  if (path === '/api/forgot-password' || path === '/api/reset-password') {
    return json({message:'Password recovery requires the full backend deployment.'}, 400);
  }

  if (path.startsWith('/api/admin/accounts')) {
    if (!currentUser()?.isAdmin) return json({message:'Administrator access is unavailable on this static demo.'},403);
    if (method === 'GET') return json({accounts:readUsers()});
    return json({message:'Account management requires the full backend deployment.'},400);
  }

  if (path.startsWith('/api/admin/documents')) {
    return json({documents:[], capabilities:{upload:false,download:false,extract:false}, message:'Document management requires the full backend deployment.'});
  }

  return json({message:'This feature requires the PASION backend.'},503);
}

if (STATIC_MODE && typeof window !== 'undefined') {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (url.includes('/api/')) return handle(url, init || {});
    return nativeFetch(input, init);
  };
}
