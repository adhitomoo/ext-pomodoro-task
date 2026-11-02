import { getSettings, saveSettings } from "../utils/storage.js";
import { fetchDatabaseProperties, autoDetectProperties, getActiveStatusOptions, ensurePomodoroCountProperty } from "../lib/notion-api.js";
import { fetchClickUpTeams, fetchClickUpFolderLists } from "../lib/clickup-api.js";
import { fetchGoogleTaskLists } from "../lib/google-tasks-api.js";
import { THEMES, applyTheme } from "../utils/themes.js";

const $ = (id) => document.getElementById(id);

const CLICKUP_TEAM_ID = "90181891649";
const CLICKUP_FOLDER_ID = "90189840469";

const elements = {
  notionEnabled: $("notionEnabled"),
  clickupEnabled: $("clickupEnabled"),
  googleTasksEnabled: $("googleTasksEnabled"),
  notionSection: $("notionSection"),
  clickupSection: $("clickupSection"),
  googleTasksSection: $("googleTasksSection"),
  notionToken: $("notionToken"),
  notionDatabaseId: $("notionDatabaseId"),
  testConnection: $("testConnection"),
  connectionMessage: $("connectionMessage"),
  propertyMapping: $("propertyMapping"),
  pomodoroCountProperty: $("pomodoroCountProperty"),
  statusProperty: $("statusProperty"),
  doneStatusValue: $("doneStatusValue"),
  clickupToken: $("clickupToken"),
  testClickUp: $("testClickUp"),
  clickupMessage: $("clickupMessage"),
  clickupListField: $("clickupListField"),
  clickupListId: $("clickupListId"),
  clickupFilterField: $("clickupFilterField"),
  clickupFilterMe: $("clickupFilterMe"),
  connectGoogleTasks: $("connectGoogleTasks"),
  disconnectGoogleTasks: $("disconnectGoogleTasks"),
  googleTasksMessage: $("googleTasksMessage"),
  googleTasksListField: $("googleTasksListField"),
  googleTasksListId: $("googleTasksListId"),
  workDuration: $("workDuration"),
  shortBreakDuration: $("shortBreakDuration"),
  longBreakDuration: $("longBreakDuration"),
  longBreakInterval: $("longBreakInterval"),
  soundEnabled: $("soundEnabled"),
  autoStartBreak: $("autoStartBreak"),
  autoStartWork: $("autoStartWork"),
  saveBtn: $("saveBtn"),
  saveMessage: $("saveMessage"),
  themeOptions: $("themeOptions"),
};

function showMessage(el, text, type) {
  el.textContent = text;
  el.className = `message message-${type}`;
  if (type === "success") {
    setTimeout(() => { el.textContent = ""; }, 3000);
  }
}

function updateSectionVisibility() {
  elements.notionSection.style.display = elements.notionEnabled.checked ? "block" : "none";
  elements.clickupSection.style.display = elements.clickupEnabled.checked ? "block" : "none";
  elements.googleTasksSection.style.display = elements.googleTasksEnabled.checked ? "block" : "none";
}

elements.notionEnabled.addEventListener("change", updateSectionVisibility);
elements.clickupEnabled.addEventListener("change", updateSectionVisibility);
elements.googleTasksEnabled.addEventListener("change", updateSectionVisibility);

async function loadSettings() {
  const settings = await getSettings();

  elements.notionEnabled.checked = settings.notionEnabled;
  elements.clickupEnabled.checked = settings.clickupEnabled;
  elements.googleTasksEnabled.checked = settings.googleTasksEnabled;
  updateSectionVisibility();

  elements.notionToken.value = settings.notionToken;
  elements.notionDatabaseId.value = settings.notionDatabaseId;
  elements.workDuration.value = settings.workDuration;
  elements.shortBreakDuration.value = settings.shortBreakDuration;
  elements.longBreakDuration.value = settings.longBreakDuration;
  elements.longBreakInterval.value = settings.longBreakInterval;
  elements.soundEnabled.checked = settings.soundEnabled;
  elements.autoStartBreak.checked = settings.autoStartBreak;
  elements.autoStartWork.checked = settings.autoStartWork;
  elements.pomodoroCountProperty.value = settings.pomodoroCountProperty;
  elements.statusProperty.value = settings.statusProperty;
  elements.doneStatusValue.value = settings.doneStatusValue;
  elements.clickupToken.value = settings.clickupToken;
  elements.clickupFilterMe.checked = settings.clickupFilterMe;

  applyTheme(settings.theme);
  updateThemeSelection(settings.theme);

  if (settings.notionEnabled && settings.notionToken && settings.notionDatabaseId) {
    await detectProperties(settings.notionToken, settings.notionDatabaseId);
  }

  if (settings.clickupEnabled && settings.clickupToken) {
    await loadClickUpLists(settings.clickupToken, settings.clickupListId);
  }

  if (settings.googleTasksEnabled && settings.googleTasksToken) {
    await loadGoogleTaskLists(settings.googleTasksToken, settings.googleTasksListId);
    updateGoogleConnectionUI(true);
  }
}

async function detectProperties(token, databaseId) {
  try {
    await ensurePomodoroCountProperty(token, databaseId);

    const properties = await fetchDatabaseProperties(token, databaseId);
    const detected = autoDetectProperties(properties);

    elements.pomodoroCountProperty.innerHTML = '<option value="">-- None (don\'t track count) --</option>';
    detected.number.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      elements.pomodoroCountProperty.appendChild(opt);
    });

    elements.statusProperty.innerHTML = '<option value="">-- None (don\'t update status) --</option>';
    detected.status.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      elements.statusProperty.appendChild(opt);
    });

    elements.propertyMapping.style.display = "block";

    const settings = await getSettings();
    elements.pomodoroCountProperty.value = settings.pomodoroCountProperty || "Pomodoro Count";
    if (settings.statusProperty) {
      elements.statusProperty.value = settings.statusProperty;
    }

    const activeStatusOpts = detected.status.length > 0
      ? getActiveStatusOptions(properties, detected.status[0])
      : [];

    const autoStatusProperty = settings.statusProperty
      || (detected.status.length > 0 ? detected.status[0] : "");

    await saveSettings({
      ...settings,
      notionToken: token,
      notionDatabaseId: databaseId,
      activeStatusOptions: activeStatusOpts,
      pomodoroCountProperty: settings.pomodoroCountProperty || "Pomodoro Count",
      statusProperty: autoStatusProperty
    });

    if (autoStatusProperty) {
      elements.statusProperty.value = autoStatusProperty;
    }

    return detected;
  } catch (err) {
    showMessage(elements.connectionMessage, `Error: ${err.message}`, "error");
    return null;
  }
}

async function loadClickUpLists(token, selectedListId) {
  try {
    const lists = await fetchClickUpFolderLists(token, CLICKUP_FOLDER_ID);

    elements.clickupListId.innerHTML = '<option value="">-- Select a list --</option>';
    lists.forEach((list) => {
      const opt = document.createElement("option");
      opt.value = list.id;
      opt.textContent = list.name;
      elements.clickupListId.appendChild(opt);
    });

    if (selectedListId) {
      elements.clickupListId.value = selectedListId;
    }

    elements.clickupListField.style.display = "block";
    elements.clickupFilterField.style.display = "flex";
    return lists;
  } catch (err) {
    showMessage(elements.clickupMessage, `Error: ${err.message}`, "error");
    return null;
  }
}

async function loadGoogleTaskLists(token, selectedListId) {
  try {
    const lists = await fetchGoogleTaskLists(token);

    elements.googleTasksListId.innerHTML = '<option value="">-- Select a task list --</option>';
    lists.forEach((list) => {
      const opt = document.createElement("option");
      opt.value = list.id;
      opt.textContent = list.title;
      elements.googleTasksListId.appendChild(opt);
    });

    if (selectedListId) {
      elements.googleTasksListId.value = selectedListId;
    }

    elements.googleTasksListField.style.display = "block";
    return lists;
  } catch (err) {
    showMessage(elements.googleTasksMessage, `Error: ${err.message}`, "error");
    return null;
  }
}

function updateThemeSelection(themeId) {
  elements.themeOptions.querySelectorAll(".theme-swatch").forEach((el) => {
    el.classList.toggle("active", el.dataset.theme === themeId);
  });
}

elements.themeOptions.addEventListener("click", async (e) => {
  const swatch = e.target.closest(".theme-swatch");
  if (!swatch) return;

  const themeId = swatch.dataset.theme;
  applyTheme(themeId);
  updateThemeSelection(themeId);

  const settings = await getSettings();
  await saveSettings({ ...settings, theme: themeId });
});

elements.testConnection.addEventListener("click", async () => {
  const token = elements.notionToken.value.trim();
  const databaseId = elements.notionDatabaseId.value.trim();

  if (!token || !databaseId) {
    showMessage(elements.connectionMessage, "Please enter both token and database ID", "error");
    return;
  }

  elements.testConnection.disabled = true;
  elements.testConnection.textContent = "Testing...";

  const detected = await detectProperties(token, databaseId);

  elements.testConnection.disabled = false;
  elements.testConnection.textContent = "Test Connection";

  if (detected) {
    showMessage(elements.connectionMessage, "Connected! Properties detected.", "success");
  }
});

elements.testClickUp.addEventListener("click", async () => {
  const token = elements.clickupToken.value.trim();

  if (!token) {
    showMessage(elements.clickupMessage, "Please enter your API token", "error");
    return;
  }

  elements.testClickUp.disabled = true;
  elements.testClickUp.textContent = "Testing...";

  try {
    const teams = await fetchClickUpTeams(token);
    const lists = await loadClickUpLists(token, null);

    const settings = await getSettings();
    await saveSettings({ ...settings, clickupToken: token });

    if (teams && lists) {
      showMessage(elements.clickupMessage, `Connected! Found ${lists.length} lists in Avatar folder.`, "success");
    }
  } catch (err) {
    showMessage(elements.clickupMessage, `Error: ${err.message}`, "error");
  }

  elements.testClickUp.disabled = false;
  elements.testClickUp.textContent = "Test Connection";
});

function updateGoogleConnectionUI(isConnected) {
  if (isConnected) {
    elements.connectGoogleTasks.textContent = "Reconnect";
    elements.disconnectGoogleTasks.style.display = "inline-block";
  } else {
    elements.connectGoogleTasks.textContent = "Connect Google Account";
    elements.disconnectGoogleTasks.style.display = "none";
  }
}

elements.disconnectGoogleTasks.addEventListener("click", async () => {
  elements.disconnectGoogleTasks.disabled = true;
  
  const settings = await getSettings();
  await saveSettings({ ...settings, googleTasksToken: "", googleTasksListId: "" });
  
  elements.googleTasksListId.innerHTML = '<option value="">-- Select a task list --</option>';
  elements.googleTasksListField.style.display = "none";
  
  updateGoogleConnectionUI(false);
  showMessage(elements.googleTasksMessage, "Disconnected from Google.", "success");
  
  elements.disconnectGoogleTasks.disabled = false;
});

const GOOGLE_CLIENT_ID = "1045356002909-eq7vod89sk7pt47b9is5a5in1tphlrhc.apps.googleusercontent.com";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/tasks.readonly",
  "https://www.googleapis.com/auth/tasks"
].join(" ");

function getGoogleAuthUrl(redirectUri) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    response_type: "token",
    redirect_uri: redirectUri,
    scope: GOOGLE_SCOPES,
    prompt: "consent"
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function extractAccessToken(redirectResponseUrl) {
  const hashStr = redirectResponseUrl.split("#")[1];
  if (!hashStr) throw new Error("No access token in response");
  
  const params = new URLSearchParams(hashStr);
  const token = params.get("access_token");
  if (!token) {
    const error = params.get("error");
    throw new Error(error || "No access token in response");
  }
  return token;
}

function launchWebAuthFlowWithTimeout(authUrl, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    
    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("Sign-in timed out. Please try again."));
      }
    }, timeoutMs);
    
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      (responseUrl) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!responseUrl) {
          reject(new Error("No response from Google sign-in"));
          return;
        }
        
        try {
          const token = extractAccessToken(responseUrl);
          resolve(token);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

async function getGoogleAuthToken() {
  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl = getGoogleAuthUrl(redirectUri);
  return await launchWebAuthFlowWithTimeout(authUrl);
}

elements.connectGoogleTasks.addEventListener("click", async () => {
  elements.connectGoogleTasks.disabled = true;
  elements.connectGoogleTasks.textContent = "Connecting...";
  showMessage(elements.googleTasksMessage, "Opening Google sign-in...", "info");

  try {
    const token = await getGoogleAuthToken();
    
    try {
      const lists = await loadGoogleTaskLists(token, null);
      const settings = await getSettings();
      await saveSettings({ ...settings, googleTasksToken: token });

      if (lists && lists.length > 0) {
        showMessage(elements.googleTasksMessage, `Connected! Found ${lists.length} task lists.`, "success");
      } else {
        showMessage(elements.googleTasksMessage, "Connected! No task lists found in your Google Tasks.", "success");
      }
      updateGoogleConnectionUI(true);
    } catch (apiError) {
      console.error("Google Tasks API error:", apiError);
      
      let errorMsg = apiError.message;
      if (errorMsg.includes("401") || errorMsg.includes("invalid") || errorMsg.includes("unauthorized")) {
        errorMsg = "Authorization failed. Please try again.";
      } else if (errorMsg.includes("403") || errorMsg.includes("forbidden")) {
        errorMsg = "Access denied. Check Google Cloud Console permissions.";
      } else if (errorMsg.includes("404")) {
        errorMsg = "Google Tasks service not found. Enable the API in Google Cloud Console.";
      }
      showMessage(elements.googleTasksMessage, `Connection failed: ${errorMsg}`, "error");
      
      const settings = await getSettings();
      await saveSettings({ ...settings, googleTasksToken: "" });
      updateGoogleConnectionUI(false);
    }
  } catch (authError) {
    console.error("Google auth error:", authError);
    let errorMsg = authError.message;
    
    if (errorMsg.includes("cancel") || errorMsg.toLowerCase().includes("user")) {
      errorMsg = "Authorization was canceled.";
    } else if (errorMsg.includes("redirect_mismatch")) {
      errorMsg = "Redirect URI mismatch. Ensure the redirect URI is registered in Google Cloud Console.";
    } else if (errorMsg.includes("access_denied")) {
      errorMsg = "Access denied. Check OAuth consent screen configuration.";
    } else {
      errorMsg = `Failed to connect: ${errorMsg}`;
    }
    showMessage(elements.googleTasksMessage, errorMsg, "error");
  } finally {
    elements.connectGoogleTasks.disabled = false;
    const currentSettings = await getSettings();
    updateGoogleConnectionUI(currentSettings.googleTasksToken !== "");
  }
});

elements.saveBtn.addEventListener("click", async () => {
  const notionEnabled = elements.notionEnabled.checked;
  const clickupEnabled = elements.clickupEnabled.checked;
  const googleTasksEnabled = elements.googleTasksEnabled.checked;

  if (!notionEnabled && !clickupEnabled && !googleTasksEnabled) {
    showMessage(elements.saveMessage, "Enable at least one task source", "error");
    return;
  }

  const existingSettings = await getSettings();
  const settings = {
    notionEnabled,
    clickupEnabled,
    googleTasksEnabled,
    notionToken: elements.notionToken.value.trim(),
    notionDatabaseId: elements.notionDatabaseId.value.trim(),
    clickupToken: elements.clickupToken.value.trim(),
    clickupTeamId: CLICKUP_TEAM_ID,
    clickupListId: elements.clickupListId.value,
    clickupFilterMe: elements.clickupFilterMe.checked,
    googleTasksToken: existingSettings.googleTasksToken || "",
    googleTasksListId: elements.googleTasksListId.value,
    workDuration: parseInt(elements.workDuration.value) || 25,
    shortBreakDuration: parseInt(elements.shortBreakDuration.value) || 5,
    longBreakDuration: parseInt(elements.longBreakDuration.value) || 15,
    longBreakInterval: parseInt(elements.longBreakInterval.value) || 4,
    soundEnabled: elements.soundEnabled.checked,
    autoStartBreak: elements.autoStartBreak.checked,
    autoStartWork: elements.autoStartWork.checked,
    pomodoroCountProperty: elements.pomodoroCountProperty.value,
    statusProperty: elements.statusProperty.value,
    doneStatusValue: elements.doneStatusValue.value.trim() || "Done",
    theme: document.querySelector(".theme-swatch.active")?.dataset.theme || "ocean"
  };

  await saveSettings(settings);
  showMessage(elements.saveMessage, "Settings saved!", "success");
});

loadSettings();
