// ── State ──
let schedule = []; // [{ time: "HH:MM", label: "...", days: [0-6] }]
let sessionStart = null;
let currentTask = '';
let sessionActive = false;
let warningFired = false;
let transitionFired = false;
let sessionLog = [];
let timerInterval = null;
let clockInterval = null;

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const WARN_MINUTES = 15;

// ── Screen management ──
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Setup screen ──
const scheduleEntries = document.getElementById('schedule-entries');
const addSlotBtn      = document.getElementById('add-slot-btn');
const startBtn        = document.getElementById('start-btn');

function addScheduleRow(time = '', label = '', days = [1,2,3,4,5]) {
  const row = document.createElement('div');
  row.className = 'schedule-row';
  row.innerHTML = `
    <input type="time" value="${time}" placeholder="16:00">
    <input type="text" value="${label}" placeholder="e.g. Violin practice">
    <select multiple title="Days (hold Cmd/Ctrl to multi-select)" style="display:none"></select>
    <button class="remove-slot" title="Remove">×</button>
  `;
  row.querySelector('.remove-slot').addEventListener('click', () => row.remove());
  scheduleEntries.appendChild(row);
}

// Pre-populate with Yuval's real schedule as a starting point
addScheduleRow('07:00', 'Gym / Workout', [1,2,3,4,5]);
addScheduleRow('09:00', 'University / Study', [0,1,2,3,4]);
addScheduleRow('15:00', 'Violin / Piano practice', [1,2,3,4,5]);
addScheduleRow('18:00', 'Startup work', [1,2,3,4,5,6]);
addScheduleRow('21:00', 'Self-development reading', [0,1,2,3,4,5,6]);

addSlotBtn.addEventListener('click', () => addScheduleRow());

startBtn.addEventListener('click', () => {
  schedule = [];
  const rows = scheduleEntries.querySelectorAll('.schedule-row');
  rows.forEach(row => {
    const time  = row.querySelector('input[type="time"]').value;
    const label = row.querySelector('input[type="text"]').value.trim();
    if (time && label) {
      schedule.push({ time, label });
    }
  });

  if (schedule.length === 0) return;
  schedule.sort((a, b) => a.time.localeCompare(b.time));

  showScreen('dashboard-screen');
  initDashboard();
});

// ── Dashboard ──
const liveClock       = document.getElementById('live-clock');
const sessionTimer    = document.getElementById('session-timer');
const focusInput      = document.getElementById('focus-input');
const focusBtn        = document.getElementById('focus-btn');
const focusHint       = document.getElementById('focus-hint');
const nextItemDisplay = document.getElementById('next-item-display');
const countdownWrap   = document.getElementById('countdown-bar-wrap');
const countdownText   = document.getElementById('countdown-text');
const countdownValue  = document.getElementById('countdown-value');
const progressFill    = document.getElementById('progress-fill');
const todaySchedule   = document.getElementById('today-schedule');
const sessionLogEl    = document.getElementById('session-log');
const switchNowBtn    = document.getElementById('switch-now-btn');
const editScheduleBtn = document.getElementById('edit-schedule-btn');

function initDashboard() {
  renderTodaySchedule();
  updateNextUp();
  startClock();

  focusBtn.addEventListener('click', toggleSession);
  switchNowBtn.addEventListener('click', triggerTransition);
  editScheduleBtn.addEventListener('click', () => {
    endSession(false);
    showScreen('setup-screen');
  });
}

function startClock() {
  if (clockInterval) clearInterval(clockInterval);
  tickClock();
  clockInterval = setInterval(tickClock, 1000);
}

function tickClock() {
  const now = new Date();
  liveClock.textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (sessionActive) updateSessionTimer();
  updateNextUp();
  checkTransitionWarning();
}

function toggleSession() {
  if (!sessionActive) {
    const task = focusInput.value.trim();
    if (!task) { focusInput.focus(); return; }
    startSession(task);
  } else {
    endSession(true);
  }
}

function startSession(task) {
  currentTask  = task;
  sessionStart = new Date();
  sessionActive = true;
  warningFired = false;
  transitionFired = false;

  focusInput.disabled = true;
  focusBtn.textContent = 'End session';
  focusBtn.style.background = 'transparent';
  focusBtn.style.border = '1px solid var(--border)';
  focusBtn.style.color = 'var(--muted)';
  focusHint.textContent = 'session in progress';
  switchNowBtn.disabled = false;
}

function endSession(log = true) {
  if (!sessionActive) return;

  if (log && currentTask) {
    const duration = Math.round((new Date() - sessionStart) / 60000);
    addLogItem(currentTask, duration);
  }

  sessionActive = false;
  sessionStart  = null;
  currentTask   = '';
  warningFired  = false;
  transitionFired = false;

  focusInput.disabled = false;
  focusInput.value = '';
  focusBtn.textContent = 'Start session →';
  focusBtn.style.background = '';
  focusBtn.style.border = '';
  focusBtn.style.color = '';
  focusHint.textContent = 'press start to begin session';
  sessionTimer.textContent = '00:00';
  sessionTimer.className = 'timer-badge';
  switchNowBtn.disabled = true;
}

function updateSessionTimer() {
  if (!sessionStart) return;
  const elapsed = Math.floor((new Date() - sessionStart) / 1000);
  const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const s = (elapsed % 60).toString().padStart(2, '0');
  sessionTimer.textContent = `${m}:${s}`;
}

// ── Schedule logic ──
function getNow() {
  const now = new Date();
  return { h: now.getHours(), m: now.getMinutes(), total: now.getHours() * 60 + now.getMinutes() };
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToDisplay(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function getNextBlock() {
  const { total } = getNow();
  const future = schedule.filter(s => timeToMinutes(s.time) > total);
  return future.length > 0 ? future[0] : null;
}

function getCurrentBlock() {
  const { total } = getNow();
  const past = schedule.filter(s => timeToMinutes(s.time) <= total);
  return past.length > 0 ? past[past.length - 1] : null;
}

function updateNextUp() {
  const next = getNextBlock();
  const { total } = getNow();

  if (!next) {
    nextItemDisplay.innerHTML = `<div class="next-label">—</div><div class="next-time">no more blocks today</div>`;
    countdownWrap.style.display = 'none';
    return;
  }

  const nextMins   = timeToMinutes(next.time);
  const remaining  = nextMins - total; // minutes
  const sessionDuration = sessionActive ? Math.round((new Date() - sessionStart) / 60000) : 0;
  const totalSessionMins = sessionActive ? nextMins - timeToMinutes(
    (() => { const d = sessionStart; return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })()
  ) : 60;

  nextItemDisplay.innerHTML = `
    <div class="next-label">${next.label}</div>
    <div class="next-time">at ${next.time} · in ${remaining} min</div>
  `;

  countdownWrap.style.display = 'block';

  const pct = Math.max(0, Math.min(100, (remaining / Math.max(totalSessionMins, 1)) * 100));
  progressFill.style.width = `${pct}%`;

  countdownValue.textContent = `${remaining} min`;

  if (remaining <= 5) {
    countdownValue.className = 'warning';
    progressFill.className   = 'progress-fill danger';
    countdownText.textContent = 'switching soon';
  } else if (remaining <= WARN_MINUTES) {
    countdownValue.className = 'warning';
    progressFill.className   = 'progress-fill warning';
    countdownText.textContent = 'wrapping up time';
  } else {
    countdownValue.className = '';
    progressFill.className   = 'progress-fill';
    countdownText.textContent = 'time remaining';
  }
}

function checkTransitionWarning() {
  const next = getNextBlock();
  if (!next) return;
  const { total } = getNow();
  const nextMins = timeToMinutes(next.time);
  const remaining = nextMins - total;

  if (remaining <= WARN_MINUTES && !warningFired && sessionActive) {
    warningFired = true;
    sessionTimer.classList.add('warning');
    focusHint.textContent = `${WARN_MINUTES} min until ${next.label} — start wrapping up`;
  }

  if (remaining <= 0 && !transitionFired && sessionActive) {
    transitionFired = true;
    triggerTransition();
  }
}

function triggerTransition() {
  const next = getNextBlock() || { label: 'next task' };
  const duration = sessionActive ? Math.round((new Date() - sessionStart) / 60000) : 0;
  const task = currentTask || 'current task';

  document.getElementById('t-from-task').textContent = task;
  document.getElementById('t-duration').textContent  = `${duration} min session`;
  document.getElementById('t-to-task').textContent   = next.label;
  document.getElementById('context-summary').textContent = 'Generating context summary...';

  showScreen('transition-screen');
  generateContextSummary(task, duration, next.label);
}

async function generateContextSummary(task, duration, nextTask) {
  try {
    const res = await fetch('/transition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_task: task, duration_minutes: duration, next_task: nextTask })
    });
    const data = await res.json();
    document.getElementById('context-summary').textContent = data.summary || 'Session complete.';
  } catch {
    document.getElementById('context-summary').textContent = `You worked on "${task}" for ${duration} min. Pick up here when you return.`;
  }
}

function renderTodaySchedule() {
  todaySchedule.innerHTML = '';
  const { total } = getNow();
  const current = getCurrentBlock();

  schedule.forEach(block => {
    const blockMins = timeToMinutes(block.time);
    const li = document.createElement('li');
    li.className = 'block-item';

    if (blockMins < total && block !== current) li.classList.add('past');
    if (block === current) li.classList.add('active');

    li.innerHTML = `<span class="block-time">${block.time}</span><span class="block-name">${block.label}</span>`;
    todaySchedule.appendChild(li);
  });
}

function addLogItem(task, duration) {
  const empty = sessionLogEl.querySelector('.log-empty');
  if (empty) empty.remove();

  const li = document.createElement('li');
  li.className = 'log-item';
  li.innerHTML = `
    <div class="log-item-task">${task}</div>
    <div class="log-item-meta">${duration} min · ended ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
  `;
  sessionLogEl.prepend(li);
  sessionLog.push({ task, duration });
}

// ── Transition screen ──
document.getElementById('back-btn').addEventListener('click', () => {
  showScreen('dashboard-screen');
  transitionFired = false;
});

document.getElementById('confirm-switch-btn').addEventListener('click', () => {
  const nextLabel = document.getElementById('t-to-task').textContent;
  endSession(true);
  showScreen('dashboard-screen');
  renderTodaySchedule();

  // Pre-fill the next task
  focusInput.value = nextLabel;
});
