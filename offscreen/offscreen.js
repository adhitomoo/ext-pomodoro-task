chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "playSound") {
    const audio = document.getElementById("alertSound");
    audio.currentTime = 0;
    audio.play().catch((err) => console.error("Audio play failed:", err));
  }
});
