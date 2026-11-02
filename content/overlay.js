(function () {
  const OVERLAY_ID = "pomodoro-overlay-backdrop";
  if (document.getElementById(OVERLAY_ID)) return;

  const THEMES = {
    silver: { primary: "#B0B0B0", secondary: "#A8B8C8", gradient: ["#C0C0C0", "#A8B8C8"] },
    ocean: { primary: "#5C7AEA", secondary: "#45C4B0", gradient: ["#5C7AEA", "#45C4B0"] },
    royal: { primary: "#3D56B2", secondary: "#E8927C", gradient: ["#3D56B2", "#E8927C"] },
    midnight: { primary: "#3060D0", secondary: "#E8505B", gradient: ["#14279B", "#E8505B"] }
  };

  function createOverlay(data) {
    const theme = THEMES[data.theme] || THEMES.ocean;
    const isWork = data.completedSession === "work";

    const backdrop = document.createElement("div");
    backdrop.id = OVERLAY_ID;
    backdrop.className = "pomodoro-overlay-backdrop";

    const title = isWork ? "Focus Complete!" : "Break Over!";
    const subtitle = isWork ? "Great work! Time for a break." : "Ready to focus again?";
    const sessionText = `Session ${data.sessionCount} of ${data.longBreakInterval} done`;
    const primaryBtn = isWork ? "Start Break" : "Start Focus";
    const progressWidth = (data.sessionCount / data.longBreakInterval) * 100;

    const cssLink = document.createElement("link");
    cssLink.rel = "stylesheet";
    cssLink.href = chrome.runtime.getURL("content/overlay.css");
    document.head.appendChild(cssLink);

    backdrop.innerHTML = `
      <div class="pomodoro-overlay-card">
        <button class="po-close-btn" id="po-close">&times;</button>
        <div class="po-icon">${isWork ? "🍅" : "☕"}</div>
        <div class="po-title" style="color: ${theme.primary};">${title}</div>
        <div class="po-session-info">${sessionText}</div>
        <div class="po-subtitle">${subtitle}</div>
        <div class="po-buttons">
          <button class="po-btn-primary" id="po-primary" style="background: ${theme.primary};">${primaryBtn}</button>
          <button class="po-btn-secondary" id="po-skip">Skip to Next</button>
        </div>
        <div class="po-progress-bar">
          <div class="po-progress-fill" style="width: ${progressWidth}%; background: linear-gradient(90deg, ${theme.gradient[0]}, ${theme.gradient[1]});"></div>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    document.getElementById("po-close").addEventListener("click", () => {
      removeOverlay();
      chrome.runtime.sendMessage({ action: "dismissOverlay" });
    });

    document.getElementById("po-primary").addEventListener("click", () => {
      removeOverlay();
      if (isWork) {
        chrome.runtime.sendMessage({ action: "startBreak" });
      } else {
        chrome.runtime.sendMessage({ action: "startWork" });
      }
    });

    document.getElementById("po-skip").addEventListener("click", () => {
      removeOverlay();
      chrome.runtime.sendMessage({ action: "skipSession" });
    });
  }

  function removeOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.style.animation = "po-fade-in 0.2s ease reverse";
      setTimeout(() => overlay.remove(), 200);
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "showOverlay") {
      createOverlay(message.data);
    }
    if (message.action === "dismissOverlay") {
      removeOverlay();
    }
  });
})();
