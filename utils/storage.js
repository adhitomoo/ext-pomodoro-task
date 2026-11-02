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

export async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get("settings", (result) => {
      resolve({ ...DEFAULTS, ...(result.settings || {}) });
    });
  });
}

export async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ settings: { ...DEFAULTS, ...settings } }, resolve);
  });
}

export async function getTimerState() {
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

export async function saveTimerState(state) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ timerState: state }, resolve);
  });
}
