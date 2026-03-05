const btn      = document.getElementById('run-btn');
const input    = document.getElementById('input');
const output   = document.getElementById('output');
const taskList = document.getElementById('task-list');
const errorBox = document.getElementById('error-box');

btn.addEventListener('click', async () => {
  const text = input.value.trim();
  if (!text) { input.focus(); return; }

  // reset
  taskList.innerHTML = '';
  errorBox.style.display = 'none';
  output.classList.remove('visible');
  btn.disabled = true;
  btn.classList.add('loading');
  btn.textContent = 'Thinking…';

  try {
    const res = await fetch('http://127.0.0.1:8000/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    if (!res.ok) throw new Error(`server error ${res.status}`);

    const data = await res.json();
    const tasks = Array.isArray(data) ? data : (data.tasks ?? Object.values(data).flat());

    tasks.slice(0, 3).forEach((task, i) => {
      const li = document.createElement('li');
      li.className = 'task-item';
      li.innerHTML = `
        <span class="task-num">0${i + 1}</span>
        <span class="task-text">${task}</span>
      `;
      taskList.appendChild(li);
    });

    output.classList.add('visible');

  } catch (err) {
    errorBox.textContent = `! ${err.message}`;
    errorBox.style.display = 'block';
    output.classList.add('visible');
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.textContent = 'Run →';
  }
});

// submit on Cmd+Enter / Ctrl+Enter
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) btn.click();
});
