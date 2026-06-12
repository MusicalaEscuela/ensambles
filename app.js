import { firebaseSettings } from './firebase-config.js';

const COLLECTIONS = ['bands', 'students', 'songs', 'logs'];
const state = { bands: [], students: [], songs: [], logs: [], backend: null };

const $ = (id) => document.getElementById(id);
const uid = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
const bandName = (id) => state.bands.find(b => b.id === id)?.name || 'Sin banda';
const slug = (name = '') => name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

class LocalBackend {
  constructor() { this.prefix = 'musicala_ensambles_'; }
  async list(collection) { return JSON.parse(localStorage.getItem(this.prefix + collection) || '[]'); }
  async save(collection, item) {
    const items = await this.list(collection);
    const index = items.findIndex(x => x.id === item.id);
    const payload = { ...item, updatedAt: new Date().toISOString(), createdAt: item.createdAt || new Date().toISOString() };
    if (index >= 0) items[index] = payload; else items.unshift(payload);
    localStorage.setItem(this.prefix + collection, JSON.stringify(items));
    return payload;
  }
  async remove(collection, id) {
    const items = (await this.list(collection)).filter(x => x.id !== id);
    localStorage.setItem(this.prefix + collection, JSON.stringify(items));
  }
}

class FirebaseBackend {
  constructor(db, api) { this.db = db; this.api = api; }
  async list(collectionName) {
    const { collection, getDocs, query, orderBy } = this.api;
    const snap = await getDocs(query(collection(this.db, collectionName), orderBy('updatedAt', 'desc')));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
  async save(collectionName, item) {
    const { doc, setDoc, serverTimestamp } = this.api;
    const id = item.id || uid();
    const payload = { ...item, id, updatedAt: serverTimestamp(), createdAt: item.createdAt || serverTimestamp() };
    await setDoc(doc(this.db, collectionName, id), payload, { merge: true });
    return { ...item, id, updatedAt: new Date().toISOString() };
  }
  async remove(collectionName, id) {
    const { doc, deleteDoc } = this.api;
    await deleteDoc(doc(this.db, collectionName, id));
  }
}

function setMode(online, text) {
  $('modeTitle').textContent = online ? 'Guardado en la nube' : 'Guardado en este equipo';
  $('modeText').textContent = text;
  document.querySelector('.dot').classList.toggle('online', online);
}

async function createBackend() {
  const hasConfig = firebaseSettings.useFirebase && firebaseSettings.config.projectId;
  if (!hasConfig) { setMode(false, 'La información solo se ve en este computador.'); return new LocalBackend(); }
  try {
    const appMod = await import('https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js');
    const fsMod = await import('https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js');
    const app = appMod.initializeApp(firebaseSettings.config);
    const db = fsMod.getFirestore(app);
    setMode(true, 'Todo el equipo ve la misma información.');
    return new FirebaseBackend(db, fsMod);
  } catch (err) {
    console.error(err);
    setMode(false, 'No hubo conexión. Se guarda en este equipo por ahora.');
    return new LocalBackend();
  }
}

async function loadAll() {
  for (const col of COLLECTIONS) state[col] = await state.backend.list(col);
  render();
}

function setView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === view));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  const names = { dashboard: 'Panel general', bands: 'Bandas', students: 'Estudiantes', songs: 'Canciones', logs: 'Bitácoras' };
  $('viewTitle').textContent = names[view];
}

document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));

function fillBandSelects() {
  const options = ['<option value="">Sin asignar</option>', ...state.bands.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`)].join('');
  ['studentBand','songBand','logBand'].forEach(id => $(id).innerHTML = options);
  const current = $('logFilter').value;
  $('logFilter').innerHTML = ['<option value="">Todas las bandas</option>', ...state.bands.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`)].join('');
  $('logFilter').value = current;
}

function bandLogo(band, size = 'small') {
  const file = `./logos/${slug(band.name)}.png`;
  return `<span class="band-logo ${size}"><img src="${file}" alt="" onerror="this.replaceWith(document.createTextNode('${escapeHtml((band.name || '?')[0].toUpperCase())}'))"></span>`;
}

function render() {
  fillBandSelects();
  $('statBands').textContent = state.bands.length;
  $('statStudents').textContent = state.students.length;
  $('statSongs').textContent = state.songs.length;
  $('statLogs').textContent = state.logs.length;
  $('bandsCount').textContent = `${state.bands.length} bandas`;
  $('studentsCount').textContent = `${state.students.length} estudiantes`;
  $('songsCount').textContent = `${state.songs.length} canciones`;
  $('logsCount').textContent = `${state.logs.length} bitácoras`;
  renderBands(); renderStudents(); renderSongs(); renderLogs(); renderDashboard();
}

function renderDashboard() {
  $('bandOverview').innerHTML = state.bands.map(b => {
    const members = state.students.filter(s => s.bandId === b.id).length;
    const songs = state.songs.filter(s => s.bandId === b.id).length;
    return card(b.name, `${b.level || 'Sin nivel'} · ${members} integrantes · ${songs} canciones`, b.goal || 'Todavía sin meta definida.', 'Banda', bandLogo(b));
  }).join('') || empty('Aún no hay bandas. Crea la primera en la sección Bandas.');

  const recent = [...state.logs].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,5);
  $('recentLogs').innerHTML = recent.map(l => card(bandName(l.bandId), formatDay(l.date), l.work || '', 'Bitácora')).join('') || empty('Aún no hay bitácoras. Después de cada ensayo, registra cómo les fue.');
}

function renderBands() {
  $('bandsList').innerHTML = state.bands.map(b => item({
    title: b.name,
    meta: `${b.level || 'Sin nivel'} · ${b.teacher || 'Sin docente asignado'} · ${b.schedule || 'Sin horario'}`,
    body: escapeHtml(b.goal || 'Sin meta definida.'),
    tag: 'Banda', logo: bandLogo(b),
    edit: `editBand('${b.id}')`, del: `deleteItem('bands','${b.id}')`
  })).join('') || empty('Crea la primera banda.');
}
function renderStudents() {
  $('studentsList').innerHTML = state.students.map(s => item({
    title: s.name,
    meta: `${s.instrument || 'Sin instrumento'} · ${bandName(s.bandId)}`,
    body: escapeHtml(s.notes || 'Sin observaciones.'), tag: 'Estudiante', edit: `editStudent('${s.id}')`, del: `deleteItem('students','${s.id}')`
  })).join('') || empty('Agrega el primer integrante.');
}
function renderSongs() {
  $('songsList').innerHTML = state.songs.map(s => item({
    title: s.title,
    meta: `${s.artist || 'Sin referencia'} · ${bandName(s.bandId)}`,
    body: escapeHtml(s.notes || 'Sin apuntes.'), tag: s.status || 'Canción', edit: `editSong('${s.id}')`, del: `deleteItem('songs','${s.id}')`
  })).join('') || empty('Agrega la primera canción del repertorio.');
}
function renderLogs() {
  const filter = $('logFilter').value;
  const logs = state.logs.filter(l => !filter || l.bandId === filter).sort((a,b) => new Date(b.date) - new Date(a.date));
  $('logsList').innerHTML = logs.map(l => item({
    title: bandName(l.bandId),
    meta: formatDay(l.date),
    body: `<strong>Trabajamos:</strong> ${escapeHtml(l.work || '')}${l.wins ? '<br><strong>Logros:</strong> ' + escapeHtml(l.wins) : ''}${l.tasks ? '<br><strong>Tareas:</strong> ' + escapeHtml(l.tasks) : ''}`,
    tag: 'Bitácora', edit: `editLog('${l.id}')`, del: `deleteItem('logs','${l.id}')`
  })).join('') || empty('Aún no hay bitácoras para mostrar.');
}

function item({ title, meta, body, tag, edit, del, logo = '' }) {
  return `<article class="item"><div class="item-top"><div class="item-id">${logo}<div><h4>${escapeHtml(title)}</h4><p>${escapeHtml(meta)}</p></div></div><span class="pill">${escapeHtml(tag)}</span></div><p>${body}</p><div class="actions"><button class="ghost" onclick="${edit}">Editar</button><button class="ghost danger" onclick="${del}">Eliminar</button></div></article>`;
}
function card(title, meta, body, tag, logo = '') { return `<article class="item"><div class="item-top"><div class="item-id">${logo}<div><h4>${escapeHtml(title)}</h4><p>${escapeHtml(meta)}</p></div></div><span class="pill">${escapeHtml(tag)}</span></div><p>${escapeHtml(body)}</p></article>`; }
function empty(text) { return `<div class="item"><p>${text}</p></div>`; }
function escapeHtml(value='') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function formatDate(date) { return date ? new Date(date).toLocaleString('es-CO', { dateStyle:'medium', timeStyle:'short' }) : 'Sin fecha'; }
function formatDay(date) { return date ? new Date(date + 'T12:00').toLocaleDateString('es-CO', { dateStyle:'full' }) : 'Sin fecha'; }

async function save(collection, data) { await state.backend.save(collection, { id: data.id || uid(), ...data }); await loadAll(); }

$('bandForm').addEventListener('submit', async e => { e.preventDefault(); await save('bands', { id:$('bandId').value, name:$('bandName').value, level:$('bandLevel').value, teacher:$('bandTeacher').value, schedule:$('bandSchedule').value, goal:$('bandGoal').value }); e.target.reset(); $('bandId').value=''; });
$('studentForm').addEventListener('submit', async e => { e.preventDefault(); await save('students', { id:$('studentId').value, name:$('studentName').value, instrument:$('studentInstrument').value, bandId:$('studentBand').value, notes:$('studentNotes').value }); e.target.reset(); $('studentId').value=''; });
$('songForm').addEventListener('submit', async e => { e.preventDefault(); await save('songs', { id:$('songId').value, title:$('songTitle').value, artist:$('songArtist').value, bandId:$('songBand').value, status:$('songStatus').value, notes:$('songNotes').value }); e.target.reset(); $('songId').value=''; });

$('logForm').addEventListener('submit', async e => { e.preventDefault(); await save('logs', { id:$('logId').value, bandId:$('logBand').value, date:$('logDate').value, work:$('logWork').value, wins:$('logWins').value, tasks:$('logTasks').value }); e.target.reset(); $('logId').value=''; });
$('logFilter').addEventListener('change', renderLogs);

window.deleteItem = async (collection, id) => { if (!confirm('¿Eliminar este registro?')) return; await state.backend.remove(collection, id); await loadAll(); };
window.editBand = id => { const b=state.bands.find(x=>x.id===id); $('bandId').value=b.id; $('bandName').value=b.name||''; $('bandLevel').value=b.level||'Inicial'; $('bandTeacher').value=b.teacher||''; $('bandSchedule').value=b.schedule||''; $('bandGoal').value=b.goal||''; setView('bands'); };
window.editStudent = id => { const s=state.students.find(x=>x.id===id); $('studentId').value=s.id; $('studentName').value=s.name||''; $('studentInstrument').value=s.instrument||''; $('studentBand').value=s.bandId||''; $('studentNotes').value=s.notes||''; setView('students'); };
window.editSong = id => { const s=state.songs.find(x=>x.id===id); $('songId').value=s.id; $('songTitle').value=s.title||''; $('songArtist').value=s.artist||''; $('songBand').value=s.bandId||''; $('songStatus').value=s.status||'Propuesta'; $('songNotes').value=s.notes||''; setView('songs'); };
window.editLog = id => { const l=state.logs.find(x=>x.id===id); $('logId').value=l.id; $('logBand').value=l.bandId||''; $('logDate').value=l.date||''; $('logWork').value=l.work||''; $('logWins').value=l.wins||''; $('logTasks').value=l.tasks||''; setView('logs'); };

(async function init(){ state.backend = await createBackend(); await loadAll(); })();
