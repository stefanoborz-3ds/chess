/* ===== ACCESSO (dati salvati nel browser con localStorage) ===== */
const $ = id => document.getElementById(id);
let mode = 'login';
const getUsers = () => JSON.parse(localStorage.getItem('sh_users') || '{}');
const hash = async t => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))]
  .map(b => b.toString(16).padStart(2, '0')).join('');

function setMode(m) {
  mode = m;
  $('tab-login').classList.toggle('active', m === 'login');
  $('tab-reg').classList.toggle('active', m === 'reg');
  $('pass2').classList.toggle('hidden', m === 'login');
  $('pass2').required = m === 'reg';
  $('submit').textContent = m === 'login' ? 'Accedi' : 'Crea account';
  $('msg').textContent = '';
}
$('tab-login').onclick = () => setMode('login');
$('tab-reg').onclick = () => setMode('reg');

$('form').onsubmit = async e => {
  e.preventDefault();
  const u = $('user').value.trim(), p = $('pass').value, users = getUsers(), msg = $('msg');
  msg.className = 'msg';
  if (mode === 'reg') {
    if (users[u.toLowerCase()]) return msg.textContent = 'Nome utente già in uso.';
    if (p !== $('pass2').value) return msg.textContent = 'Le password non coincidono.';
    users[u.toLowerCase()] = { name: u, pw: await hash(p), games: 0 };
    localStorage.setItem('sh_users', JSON.stringify(users));
    setMode('login'); $('pass').value = ''; $('pass2').value = '';
    msg.className = 'msg ok'; msg.textContent = 'Registrazione completata! Ora accedi.';
  } else {
    const usr = users[u.toLowerCase()];
    if (!usr || usr.pw !== await hash(p)) return msg.textContent = 'Nome utente o password errati.';
    localStorage.setItem('sh_session', usr.name.toLowerCase());
    start();
  }
};
$('logout').onclick = () => { localStorage.removeItem('sh_session'); location.reload(); };

function start() {
  const users = getUsers(), usr = users[localStorage.getItem('sh_session')];
  if (!usr) return;
  $('auth').classList.add('hidden'); $('app').classList.remove('hidden');
  $('welcome').textContent = $('me').textContent = usr.name;
  $('games').textContent = usr.games;
  newGame();
}

/* ===== SCACCHIERA (movimento libero, senza controllo delle regole) ===== */
const START = ['rnbqkbnr', 'pppppppp', '', '', '', '', 'PPPPPPPP', 'RNBQKBNR'];
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
let grid, sel = null, white = true;

function newGame() {
  grid = START.map(r => (r || '        ').split(''));
  sel = null; white = true; draw();
}
function draw() {
  const b = $('board'); b.innerHTML = '';
  grid.forEach((row, r) => row.forEach((p, c) => {
    const d = document.createElement('div');
    d.className = 'sq ' + ((r + c) % 2 ? 'd' : 'l') + (sel && sel[0] === r && sel[1] === c ? ' sel' : '');
    if (p !== ' ') {
      d.classList.add(p === p.toUpperCase() ? 'w' : 'b');
      d.textContent = GLYPH[p.toLowerCase()];
    }
    if (c === 0) d.innerHTML += `<small>${8 - r}</small>`;
    d.onclick = () => click(r, c);
    b.appendChild(d);
  }));
  $('turn').textContent = white ? 'Tocca al Bianco' : 'Tocca al Nero';
}
function click(r, c) {
  const p = grid[r][c];
  if (!sel) {
    if (p !== ' ' && (p === p.toUpperCase()) === white) sel = [r, c];
  } else {
    const [sr, sc] = sel, m = grid[sr][sc];
    if (sr === r && sc === c) sel = null;
    else if (p !== ' ' && (p === p.toUpperCase()) === white) sel = [r, c];
    else {
      grid[r][c] = (m === 'P' && r === 0) ? 'Q' : (m === 'p' && r === 7) ? 'q' : m;
      grid[sr][sc] = ' '; sel = null; white = !white;
    }
  }
  draw();
}
$('reset').onclick = () => {
  const users = getUsers(), k = localStorage.getItem('sh_session');
  users[k].games++; localStorage.setItem('sh_users', JSON.stringify(users));
  $('games').textContent = users[k].games; newGame();
};
start();
