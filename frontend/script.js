/* ══════════════════════════════════════════════════
   Flow — Meridian
   All logic: schedule, session, timer, ring, transitions
══════════════════════════════════════════════════ */

// ── Ring geometry ──────────────────────────────────────
const RING_R = 88;
const RING_C = 2 * Math.PI * RING_R; // 552.92

// ── Config ─────────────────────────────────────────────
const WARN_MINUTES = 15;

// ── State ──────────────────────────────────────────────
let schedule        = [];
let sessionStart    = null;
let currentTask     = '';
let sessionActive   = false;
let warningFired    = false;
let transitionFired = false;
let sessionLog      = [];
let clockInterval   = null;

// ── DOM ────────────────────────────────────────────────
const scheduleEntries = document.getElementById('schedule-entries');
const addSlotBtn      = document.getElementById('add-slot-btn');
const startBtn        = document.getElementById('start-btn');

const liveClock          = document.getElementById('live-clock');
const sessionTimer       = document.getElementById('session-timer');
const focusInput         = document.getElementById('focus-input');
const focusBtn           = document.getElementById('focus-btn');
const focusHint          = document.getElementById('focus-hint');
const nextItemDisplay    = document.getElementById('next-item-display');
const countdownWrap      = document.getElementById('countdown-bar-wrap');
const countdownText      = document.getElementById('countdown-text');
const countdownValue     = document.getElementById('countdown-value');
const progressFill       = document.getElementById('progress-fill');
const todayScheduleEl    = document.getElementById('today-schedule');
const sessionLogEl       = document.getElementById('session-log');
const switchNowBtn       = document.getElementById('switch-now-btn');
const editScheduleBtn    = document.getElementById('edit-schedule-btn');
const progressRingFill   = document.getElementById('progress-ring-fill');
const curTaskDisplay     = document.getElementById('current-task-display');

// ── Particles ──────────────────────────────────────────
(function spawnParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  for (let i = 0; i < 24; i++) {
    const p = document.createElement('div');
    p.className = 'p';
    const size = Math.random() * 2.5 + 1;
    const hue  = Math.random() > 0.5 ? '79,140,255' : '124,108,255';
    p.style.cssText = `
      left:${Math.random() * 100}%;
      top:${100 + Math.random() * 20}%;
      width:${size}px; height:${size}px;
      background:rgba(${hue},${Math.random() * 0.4 + 0.1});
      animation-duration:${Math.random() * 22 + 16}s;
      animation-delay:${-Math.random() * 35}s;
    `;
    container.appendChild(p);
  }
})();

// ── Screen management ──────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Setup screen ───────────────────────────────────────
function addScheduleRow(time = '', label = '') {
  const row = document.createElement('div');
  row.className = 'schedule-row';
  row.innerHTML = `
    <input type="time" value="${time}">
    <input type="text" value="${label}" placeholder="e.g. Violin practice">
    <button class="remove-slot" title="Remove">×</button>
  `;
  row.querySelector('.remove-slot').addEventListener('click', () => row.remove());
  scheduleEntries.appendChild(row);
}

addScheduleRow('07:00', 'Gym / Workout');
addScheduleRow('09:00', 'University / Study');
addScheduleRow('15:00', 'Violin / Piano');
addScheduleRow('18:00', 'Startup work');
addScheduleRow('21:00', 'Self-development');

addSlotBtn.addEventListener('click', () => addScheduleRow());

startBtn.addEventListener('click', () => {
  schedule = [];
  scheduleEntries.querySelectorAll('.schedule-row').forEach(row => {
    const time  = row.querySelector('input[type="time"]').value;
    const label = row.querySelector('input[type="text"]').value.trim();
    if (time && label) schedule.push({ time, label });
  });
  if (!schedule.length) return;
  schedule.sort((a, b) => a.time.localeCompare(b.time));
  showScreen('dashboard-screen');
  initDashboard();
});

// ── Dashboard init ─────────────────────────────────────
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
  if (liveClock) {
    liveClock.textContent = now.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }
  if (sessionActive) updateSessionTimer();
  updateNextUp();
  checkTransitionWarning();
}

// ── Session control ────────────────────────────────────
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
  currentTask     = task;
  sessionStart    = new Date();
  sessionActive   = true;
  warningFired    = false;
  transitionFired = false;

  focusInput.disabled  = true;
  focusBtn.textContent = 'End session';
  focusBtn.classList.remove('btn-cta');
  focusBtn.classList.add('btn-ghost');
  focusHint.textContent = 'Session in progress';
  switchNowBtn.disabled = false;

  curTaskDisplay.textContent = task;
  curTaskDisplay.classList.add('visible');

  document.body.classList.add('focus-mode');
}

function endSession(log = true) {
  if (!sessionActive) return;

  if (log && currentTask) {
    const duration = Math.round((new Date() - sessionStart) / 60000);
    addLogItem(currentTask, duration);
  }

  sessionActive   = false;
  sessionStart    = null;
  currentTask     = '';
  warningFired    = false;
  transitionFired = false;

  focusInput.disabled   = false;
  focusInput.value      = '';
  focusBtn.textContent  = 'Start session';
  focusBtn.classList.remove('btn-ghost');
  focusBtn.classList.add('btn-cta');
  focusHint.textContent     = 'Ready to begin';
  sessionTimer.textContent  = '00:00';
  sessionTimer.className    = 'ring-timer';
  switchNowBtn.disabled     = true;

  curTaskDisplay.textContent = '';
  curTaskDisplay.classList.remove('visible');
  document.body.classList.remove('focus-mode');

  // Reset ring
  if (progressRingFill) progressRingFill.style.strokeDashoffset = RING_C;
}

function updateSessionTimer() {
  if (!sessionStart) return;
  const elapsed = Math.floor((new Date() - sessionStart) / 1000);
  const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const s = (elapsed % 60).toString().padStart(2, '0');
  sessionTimer.textContent = `${m}:${s}`;
}

// ── Schedule helpers ───────────────────────────────────
function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function getNow() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function getNextBlock() {
  const total = getNow();
  const future = schedule.filter(s => timeToMinutes(s.time) > total);
  return future.length ? future[0] : null;
}

function getCurrentBlock() {
  const total = getNow();
  const past  = schedule.filter(s => timeToMinutes(s.time) <= total);
  return past.length ? past[past.length - 1] : null;
}

// ── Next Up + progress ring update ────────────────────
function updateNextUp() {
  const next  = getNextBlock();
  const total = getNow();

  if (!next) {
    nextItemDisplay.innerHTML = `
      <div class="next-name">—</div>
      <div class="next-meta">No more blocks today</div>
    `;
    countdownWrap.style.display = 'none';
    return;
  }

  const nextMins  = timeToMinutes(next.time);
  const remaining = nextMins - total;

  nextItemDisplay.innerHTML = `
    <div class="next-name">${next.label}</div>
    <div class="next-meta">at ${next.time} &nbsp;·&nbsp; in ${remaining} min</div>
  `;

  countdownWrap.style.display = 'block';

  // Percentage of session time remaining
  const sessionStartMins = sessionActive
    ? sessionStart.getHours() * 60 + sessionStart.getMinutes()
    : total - 60;
  const totalMins = Math.max(nextMins - sessionStartMins, 1);
  const pct = Math.max(0, Math.min(100, (remaining / totalMins) * 100));

  // Bar
  progressFill.style.width = `${pct}%`;

  // Ring
  if (progressRingFill && sessionActive) {
    progressRingFill.style.strokeDashoffset = RING_C - (pct / 100) * RING_C;
  }

  // Labels + states
  countdownValue.textContent = `${remaining} min`;

  if (remaining <= 5) {
    countdownValue.className = 'cd-value warning';
    progressFill.className   = 'bar-fill danger';
    countdownText.textContent = 'SWITCHING SOON';
  } else if (remaining <= WARN_MINUTES) {
    countdownValue.className = 'cd-value warning';
    progressFill.className   = 'bar-fill warning';
    countdownText.textContent = 'WRAPPING UP';
  } else {
    countdownValue.className = 'cd-value';
    progressFill.className   = 'bar-fill';
    countdownText.textContent = 'TIME REMAINING';
  }
}

// ── Transition warning + auto-trigger ─────────────────
function checkTransitionWarning() {
  const next = getNextBlock();
  if (!next) return;
  const remaining = timeToMinutes(next.time) - getNow();

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

// ── Trigger transition screen ──────────────────────────
function triggerTransition() {
  const next     = getNextBlock() || { label: 'Next task' };
  const duration = sessionActive ? Math.round((new Date() - sessionStart) / 60000) : 0;
  const task     = currentTask || 'Current task';

  document.getElementById('t-from-task').textContent = task;
  document.getElementById('t-duration').textContent  = `${duration} min session`;
  document.getElementById('t-to-task').textContent   = next.label;
  document.getElementById('context-summary').textContent = 'Generating summary...';

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
    document.getElementById('context-summary').textContent =
      data.summary || 'Session complete.';
  } catch {
    document.getElementById('context-summary').textContent =
      `You worked on "${task}" for ${duration} min. Pick up here when you return.`;
  }
}

// ── Render timeline ────────────────────────────────────
function renderTodaySchedule() {
  todayScheduleEl.innerHTML = '';
  const total   = getNow();
  const current = getCurrentBlock();
  const last    = schedule.length - 1;

  schedule.forEach((block, i) => {
    const mins = timeToMinutes(block.time);
    const li   = document.createElement('li');
    li.className = 'tl-item';
    if (mins < total && block !== current) li.classList.add('past');
    if (block === current)                 li.classList.add('active');

    li.innerHTML = `
      <div class="tl-spine">
        <div class="tl-dot"></div>
        ${i < last ? '<div class="tl-line"></div>' : ''}
      </div>
      <div class="tl-body">
        <span class="tl-time">${block.time}</span>
        <span class="tl-name">${block.label}</span>
      </div>
    `;
    todayScheduleEl.appendChild(li);
  });
}

// ── Session log entry ──────────────────────────────────
function addLogItem(task, duration) {
  const empty = sessionLogEl.querySelector('.log-empty');
  if (empty) empty.remove();

  const li = document.createElement('li');
  li.className = 'log-item';
  li.innerHTML = `
    <div class="log-item-task">${task}</div>
    <div class="log-item-meta">${duration} min · ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
  `;
  sessionLogEl.prepend(li);
  sessionLog.push({ task, duration });
}

// ── Transition actions ─────────────────────────────────
document.getElementById('back-btn').addEventListener('click', () => {
  showScreen('dashboard-screen');
  transitionFired = false;
});

document.getElementById('confirm-switch-btn').addEventListener('click', () => {
  const nextLabel = document.getElementById('t-to-task').textContent;
  endSession(true);
  showScreen('dashboard-screen');
  renderTodaySchedule();
  focusInput.value = nextLabel;
});
