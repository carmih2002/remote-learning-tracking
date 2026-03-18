import { initializeApp }                                          from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot }         from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getMessaging, getToken, onMessage }                      from "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js";

/* ===== FIREBASE CONFIG ===== */
const firebaseConfig = {
  apiKey:            "AIzaSyBfE6cEKvBc1-t-wgQn1ZhgEXZd58mSuWA",
  authDomain:        "remote-learning-tracking.firebaseapp.com",
  projectId:         "remote-learning-tracking",
  storageBucket:     "remote-learning-tracking.firebasestorage.app",
  messagingSenderId: "665503380173",
  appId:             "1:665503380173:web:d5a224a8279096e072ef84"
};

// ⚠️  Replace with your VAPID key from:
//     Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
const VAPID_KEY = 'YOUR_VAPID_KEY_HERE';

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

/* ===== DEVICE ID =====
 * Each browser/device gets a permanent random UUID stored in localStorage.
 * This replaces name-based "already submitted" checks.
 */
const DEVICE_ID_KEY = 'device_id_v1';

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/* ===== DATE HELPERS ===== */
function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

/** Check whether the current device has already submitted today (Firestore). */
async function isDeviceSubmittedToday() {
  const deviceId = getDeviceId();
  const list     = await getReportsForDate(getTodayStr());
  return list.some(r => r.deviceId === deviceId);
}

/** Submit a new report. Every entry now includes deviceId and empty reply/token fields. */
async function submitReport(name, text, attendedZoom) {
  const today    = getTodayStr();
  const existing = await getReportsForDate(today);
  existing.push({
    deviceId:       getDeviceId(),
    name:           name.trim(),
    text:           text.trim(),
    attendedZoom,
    time:           new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
    teacherReply:   null,
    teacherReplyAt: null,
    deviceToken:    null,
  });
  await setDoc(doc(db, 'reports', today), { entries: existing });
  markDeviceSubmittedToday(name.trim());
}

/** Write a teacher reply to a specific entry in the Firestore document. */
async function saveTeacherReply(dateStr, index, replyText) {
  const reports = await getReportsForDate(dateStr);
  if (!reports[index]) return;
  reports[index].teacherReply   = replyText;
  reports[index].teacherReplyAt = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  await setDoc(doc(db, 'reports', dateStr), { entries: reports });
}

/** Store the FCM token in this device's report entry for the Cloud Function to use. */
async function updateDeviceToken(token) {
  const today    = getTodayStr();
  const reports  = await getReportsForDate(today);
  const deviceId = getDeviceId();
  const idx      = reports.findIndex(r => r.deviceId === deviceId);
  if (idx !== -1 && reports[idx].deviceToken !== token) {
    reports[idx].deviceToken = token;
    await setDoc(doc(db, 'reports', today), { entries: reports });
  }
}

/* ===== DEVICE LOCK (localStorage — quick check before Firestore round-trip) ===== */
// Using v3 key to avoid collisions with the old name-based v2 data.
const DEVICE_KEY = 'device_submitted_v3';

function getDeviceData() {
  try { return JSON.parse(localStorage.getItem(DEVICE_KEY)); }
  catch { return null; }
}

function markDeviceSubmittedToday(name) {
  localStorage.setItem(DEVICE_KEY, JSON.stringify({
    date:     getTodayStr(),
    name,
    deviceId: getDeviceId(),
  }));
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

const nameInput    = document.getElementById('input-name');
const nameError    = document.getElementById('name-error');
const reportInput  = document.getElementById('input-report');
const reportError  = document.getElementById('report-error');
const zoomError    = document.getElementById('zoom-error');
const displayName  = document.getElementById('display-name');
const doneDateEl   = document.getElementById('done-date');

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

const toastEl = document.getElementById('toast');

/* ===== SCREEN MANAGEMENT ===== */
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

/* ===== TOAST ===== */
let toastTimer = null;

function showToast(message, duration = 4500) {
  if (!toastEl) return;
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.classList.remove('hidden', 'toast-hide');
  toastEl.classList.add('toast-show');
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('toast-show');
    toastEl.classList.add('toast-hide');
    setTimeout(() => toastEl.classList.add('hidden'), 300);
  }, duration);
}

/* ===== TEACHER REPLY UI (done screen) ===== */
function updateReplyUI(replyText, replyTime) {
  const section = document.getElementById('teacher-reply-section');
  const textEl  = document.getElementById('teacher-reply-text');
  const timeEl  = document.getElementById('teacher-reply-time');
  if (!section) return;

  if (replyText) {
    textEl.textContent = replyText;
    timeEl.textContent = replyTime ? `⏰ ${replyTime}` : '';
    section.classList.remove('hidden');
  } else {
    section.classList.add('hidden');
  }
}

/* ===== REAL-TIME REPLY LISTENER =====
 * Listens for changes to today's Firestore document and updates the UI
 * if the teacher has added or changed a reply for this device.
 */
let unsubscribeSnapshot = null;

function startReplyListener(initialReply) {
  if (unsubscribeSnapshot) unsubscribeSnapshot();

  const deviceId   = getDeviceId();
  const today      = getTodayStr();
  let   knownReply = initialReply ?? null;
  let   firstCall  = true; // first snapshot fires immediately — don't toast for existing reply

  unsubscribeSnapshot = onSnapshot(doc(db, 'reports', today), (snap) => {
    if (!snap.exists()) return;

    const entries = snap.data().entries || [];
    const myEntry = entries.find(r => r.deviceId === deviceId);
    if (!myEntry) return;

    const currentReply = myEntry.teacherReply || null;

    // Always keep the UI up-to-date
    updateReplyUI(currentReply, myEntry.teacherReplyAt);

    // Show toast only when a new/changed reply arrives after page load
    if (!firstCall && currentReply && currentReply !== knownReply) {
      showToast('💬 המורה השיב לדיווח שלך!');
    }

    firstCall  = false;
    knownReply = currentReply;
  });
}

function stopReplyListener() {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }
}

/* ===== FCM PUSH NOTIFICATIONS =====
 * Called after a successful report submission (user-initiated action).
 * Registers the service worker, requests permission, gets an FCM token,
 * and stores it in the report entry so the Cloud Function can send pushes.
 */
async function setupPushNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  if (Notification.permission === 'denied') return;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const reg       = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);
    const token     = await getToken(messaging, {
      vapidKey:                  VAPID_KEY,
      serviceWorkerRegistration: reg,
    });

    if (token) {
      await updateDeviceToken(token);
    }

    // Foreground messages: onSnapshot already handles UI updates,
    // so here we just log for debugging.
    onMessage(messaging, (payload) => {
      console.log('[FCM] foreground message received:', payload);
    });
  } catch (err) {
    // Non-fatal: the reply will still appear via onSnapshot when the student opens the app.
    console.warn('[FCM] push notification setup failed:', err);
  }
}

/* ===== INIT ===== */
async function init() {
  showScreen('loading');

  const deviceData = getDeviceData();
  if (deviceData && deviceData.date === getTodayStr()) {
    const deviceId    = deviceData.deviceId || getDeviceId();
    const reports     = await getReportsForDate(getTodayStr());
    const myEntry     = reports.find(r => r.deviceId === deviceId);

    if (myEntry) {
      doneDateEl.textContent = `תאריך: ${formatDateHebrew(getTodayStr())}`;
      updateReplyUI(myEntry.teacherReply || null, myEntry.teacherReplyAt || null);
      showScreen('done');
      startReplyListener(myEntry.teacherReply || null);
      return;
    }
    clearDeviceData();
  }

  showScreen('name');
}

/* ===== STUDENT FLOW ===== */

// Step 1: Name entry — check by deviceId, not by name
document.getElementById('form-name').addEventListener('submit', async function (e) {
  e.preventDefault();
  const name = nameInput.value.trim();

  if (!name)           { nameError.textContent = 'נא להזין שם'; return; }
  if (name.length < 2) { nameError.textContent = 'שם חייב להכיל לפחות 2 תווים'; return; }
  nameError.textContent = '';

  const btn = this.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'בודק...';

  // Device already submitted today → go straight to done screen
  if (await isDeviceSubmittedToday()) {
    const reports = await getReportsForDate(getTodayStr());
    const myEntry = reports.find(r => r.deviceId === getDeviceId());
    doneDateEl.textContent = `תאריך: ${formatDateHebrew(getTodayStr())}`;
    if (myEntry?.teacherReply) updateReplyUI(myEntry.teacherReply, myEntry.teacherReplyAt);
    btn.disabled = false; btn.textContent = '← המשך';
    showScreen('done');
    startReplyListener(myEntry?.teacherReply || null);
    return;
  }

  btn.disabled = false; btn.textContent = '← המשך';
  displayName.textContent = name;
  reportInput.value       = '';
  reportError.textContent = '';
  zoomError.textContent   = '';
  document.querySelectorAll('input[name="zoom-status"]').forEach(i => { i.checked = false; });
  showScreen('report');
});

// Step 2: Report submission
document.getElementById('form-report').addEventListener('submit', async function (e) {
  e.preventDefault();
  const text       = reportInput.value.trim();
  const zoomStatus = document.querySelector('input[name="zoom-status"]:checked');

  if (!text)           { reportError.textContent = 'נא למלא את הדיווח לפני השליחה'; return; }
  if (text.length < 5) { reportError.textContent = 'אנא כתוב דיווח מפורט יותר'; return; }
  reportError.textContent = '';
  if (!zoomStatus)     { zoomError.textContent = 'נא לסמן אם היית בזום היום'; return; }
  zoomError.textContent = '';

  const name = nameInput.value.trim();
  const btn  = this.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'שולח...';

  // Double-check: device may have submitted in another tab
  if (await isDeviceSubmittedToday()) {
    const reports = await getReportsForDate(getTodayStr());
    const myEntry = reports.find(r => r.deviceId === getDeviceId());
    doneDateEl.textContent = `תאריך: ${formatDateHebrew(getTodayStr())}`;
    if (myEntry?.teacherReply) updateReplyUI(myEntry.teacherReply, myEntry.teacherReplyAt);
    btn.disabled = false; btn.textContent = 'שלח דיווח ✓';
    showScreen('done');
    startReplyListener(myEntry?.teacherReply || null);
    return;
  }

  await submitReport(name, text, zoomStatus.value === 'yes');
  doneDateEl.textContent = `תאריך: ${formatDateHebrew(getTodayStr())}`;
  btn.disabled = false; btn.textContent = 'שלח דיווח ✓';
  showScreen('done');
  startReplyListener(null); // no reply yet

  // Request push permission after successful user-initiated submission
  setupPushNotifications();
});

document.getElementById('btn-back-to-name').addEventListener('click', () => {
  nameInput.value       = '';
  nameError.textContent = '';
  showScreen('name');
});

/* ===== TEACHER BUTTON ===== */
teacherBtn.addEventListener('click', () => {
  passwordInput.value        = '';
  passwordError.textContent  = '';
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

// Event delegation for all teacher-panel interactions
teacherResults.addEventListener('click', async (e) => {

  // ── DELETE ──
  const deleteBtn = e.target.closest('.btn-delete');
  if (deleteBtn) {
    deleteBtn.disabled = true; deleteBtn.textContent = '...';
    const dateStr = deleteBtn.dataset.date;
    const index   = parseInt(deleteBtn.dataset.index, 10);
    const reports = await getReportsForDate(dateStr);
    reports.splice(index, 1);
    await setDoc(doc(db, 'reports', dateStr), { entries: reports });
    loadDateResults(dateStr);
    return;
  }

  // ── TOGGLE REPLY INPUT ──
  const addReplyBtn = e.target.closest('.btn-add-reply');
  if (addReplyBtn) {
    const index  = addReplyBtn.dataset.index;
    const row    = document.getElementById(`reply-row-${index}`);
    const isOpen = !row.classList.contains('hidden');
    row.classList.toggle('hidden');
    if (!isOpen) row.querySelector('.reply-textarea')?.focus();
    return;
  }

  // ── CANCEL REPLY ──
  const cancelBtn = e.target.closest('.btn-cancel-reply');
  if (cancelBtn) {
    document.getElementById(`reply-row-${cancelBtn.dataset.index}`)?.classList.add('hidden');
    return;
  }

  // ── SEND REPLY ──
  const sendReplyBtn = e.target.closest('.btn-send-reply');
  if (sendReplyBtn) {
    const dateStr   = sendReplyBtn.dataset.date;
    const index     = parseInt(sendReplyBtn.dataset.index, 10);
    const row       = document.getElementById(`reply-row-${index}`);
    const textarea  = row.querySelector('.reply-textarea');
    const replyText = textarea.value.trim();
    if (!replyText) { textarea.focus(); return; }

    sendReplyBtn.disabled    = true;
    sendReplyBtn.textContent = 'שולח...';
    await saveTeacherReply(dateStr, index, replyText);
    loadDateResults(dateStr); // re-render to reflect saved reply
    return;
  }
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
        <div>
          <div class="report-student-name">${escapeHtml(r.name)}</div>
          <div class="report-zoom-status">זום היום: ${getZoomStatusLabel(r.attendedZoom)}</div>
        </div>
        <button class="btn-delete" data-date="${dateStr}" data-index="${i}">מחק ✕</button>
      </div>
      <div class="report-text">${escapeHtml(r.text)}</div>
      <div class="report-time">⏰ ${r.time || ''}</div>
      <div class="reply-section">
        ${r.teacherReply
          ? `<div class="existing-reply">💬 <strong>תגובת המורה:</strong> ${escapeHtml(r.teacherReply)}<span class="reply-time-small">${r.teacherReplyAt ? ` · ${r.teacherReplyAt}` : ''}</span></div>`
          : ''}
        <div class="reply-input-row hidden" id="reply-row-${i}">
          <textarea class="reply-textarea" placeholder="כתוב תגובה לתלמיד...">${r.teacherReply ? escapeHtml(r.teacherReply) : ''}</textarea>
          <div class="reply-actions">
            <button class="btn-send-reply" data-date="${dateStr}" data-index="${i}">שלח ✓</button>
            <button class="btn-cancel-reply" data-index="${i}">ביטול</button>
          </div>
        </div>
        <button class="btn-add-reply" data-index="${i}">
          ${r.teacherReply ? 'ערוך תגובה ✏️' : 'הוסף תגובה 💬'}
        </button>
      </div>
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

function getZoomStatusLabel(attendedZoom) {
  if (attendedZoom === true)  return '✅';
  if (attendedZoom === false) return '❌';
  return 'לא סומן';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/* ===== START ===== */
init();
