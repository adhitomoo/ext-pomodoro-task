import { getSettings, getTimerState, saveTimerState } from "../utils/storage.js";
import { fetchAllTasks } from "../lib/task-source.js";
import { applyTheme } from "../utils/themes.js";

const $ = (id) => document.getElementById(id);

const elements = {
  mainContent: $("mainContent"),
  setupPrompt: $("setupPrompt"),
  goToSettings: $("goToSettings"),
  openSettings: $("openSettings"),
  timerTime: $("timerTime"),
  sessionLabel: $("sessionLabel"),
  progressRing: $("progressRing"),
  currentSessionNum: $("currentSessionNum"),
  totalSessions: $("totalSessions"),
  sessionDots: $("sessionDots"),
  btnPlay: $("btnPlay"),
  btnReset: $("btnReset"),
  btnSkip: $("btnSkip"),
  taskList: $("taskList"),
  hideDone: $("hideDone"),
  selectedTaskInfo: $("selectedTaskInfo"),
  dailyStats: $("dailyStats"),
};

const CIRCUMFERENCE = 2 * Math.PI * 70;

let tasks = [];

function isDoneStatus(task) {
  return task.statusType === "closed" || task.statusType === "done";
}

function getStatusOrder(task) {
  if (isDoneStatus(task)) return 100;
  const lower = (task.status || "").toLowerCase();
  if (lower.includes("progress")) return 0;
  if (lower === "needs action" || lower === "to do") return 1;
  if (lower.includes("block")) return 2;
  if (lower.includes("test") || lower.includes("review")) return 3;
  if (lower.includes("fix")) return 4;
  return 5;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function updateProgressRing(remaining, total) {
  const progress = total > 0 ? remaining / total : 1;
  const offset = CIRCUMFERENCE * (1 - progress);
  elements.progressRing.style.strokeDashoffset = offset;
}

function renderSessionDots(sessionCount, longBreakInterval) {
  elements.sessionDots.innerHTML = "";
  for (let i = 0; i < longBreakInterval; i++) {
    const dot = document.createElement("div");
    dot.className = "session-dot" + (i < sessionCount ? " completed" : "");
    elements.sessionDots.appendChild(dot);
  }
}

function getSessionLabel(session) {
  switch (session) {
    case "work": return "Focus";
    case "shortBreak": return "Short Break";
    case "longBreak": return "Long Break";
    default: return "Focus";
  }
}

function updateUI(state, settings) {
  elements.timerTime.textContent = formatTime(state.remainingSeconds);
  elements.sessionLabel.textContent = getSessionLabel(state.currentSession);
  elements.currentSessionNum.textContent = state.sessionCount + 1;
  elements.totalSessions.textContent = settings.longBreakInterval;

  const totalDuration = state.currentSession === "work"
    ? settings.workDuration * 60
    : state.currentSession === "shortBreak"
      ? settings.shortBreakDuration * 60
      : settings.longBreakDuration * 60;

  updateProgressRing(state.remainingSeconds, totalDuration);
  renderSessionDots(state.sessionCount, settings.longBreakInterval);

  if (state.isRunning && !state.isPaused) {
    elements.btnPlay.innerHTML = "&#10074;&#10074;";
    elements.btnPlay.title = "Pause";
  } else {
    elements.btnPlay.innerHTML = "&#9654;";
    elements.btnPlay.title = "Start";
  }

  updateSelectedTaskInfo(state);
}

function getSourceBadgeClass(source) {
  if (source === "notion") return "notion";
  if (source === "clickup") return "clickup";
  if (source === "google") return "google";
  return "";
}

function getSourceBadgeLetter(source) {
  if (source === "notion") return "N";
  if (source === "clickup") return "C";
  if (source === "google") return "G";
  return "?";
}

function updateSelectedTaskInfo(state) {
  if (state.selectedTaskName) {
    const task = tasks.find((t) => t.id === state.selectedTaskId);
    const dotColor = task ? task.statusColor : "#888";
    const badge = task ? `<span class="source-badge ${getSourceBadgeClass(task.source)}">${getSourceBadgeLetter(task.source)}</span>` : "";
    elements.selectedTaskInfo.innerHTML = `
      <span style="font-size:10px;color:var(--text-light);">Working on</span>
      <span class="selected-task-name">${badge}<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${dotColor};margin-right:4px;"></span>${state.selectedTaskName}</span>
    `;
  } else {
    elements.selectedTaskInfo.innerHTML = `<span style="font-size:10px;">No task selected</span>`;
  }
}

function groupTasksByStatus(tasks) {
  const groups = {};
  tasks.forEach((task) => {
    const key = (task.status || "Unknown").toLowerCase();
    if (!groups[key]) {
      groups[key] = { status: task.status || "Unknown", tasks: [], firstTask: task };
    }
    groups[key].tasks.push(task);
  });

  Object.values(groups).forEach((g) => {
    g.tasks.sort((a, b) => {
      if (a.source !== b.source) return a.source === "notion" ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
  });

  return Object.values(groups).sort((a, b) => {
    return getStatusOrder(a.firstTask) - getStatusOrder(b.firstTask);
  });
}

function renderTaskList(selectedTaskId, hideDone) {
  const groups = groupTasksByStatus(tasks);

  if (tasks.length === 0) {
    elements.taskList.innerHTML = '<div class="empty-tasks">No tasks found.</div>';
    return;
  }

  let html = "";
  groups.forEach((group) => {
    const groupDone = isDoneStatus(group.firstTask);
    if (groupDone && hideDone) return;

    const dotColor = group.firstTask.statusColor || "#888";
    html += `
      <div class="task-group-header">
        <span class="status-dot" style="background:${dotColor};"></span>
        ${group.status}
        <span class="task-count">${group.tasks.length}</span>
      </div>
    `;

    group.tasks.forEach((task) => {
      const isSelected = task.id === selectedTaskId;
      const taskDone = isDoneStatus(task);
      const badge = `<span class="source-badge ${getSourceBadgeClass(task.source)}">${getSourceBadgeLetter(task.source)}</span>`;
      html += `
        <div class="task-row ${isSelected ? "selected" : ""} ${taskDone ? "done" : ""}"
             data-task-id="${task.id}" ${taskDone ? "" : `data-selectable="true"`}>
          ${badge}
          <span class="task-row-name">${task.title}</span>
          ${!taskDone ? `<button class="btn-mark-done-sm" data-done-id="${task.id}" data-source="${task.source}">Done</button>` : ""}
        </div>
      `;
    });
  });

  elements.taskList.innerHTML = html;

  elements.taskList.querySelectorAll(".task-row[data-selectable]").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.classList.contains("btn-mark-done-sm")) return;
      selectTask(row.dataset.taskId);
    });
  });

  elements.taskList.querySelectorAll(".btn-mark-done-sm").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      markTaskDone(btn.dataset.doneId, btn.dataset.source);
    });
  });
}

async function selectTask(taskId) {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;

  const state = await getTimerState();
  state.selectedTaskId = taskId;
  state.selectedTaskName = task.title;
  state.selectedTaskSource = task.source;
  await saveTimerState(state);

  renderTaskList(taskId, elements.hideDone.checked);
  updateSelectedTaskInfo(state);
}

function markTaskDone(taskId, source) {
  const btn = elements.taskList.querySelector(`[data-done-id="${taskId}"]`);
  if (btn) {
    btn.textContent = "...";
    btn.disabled = true;
  }

  chrome.runtime.sendMessage({ action: "markDone", taskId, source }, (response) => {
    if (response && response.success) {
      loadTasks();
    } else {
      if (btn) {
        btn.textContent = "Err";
        setTimeout(() => { btn.textContent = "Done"; btn.disabled = false; }, 1500);
      }
    }
  });
}

async function loadTasks() {
  const settings = await getSettings();

  try {
    const result = await fetchAllTasks(settings);
    tasks = result.tasks;

    if (result.errors.length > 0) {
      const errorHtml = result.errors.map((e) =>
        `<div class="error-banner">${e.source}: ${e.error}</div>`
      ).join("");
      const listHtml = elements.taskList.innerHTML;
      elements.taskList.innerHTML = errorHtml + listHtml;
    }

    const state = await getTimerState();
    renderTaskList(state.selectedTaskId, elements.hideDone.checked);
  } catch (err) {
    console.error("Failed to load tasks:", err);
    elements.taskList.innerHTML = '<div class="empty-tasks">Failed to load tasks.</div>';
  }
}

function isConfigured(settings) {
  const notionOk = settings.notionEnabled && settings.notionToken && settings.notionDatabaseId;
  const clickupOk = settings.clickupEnabled && settings.clickupToken && settings.clickupListId;
  const googleOk = settings.googleTasksEnabled && settings.googleTasksToken && settings.googleTasksListId;
  return notionOk || clickupOk || googleOk;
}

async function loadDailyStats() {
  chrome.runtime.sendMessage({ action: "getDailyStats" }, (response) => {
    if (response) {
      elements.dailyStats.textContent = `Today: ${response.today} pomodoro${response.today !== 1 ? "s" : ""}`;
    }
  });
}

async function init() {
  const settings = await getSettings();

  applyTheme(settings.theme);

  if (!isConfigured(settings)) {
    elements.setupPrompt.style.display = "block";
    elements.mainContent.style.display = "none";
    return;
  }

  elements.setupPrompt.style.display = "none";
  elements.mainContent.style.display = "flex";

  await loadTasks();

  loadDailyStats();

  const state = await getTimerState();
  if (!state.remainingSeconds) {
    state.remainingSeconds = settings.workDuration * 60;
    await saveTimerState(state);
  }

  updateUI(state, settings);
}

elements.openSettings.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

elements.goToSettings.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

elements.btnPlay.addEventListener("click", async () => {
  const state = await getTimerState();
  const settings = await getSettings();

  if (!state.isRunning || state.isPaused) {
    state.isRunning = true;
    state.isPaused = false;
    chrome.runtime.sendMessage({ action: "startTimer" });
  } else {
    state.isPaused = true;
    chrome.runtime.sendMessage({ action: "pauseTimer" });
  }

  await saveTimerState(state);
  updateUI(state, settings);
});

elements.btnReset.addEventListener("click", async () => {
  chrome.runtime.sendMessage({ action: "resetTimer" });
});

elements.btnSkip.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "skipSession" });
});

elements.hideDone.addEventListener("change", async () => {
  const state = await getTimerState();
  renderTaskList(state.selectedTaskId, elements.hideDone.checked);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "timerUpdate") {
    getSettings().then((settings) => {
      updateUI(message.state, settings);
      loadDailyStats();
    });
  }
});

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
  if (e.code === "Space") {
    e.preventDefault();
    elements.btnPlay.click();
  } else if (e.code === "KeyR") {
    elements.btnReset.click();
  } else if (e.code === "KeyS") {
    elements.btnSkip.click();
  }
});

init();
