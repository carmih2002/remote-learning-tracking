import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* ===== FIREBASE ===== */
const firebaseConfig = {
  apiKey: "AIzaSyBfE6cEKvBc1-t-wgQn1ZhgEXZd58mSuWA",
  authDomain: "remote-learning-tracking.firebaseapp.com",
  projectId: "remote-learning-tracking",
  storageBucket: "remote-learning-tracking.firebasestorage.app",
  messagingSenderId: "665503380173",
  appId: "1:665503380173:web:d5a224a8279096e072ef84"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

/* ===== DATE HELPERS ===== */
function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDateHebrew(dateStr) {
  if (!dateStr) return '';
  const [y, m, day] = dateStr.split('-');
  return `${day}/${m}/${y}`;
}

/* ===== FIRESTORE HELPERS ===== */
async function getReportsForDate(dateStr) {
  try {
    const snap = await getDoc(doc(db, 'reports', dateStr));
    return snap.exists() ? (snap.data().entries || []) : [];
  } catch {
    return [];
  }
}

async function isNameSubmittedToday(name) {
  const list = await getReportsForDate(getTodayStr());
  return list.some(r => r.name.trim().toLowerCase() === name.trim().toLowerCase());
}

async function submitReport(name, text) {
  const today    = getTodayStr();
  const existing = await getReportsForDate(today);
  existing.push({
    name: name.trim(),
    text: text.trim(),
    time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  });
  await setDoc(doc(db, 'reports', today), { entries: existing });
  markDeviceSubmittedToday(name.trim());
}

/* ===== DEVICE LOCK (localStorage — per device only) ===== */
const DEVICE_KEY = 'device_submitted_v2';

function getDeviceData() {
  try { return JSON.parse(localStorage.getItem(DEVICE_KEY)); }
  catch { return null; }
}

function markDeviceSubmittedToday(name) {
  localStorage.setItem(DEVICE_KEY, JSON.stringify({ date: getTodayStr(), name }));
}

function clearDeviceData() {
  localStorage.removeItem(DEVICE_KEY);
}

/* ===== DOM REFS ===== */
const screens = {
  name:    document.getElementById('screen-name'),
  report:  document.getElementById('screen-report'),
  done:    document.getElementById('screen-done'),
  taken:   document.getElementById('screen-taken'),
  loading: document.getElementById('screen-loading'),
};

const nameInput     = document.getElementById('input-name');
const nameError     = document.getElementById('name-error');
const reportInput   = document.getElementById('input-report');
const reportError   = document.getElementById('report-error');
const displayName   = document.getElementById('display-name');
const doneDateEl    = document.getElementById('done-date');

const teacherBtn    = document.getElementById('teacher-btn');
const passwordModal = document.getElementById('password-modal');
const passwordInput = document.getElementById('password-input');
const passwordError = document.getElementById('password-error');
const btnConfirmPwd = document.getElementById('btn-confirm-password');
const btnCancelPwd  = document.getElementById('btn-cancel-password');

const teacherOverlay = document.getElementById('teacher-overlay');
const closePanel     = document.getElementById('close-panel');
const datePicker     = document.getElementById('date-picker');
const btnLoadDate    = document.getElementById('btn-load-date');
const teacherResults = document.getElementById('teacher-results');

/* ===== SCREEN MANAGEMENT ===== */
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

/* ===== INIT ===== */
async function init() {
  showScreen('loading');
  const deviceData = getDeviceData();
  if (deviceData && deviceData.date === getTodayStr()) {
    const reports     = await getReportsForDate(getTodayStr());
    const stillExists = reports.some(r => r.name.toLowerCase() === deviceData.name.toLowerCase());
    if (stillExists) {
      doneDateEl.textContent = `תאריך: ${formatDateHebrew(getTodayStr())}`;
      showScreen('done');
      return;
    }
    clearDeviceData();
  }
  showScreen('name');
}

/* ===== STUDENT FLOW ===== */
document.getElementById('form-name').addEventListener('submit', async function (e) {
  e.preventDefault();
  const name = nameInput.value.trim();

  if (!name)          { nameError.textContent = 'נא להזין שם'; return; }
  if (name.length < 2){ nameError.textContent = 'שם חייב להכיל לפחות 2 תווים'; return; }
  nameError.textContent = '';

  const btn = this.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'בודק...';

  if (await isNameSubmittedToday(name)) {
    btn.disabled = false; btn.textContent = 'המשך →';
    showScreen('taken');
    return;
  }

  btn.disabled = false; btn.textContent = 'המשך →';
  displayName.textContent = name;
  reportInput.value = '';
  reportError.textContent = '';
  showScreen('report');
});

document.getElementById('form-report').addEventListener('submit', async function (e) {
  e.preventDefault();
  const text = reportInput.value.trim();

  if (!text)           { reportError.textContent = 'נא למלא את הדיווח לפני השליחה'; return; }
  if (text.length < 5) { reportError.textContent = 'אנא כתוב דיווח מפורט יותר'; return; }
  reportError.textContent = '';

  const name = nameInput.value.trim();
  const btn  = this.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'שולח...';

  const deviceData = getDeviceData();
  if ((deviceData && deviceData.date === getTodayStr()) || await isNameSubmittedToday(name)) {
    btn.disabled = false; btn.textContent = 'שלח דיווח ✓';
    showScreen('taken');
    return;
  }

  await submitReport(name, text);
  doneDateEl.textContent = `תאריך: ${formatDateHebrew(getTodayStr())}`;
  showScreen('done');
});

document.getElementById('btn-back-to-name').addEventListener('click', () => {
  nameInput.value = '';
  nameError.textContent = '';
  showScreen('name');
});

/* ===== TEACHER BUTTON ===== */
teacherBtn.addEventListener('click', () => {
  passwordInput.value   = '';
  passwordError.textContent = '';
  passwordModal.classList.remove('hidden');
  setTimeout(() => passwordInput.focus(), 80);
});

btnCancelPwd.addEventListener('click', () => passwordModal.classList.add('hidden'));
passwordModal.addEventListener('click', e => { if (e.target === passwordModal) passwordModal.classList.add('hidden'); });
passwordInput.addEventListener('keydown', e => { if (e.key === 'Enter') btnConfirmPwd.click(); });

btnConfirmPwd.addEventListener('click', () => {
  if (passwordInput.value === '136969') {
    passwordModal.classList.add('hidden');
    openTeacherPanel();
  } else {
    passwordError.textContent = 'סיסמה שגויה. נסה שנית.';
    passwordInput.select();
  }
});

/* ===== TEACHER PANEL ===== */
function openTeacherPanel() {
  datePicker.value = getTodayStr();
  teacherOverlay.classList.remove('hidden');
  loadDateResults(getTodayStr());
}

closePanel.addEventListener('click', () => teacherOverlay.classList.add('hidden'));
teacherOverlay.addEventListener('click', e => { if (e.target === teacherOverlay) teacherOverlay.classList.add('hidden'); });
btnLoadDate.addEventListener('click', () => { if (datePicker.value) loadDateResults(datePicker.value); });
datePicker.addEventListener('keydown', e => { if (e.key === 'Enter') btnLoadDate.click(); });

// Event delegation: delete + search
teacherResults.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;
  btn.disabled = true; btn.textContent = '...';
  const dateStr = btn.dataset.date;
  const index   = parseInt(btn.dataset.index, 10);
  const reports = await getReportsForDate(dateStr);
  reports.splice(index, 1);
  await setDoc(doc(db, 'reports', dateStr), { entries: reports });
  loadDateResults(dateStr);
});

teacherResults.addEventListener('input', (e) => {
  if (e.target.id === 'search-input') filterReports(e.target.value);
});

async function loadDateResults(dateStr) {
  teacherResults.innerHTML = '<div class="empty-state loading-pulse">טוען דיווחים...</div>';
  const reports       = await getReportsForDate(dateStr);
  const formattedDate = formatDateHebrew(dateStr);

  if (reports.length === 0) {
    teacherResults.innerHTML = `<div class="no-reports">אין דיווחים עבור תאריך ${formattedDate}</div>`;
    return;
  }

  const cardsHTML = reports.map((r, i) => `
    <div class="report-card" data-name="${escapeHtml(r.name.toLowerCase())}">
      <div class="report-card-header">
        <div class="report-student-name">${escapeHtml(r.name)}</div>
        <button class="btn-delete" data-date="${dateStr}" data-index="${i}">מחק ✕</button>
      </div>
      <div class="report-text">${escapeHtml(r.text)}</div>
      <div class="report-time">⏰ ${r.time || ''}</div>
    </div>
  `).join('');

  teacherResults.innerHTML = `
    <div class="results-header">
      <div class="results-title">דיווחים לתאריך ${formattedDate}</div>
      <div class="results-count"><span id="visible-count">${reports.length}</span> תלמידים</div>
    </div>
    <div class="search-row">
      <input type="text" id="search-input" placeholder="🔍  חיפוש לפי שם תלמיד..." />
    </div>
    <div id="cards-container">${cardsHTML}</div>
  `;
}

function filterReports(query) {
  const q     = query.trim().toLowerCase();
  const cards = document.querySelectorAll('#cards-container .report-card');
  let visible = 0;
  cards.forEach(card => {
    const match = !q || card.dataset.name.includes(q);
    card.style.display = match ? '' : 'none';
    if (match) visible++;
  });
  const el = document.getElementById('visible-count');
  if (el) el.textContent = visible;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/* ===== START ===== */
init();
