const DEFAULTS = {
  notionToken: "",
  notionDatabaseId: "",
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  soundEnabled: true,
  autoStartBreak: false,
  autoStartWork: false,
  taskPropertyMap: null,
  pomodoroCountProperty: "",
  statusProperty: "",
  doneStatusValue: "Done",
  theme: "ocean",
  notionEnabled: true,
  clickupEnabled: true,
  clickupToken: "",
  clickupTeamId: "90181891649",
  clickupListId: "",
  clickupFilterMe: true,
  clickupUserId: "294741560",
  googleTasksEnabled: true,
  googleTasksToken: "",
  googleTasksListId: ""
};

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get("settings", (result) => {
      resolve({ ...DEFAULTS, ...(result.settings || {}) });
    });
  });
}

async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ settings: { ...DEFAULTS, ...settings } }, resolve);
  });
}

async function getTimerState() {
  return new Promise((resolve) => {
    chrome.storage.local.get("timerState", (result) => {
      resolve(result.timerState || {
        isRunning: false,
        isPaused: false,
        currentSession: "work",
        sessionCount: 0,
        remainingSeconds: 0,
        selectedTaskId: null,
        selectedTaskName: null,
        selectedTaskSource: null
      });
    });
  });
}

async function saveTimerState(state) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ timerState: state }, resolve);
  });
}

const NOTION_API = "https://api.notion.com/v1";

async function ensurePomodoroCountProperty(token, databaseId) {
  const properties = await fetchDatabaseProperties(token, databaseId);
  const detected = autoDetectProperties(properties);

  if (detected.number.includes("Pomodoro Count")) return "Pomodoro Count";

  await fetch(`${NOTION_API}/databases/${databaseId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      properties: { "Pomodoro Count": { number: {} } }
    })
  });

  return "Pomodoro Count";
}

async function fetchTasks(token, databaseId) {
  const response = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ page_size: 100 })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to fetch tasks");
  }

  const data = await response.json();
  return data.results;
}

async function updateTaskPomodoroCount(token, pageId, propertyName, count) {
  const response = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      properties: { [propertyName]: { number: count } }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update task");
  }

  return response.json();
}

async function updateTaskStatus(token, pageId, propertyName, statusValue) {
  const response = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      properties: { [propertyName]: { status: { name: statusValue } } }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update task status");
  }

  return response.json();
}

async function fetchDatabaseProperties(token, databaseId) {
  const response = await fetch(`${NOTION_API}/databases/${databaseId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": "2022-06-28"
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to fetch database");
  }

  const data = await response.json();
  return data.properties;
}

function extractTaskTitle(page) {
  const props = page.properties;
  for (const key of Object.keys(props)) {
    if (props[key].type === "title") {
      return props[key].title.map((t) => t.plain_text).join("");
    }
  }
  return "Untitled";
}

function extractTaskStatus(page, statusPropertyName) {
  if (!statusPropertyName) return null;
  const prop = page.properties[statusPropertyName];
  if (!prop || prop.type !== "status") return null;
  return prop.status?.name || null;
}

function autoDetectProperties(properties) {
  const result = { title: null, status: [], number: [], select: [], checkbox: [] };

  for (const [name, prop] of Object.entries(properties)) {
    switch (prop.type) {
      case "title": result.title = name; break;
      case "status": result.status.push(name); break;
      case "number": result.number.push(name); break;
      case "select": result.select.push(name); break;
      case "checkbox": result.checkbox.push(name); break;
    }
  }

  return result;
}

const CLICKUP_API = "https://api.clickup.com/api/v2";

async function updateClickUpTaskStatus(token, taskId, status) {
  const response = await fetch(`${CLICKUP_API}/task/${taskId}`, {
    method: "PUT",
    headers: {
      "Authorization": token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ status })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.err || "Failed to update ClickUp task");
  }
  return response.json();
}

const GOOGLE_TASKS_API = "https://www.googleapis.com/tasks/v1";

async function updateGoogleTaskStatusSW(token, tasklistId, taskId, status) {
  const isCompleted = status === "completed" || status === "complete";
  
  const response = await fetch(
    `${GOOGLE_TASKS_API}/lists/${tasklistId}/tasks/${taskId}`,
    {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: taskId,
        status: isCompleted ? "completed" : "needsAction",
        completed: isCompleted ? new Date().toISOString() : null
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to update Google task");
  }
  
  return response.json();
}

const ALARM_NAME = "pomodoro-timer";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

async function incrementDailyStats() {
  return new Promise((resolve) => {
    chrome.storage.local.get("dailyStats", (result) => {
      const stats = result.dailyStats || {};
      const key = todayKey();
      stats[key] = (stats[key] || 0) + 1;
      chrome.storage.local.set({ dailyStats: stats }, resolve);
    });
  });
}

async function getDailyStats() {
  return new Promise((resolve) => {
    chrome.storage.local.get("dailyStats", (result) => {
      const stats = result.dailyStats || {};
      const key = todayKey();
      resolve({ today: stats[key] || 0 });
    });
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;

  const state = await getTimerState();
  if (!state.isRunning || state.isPaused) return;

  state.remainingSeconds--;

  if (state.remainingSeconds <= 0) {
    await onSessionComplete(state);
  } else {
    await saveTimerState(state);
  }

  broadcastUpdate();
});

async function onSessionComplete(state) {
  const settings = await getSettings();
  const completedSession = state.currentSession;

  if (state.currentSession === "work") {
    await handleWorkComplete(state, settings);
  }

  await transitionToNextSession(state, settings);
  await saveTimerState(state);
  await showNotification(state);
  await playSound(settings);
  await showOverlay(state, settings, completedSession);
}

async function handleWorkComplete(state, settings) {
  state.sessionCount++;

  await incrementDailyStats();

  if (state.selectedTaskSource === "clickup") return;

  if (state.selectedTaskId && settings.pomodoroCountProperty) {
    try {
      const resp = await fetch(`https://api.notion.com/v1/pages/${state.selectedTaskId}`, {
        headers: {
          "Authorization": `Bearer ${settings.notionToken}`,
          "Notion-Version": "2022-06-28"
        }
      });
      const pageData = await resp.json();
      const currentCount = (pageData.properties[settings.pomodoroCountProperty]?.number) || 0;

      await updateTaskPomodoroCount(
        settings.notionToken,
        state.selectedTaskId,
        settings.pomodoroCountProperty,
        currentCount + 1
      );
    } catch (err) {
      console.error("Failed to update pomodoro count:", err);
    }
  }
}

async function transitionToNextSession(state, settings) {
  if (state.currentSession === "work") {
    if (state.sessionCount % settings.longBreakInterval === 0) {
      state.currentSession = "longBreak";
      state.remainingSeconds = settings.longBreakDuration * 60;
    } else {
      state.currentSession = "shortBreak";
      state.remainingSeconds = settings.shortBreakDuration * 60;
    }

    if (settings.autoStartBreak) {
      state.isRunning = true;
      state.isPaused = false;
      chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 / 60 });
    } else {
      state.isRunning = false;
      state.isPaused = false;
      chrome.alarms.clear(ALARM_NAME);
    }
  } else {
    state.currentSession = "work";
    state.remainingSeconds = settings.workDuration * 60;

    if (settings.autoStartWork) {
      state.isRunning = true;
      state.isPaused = false;
      chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 / 60 });
    } else {
      state.isRunning = false;
      state.isPaused = false;
      chrome.alarms.clear(ALARM_NAME);
    }
  }
}

async function showNotification(state) {
  const isBreak = state.currentSession !== "work";
  chrome.notifications.create({
    type: "basic",
    iconUrl: "assets/icons/icon128.png",
    title: "Pomodoro",
    message: isBreak
      ? "Great work! Time for a break."
      : "Break is over. Time to focus!",
    priority: 2
  });
}

async function playSound(settings) {
  if (!settings.soundEnabled) return;

  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"]
    });

    if (existingContexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: "offscreen/offscreen.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Play timer alert sound"
      });
    }

    chrome.runtime.sendMessage({ action: "playSound" });
  } catch (err) {
    console.error("Failed to play sound:", err);
  }
}

function broadcastUpdate() {
  getTimerState().then((state) => {
    chrome.runtime.sendMessage({ action: "timerUpdate", state }).catch(() => {});
    updateBadge(state);
  });
}

function updateBadge(state) {
  if (state.isRunning && !state.isPaused && state.remainingSeconds > 0) {
    const m = Math.floor(state.remainingSeconds / 60);
    const s = state.remainingSeconds % 60;
    const text = m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: state.currentSession === "work" ? "#E8505B" : "#45C4B0" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

async function showOverlay(state, settings, completedSession) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) return;

    const tab = tabs[0];
    if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) return;

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content/overlay.js"]
    });

    await chrome.tabs.sendMessage(tab.id, {
      action: "showOverlay",
      data: {
        completedSession: completedSession,
        sessionCount: state.sessionCount,
        longBreakInterval: settings.longBreakInterval,
        theme: settings.theme || "ocean"
      }
    });
  } catch (err) {
    console.error("Failed to show overlay:", err);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "startTimer") {
    getTimerState().then((state) => {
      state.isRunning = true;
      state.isPaused = false;
      saveTimerState(state);
      chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 / 60 });
      broadcastUpdate();
    });
  }

  if (message.action === "pauseTimer") {
    getTimerState().then((state) => {
      state.isPaused = true;
      saveTimerState(state);
      chrome.alarms.clear(ALARM_NAME);
      broadcastUpdate();
    });
  }

  if (message.action === "resetTimer") {
    getSettings().then((settings) => {
      const state = {
        isRunning: false,
        isPaused: false,
        currentSession: "work",
        sessionCount: 0,
        remainingSeconds: settings.workDuration * 60,
        selectedTaskId: null,
        selectedTaskName: null,
        selectedTaskSource: null
      };
      saveTimerState(state);
      chrome.alarms.clear(ALARM_NAME);
      broadcastUpdate();
    });
  }

  if (message.action === "skipSession") {
    getTimerState().then(async (state) => {
      const settings = await getSettings();
      await transitionToNextSession(state, settings);
      await saveTimerState(state);
      broadcastUpdate();
    });
  }

  if (message.action === "getState") {
    getTimerState().then((state) => {
      sendResponse(state);
    });
    return true;
  }

  if (message.action === "markDone") {
    (async () => {
      const settings = await getSettings();
      const source = message.source || "notion";
      if (!message.taskId) {
        sendResponse({ success: false, error: "Missing task ID" });
        return;
      }
      try {
        if (source === "clickup") {
          await updateClickUpTaskStatus(settings.clickupToken, message.taskId, "complete");
        } else if (source === "google") {
          await updateGoogleTaskStatusSW(settings.googleTasksToken, settings.googleTasksListId, message.taskId, "completed");
        } else {
          if (!settings.statusProperty) {
            sendResponse({ success: false, error: "Missing status property" });
            return;
          }
          await updateTaskStatus(
            settings.notionToken,
            message.taskId,
            settings.statusProperty,
            settings.doneStatusValue || "Done"
          );
        }
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.action === "startBreak" || message.action === "startWork") {
    getTimerState().then(async (state) => {
      state.isRunning = true;
      state.isPaused = false;
      await saveTimerState(state);
      chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 / 60 });
      broadcastUpdate();
    });
  }

  if (message.action === "dismissOverlay") {
    sendResponse({ ok: true });
  }

  if (message.action === "getDailyStats") {
    getDailyStats().then((stats) => {
      sendResponse(stats);
    });
    return true;
  }
});
