const $ = id => document.getElementById(id);
const show = (id, on = true) => $(id).classList.toggle('hidden', !on);
function toast(t) { const e = $('toast'); e.textContent = t; show('toast'); clearTimeout(toast.t); toast.t = setTimeout(() => show('toast', false), 3500); }

/* ===== ACCOUNT (salvati nel browser) ===== */
let mode = 'login', user = null;
const getUsers = () => JSON.parse(localStorage.getItem('sh_users') || '{}');
const saveUser = () => { const u = getUsers(); u[user.name.toLowerCase()] = user; localStorage.setItem('sh_users', JSON.stringify(u)); };
const hash = async t => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map(b => b.toString(16).padStart(2, '0')).join('');

function setMode(m) {
  mode = m;
  $('tab-login').classList.toggle('active', m === 'login'); $('tab-reg').classList.toggle('active', m === 'reg');
  show('pass2', m === 'reg'); $('pass2').required = m === 'reg';
  $('submit').textContent = m === 'login' ? 'Accedi' : 'Crea account'; $('msg').textContent = '';
}
$('tab-login').onclick = () => setMode('login'); $('tab-reg').onclick = () => setMode('reg');
$('form').onsubmit = async e => {
  e.preventDefault();
  const n = $('user').value.trim(), p = $('pass').value, users = getUsers(), msg = $('msg'), k = n.toLowerCase();
  msg.className = 'msg';
  if (mode === 'reg') {
    if (users[k]) return msg.textContent = 'Nome utente già in uso.';
    if (p !== $('pass2').value) return msg.textContent = 'Le password non coincidono.';
    users[k] = { name: n, pw: await hash(p), elo: 800, w: 0, l: 0, d: 0 };
    localStorage.setItem('sh_users', JSON.stringify(users));
    setMode('login'); $('pass').value = $('pass2').value = '';
    msg.className = 'msg ok'; msg.textContent = 'Registrazione completata! Ora accedi.';
  } else {
    if (!users[k] || users[k].pw !== await hash(p)) return msg.textContent = 'Nome utente o password errati.';
    localStorage.setItem('sh_session', k); enter();
  }
};
$('logout').onclick = () => { localStorage.removeItem('sh_session'); location.href = location.pathname; };

function refreshStats() {
  $('me-name').textContent = user.name; $('me-elo').textContent = user.elo;
  ['elo', 'w', 'd', 'l'].forEach(k => $('s-' + k).textContent = user[k]);
}
function enter() {
  user = getUsers()[localStorage.getItem('sh_session')];
  if (!user) return;
  show('auth', false); show('app'); refreshStats();
  const g = new URLSearchParams(location.search).get('g');
  if (g) joinGame(g);
}

/* ===== PARTITA ===== */
const GL = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
let G = null;

function parseTC(s) { const [m, i] = s.split('+').map(Number); return { ms: m * 60000, inc: i * 1000 }; }
const fmt = ms => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const newG = (mode, tc) => ({ mode, tc, chess: new Chess(), me: 'w', names: { w: '', b: '' }, clock: { w: 0, b: 0 }, inc: 0, last: 0, over: true, sel: null, lm: null, flip: false, conn: null, peer: null });

function startGame(me, tc, oppName) {
  const t = parseTC(tc);
  Object.assign(G, { chess: new Chess(), me, tc, clock: { w: t.ms, b: t.ms }, inc: t.inc, last: Date.now(), over: false, sel: null, lm: null, flip: me === 'b' });
  G.names = { w: me === 'w' ? user.name : oppName, b: me === 'b' ? user.name : oppName };
  if (G.mode === 'local') G.names = { w: 'Bianco', b: 'Nero' };
  show('wait', false); show('modal', false); $('status').textContent = 'Partita in corso';
  render();
}
function openGame() { show('lobby', false); show('game'); }
function leave() {
  if (G && G.peer) G.peer.destroy();
  G = null; history.replaceState(null, '', location.pathname);
  show('game', false); show('modal', false); show('lobby'); refreshStats();
}

function render() {
  const c = G.chess, files = 'abcdefgh', ranks = [8, 7, 6, 5, 4, 3, 2, 1];
  const fs = G.flip ? [...files].reverse() : [...files], rs = G.flip ? [...ranks].reverse() : ranks;
  let targets = {};
  if (G.sel) c.moves({ square: G.sel, verbose: true }).forEach(m => targets[m.to] = m.captured || m.flags.includes('e'));
  let king = null;
  if (c.in_check()) c.board().flat().forEach(p => { if (p && p.type === 'k' && p.color === c.turn()) king = p.square; });
  let h = '';
  rs.forEach((r, ri) => fs.forEach((f, fi) => {
    const sq = f + r, p = c.get(sq), light = (files.indexOf(f) + r) % 2 === 1;
    let cl = 'sq ' + (light ? 'l' : 'd');
    if (G.lm && (G.lm.from === sq || G.lm.to === sq)) cl += ' lm';
    if (G.sel === sq) cl += ' sel';
    if (sq === king) cl += ' chk';
    if (sq in targets) cl += targets[sq] ? ' cap' : ' mv';
    h += `<div class="${cl}" data-sq="${sq}">` +
      (fi === 0 ? `<span class="co r">${r}</span>` : '') + (ri === 7 ? `<span class="co f">${f}</span>` : '') +
      (p ? `<span class="p ${p.color}">${GL[p.type]}\uFE0E</span>` : '') + '</div>';
  }));
  $('board').innerHTML = h;
  const bot = G.flip ? 'b' : 'w', top = bot === 'w' ? 'b' : 'w';
  $('n-top').textContent = G.names[top] || '...'; $('n-bot').textContent = G.names[bot] || '...';
  const hist = c.history(); let mv = '';
  for (let i = 0; i < hist.length; i += 2) mv += `<div class="mr"><i>${i / 2 + 1}.</i><span>${hist[i]}</span><span>${hist[i + 1] || ''}</span></div>`;
  $('moves').innerHTML = mv; $('moves').scrollTop = 1e6;
  clocks();
}
function clocks() {
  const bot = G.flip ? 'b' : 'w', top = bot === 'w' ? 'b' : 'w', t = G.chess.turn();
  $('clk-top').textContent = fmt(G.clock[top]); $('clk-bot').textContent = fmt(G.clock[bot]);
  $('bar-top').classList.toggle('turn', !G.over && t === top); $('bar-bot').classList.toggle('turn', !G.over && t === bot);
}
setInterval(() => {
  if (!G || G.over) return;
  const now = Date.now();
  if (G.chess.history().length >= 2) {
    const s = G.chess.turn(); G.clock[s] -= now - G.last;
    if (G.clock[s] <= 0) { G.clock[s] = 0; if (G.mode === 'local' || s === G.me) finish(s === 'w' ? 'b' : 'w', 'Tempo scaduto', true); }
  }
  G.last = now; clocks();
}, 200);

$('board').onclick = e => {
  const el = e.target.closest('.sq'); if (!el || !G || G.over) return;
  const sq = el.dataset.sq, c = G.chess, p = c.get(sq);
  if (G.mode === 'online' && c.turn() !== G.me) return;
  if (G.sel && c.moves({ square: G.sel, verbose: true }).some(m => m.to === sq)) {
    const m = c.get(G.sel), promo = m.type === 'p' && (sq[1] === '8' || sq[1] === '1') ? 'q' : undefined;
    return doMove(G.sel, sq, promo, true);
  }
  G.sel = p && p.color === c.turn() && (G.mode === 'local' || p.color === G.me) && G.sel !== sq ? sq : null;
  render();
};
function doMove(from, to, promotion, send) {
  const c = G.chess, mover = c.turn(), mv = c.move({ from, to, promotion });
  if (!mv) return;
  if (c.history().length > 2) G.clock[mover] += G.inc;
  G.lm = { from, to }; G.sel = null; G.last = Date.now();
  if (send && G.conn) G.conn.send({ t: 'move', from, to, p: promotion });
  render();
  if (c.in_checkmate()) finish(mover, 'Scacco matto', false);
  else if (c.in_stalemate()) finish('d', 'Stallo', false);
  else if (c.insufficient_material()) finish('d', 'Materiale insufficiente', false);
  else if (c.in_threefold_repetition()) finish('d', 'Triplice ripetizione', false);
  else if (c.in_draw()) finish('d', 'Regola delle 50 mosse', false);
}
function finish(r, why, send) {
  if (G.over) return;
  G.over = true; clocks();
  if (send && G.conn) G.conn.send({ t: 'over', r, why });
  let title;
  if (r === 'd') title = 'Patta';
  else if (G.mode === 'local') title = 'Vince il ' + (r === 'w' ? 'Bianco' : 'Nero');
  else title = r === G.me ? 'Hai vinto! 🎉' : 'Hai perso';
  if (G.mode === 'online') {
    if (r === 'd') user.d++; else if (r === G.me) { user.w++; user.elo += 8; } else { user.l++; user.elo = Math.max(100, user.elo - 8); }
    saveUser(); refreshStats();
  }
  $('status').textContent = title + ' · ' + why;
  $('m-title').textContent = title; $('m-why').textContent = why;
  show('m-rematch', G.mode === 'local' || !!G.conn); show('modal');
}

/* ===== MULTIGIOCATORE (WebRTC con PeerJS) ===== */
const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';
const rnd = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');

function createGame() {
  G = newG('online', $('tc').value); openGame(); render();
  $('status').textContent = 'In attesa di un amico…'; show('wait');
  const open = () => {
    const code = rnd(), peer = new Peer('shk-' + code);
    G.peer = peer;
    peer.on('open', () => {
      const url = location.origin + location.pathname + '?g=' + code;
      $('link').value = url; $('gcode').textContent = code;
    });
    peer.on('connection', c => {
      if (G.conn) return c.close();
      G.conn = c; c.on('data', onData); c.on('close', onClose);
    });
    peer.on('error', e => { if (e.type === 'unavailable-id') open(); else toast('Errore di connessione: ' + e.type); });
  };
  open();
}
function joinGame(raw) {
  let code = raw.trim(); try { code = new URL(code).searchParams.get('g') || code; } catch (e) {}
  code = code.toLowerCase();
  if (!/^[a-z0-9]{5}$/.test(code)) return toast('Codice non valido.');
  if (G && G.peer) G.peer.destroy();
  G = newG('online', '10+0'); openGame(); render(); $('status').textContent = 'Connessione in corso…';
  const peer = new Peer(); G.peer = peer;
  peer.on('open', () => {
    const c = peer.connect('shk-' + code, { reliable: true });
    c.on('open', () => { G.conn = c; c.send({ t: 'join', name: user.name }); });
    c.on('data', onData); c.on('close', onClose);
  });
  peer.on('error', e => { toast(e.type === 'peer-unavailable' ? 'Partita non trovata o già chiusa.' : 'Errore di connessione: ' + e.type); if (e.type === 'peer-unavailable') leave(); });
}
function onClose() { if (G && !G.over) { toast("L'avversario si è disconnesso."); finish(G.me, 'Avversario disconnesso', false); } }
function onData(m) {
  if (!G) return;
  switch (m.t) {
    case 'join': { // sono l'host
      const hc = Math.random() < .5 ? 'w' : 'b';
      startGame(hc, G.tc, m.name);
      G.conn.send({ t: 'start', color: hc === 'w' ? 'b' : 'w', tc: G.tc, name: user.name }); break; }
    case 'start': startGame(m.color, m.tc, m.name); break;
    case 'move': doMove(m.from, m.to, m.p, false); break;
    case 'resign': finish(G.me, 'Abbandono', false); break;
    case 'over': finish(m.r, m.why, false); break;
    case 'draw': if (confirm("L'avversario propone patta. Accetti?")) { G.conn.send({ t: 'drawok' }); finish('d', 'Patta concordata', false); } break;
    case 'drawok': finish('d', 'Patta concordata', false); break;
    case 'rematch': if (confirm("L'avversario chiede la rivincita. Accetti?")) { G.conn.send({ t: 'rematchok' }); startGame(G.me === 'w' ? 'b' : 'w', G.tc, G.names[G.me === 'w' ? 'b' : 'w']); } break;
    case 'rematchok': startGame(G.me === 'w' ? 'b' : 'w', G.tc, G.names[G.me === 'w' ? 'b' : 'w']); break;
  }
}

/* ===== PULSANTI ===== */
$('create').onclick = createGame;
$('join').onclick = () => joinGame($('code').value);
$('local').onclick = () => { G = newG('local', $('tc').value); openGame(); startGame('w', $('tc').value, ''); };
$('copy').onclick = () => { navigator.clipboard.writeText($('link').value).then(() => toast('Link copiato!')); };
$('flip').onclick = () => { if (G) { G.flip = !G.flip; render(); } };
$('leave').onclick = () => { if (!G.over && G.mode === 'online' && G.conn && !confirm('Uscire? Perderai la partita.')) return; if (!G.over && G.conn) G.conn.send({ t: 'resign' }), (G.over = true, G.mode === 'online' && (user.l++, user.elo = Math.max(100, user.elo - 8), saveUser())); leave(); };
$('resign').onclick = () => { if (!G.over && confirm('Vuoi abbandonare la partita?')) finish(G.mode === 'local' ? (G.chess.turn() === 'w' ? 'b' : 'w') : (G.me === 'w' ? 'b' : 'w'), 'Abbandono', true); };
$('draw').onclick = () => { if (G.over) return; if (G.mode === 'local') finish('d', 'Patta concordata', false); else { G.conn.send({ t: 'draw' }); toast('Proposta di patta inviata.'); } };
$('m-close').onclick = leave;
$('m-rematch').onclick = () => {
  if (G.mode === 'local') startGame('w', G.tc, '');
  else { G.conn.send({ t: 'rematch' }); show('modal', false); toast('Richiesta di rivincita inviata.'); }
};
$('nav-play').onclick = () => { if (G && (G.over || !G.conn)) leave(); };

if (localStorage.getItem('sh_session')) enter();
