export const THEMES = {
  silver: {
    name: "Silver",
    primary: "#E6E6E6",
    secondary: "#A8B8C8",
    vars: {
      "--bg": "#F5F5F5",
      "--bg-card": "#FFFFFF",
      "--primary": "#E6E6E6",
      "--primary-light": "#F0F0F0",
      "--secondary": "#A8B8C8",
      "--secondary-light": "#D6DEE6",
      "--accent": "#C8C8D0",
      "--accent-light": "#E8E8EC",
      "--text": "#4A4A4A",
      "--text-light": "#7A7A7A",
      "--text-dark": "#2D2D2D",
      "--danger": "#E8A0A0",
      "--success": "#A0D8B0",
      "--border": "#E0E0E0"
    },
    gradient: { from: "#C0C0C0", to: "#A8B8C8" }
  },
  ocean: {
    name: "Ocean",
    primary: "#5C7AEA",
    secondary: "#45C4B0",
    vars: {
      "--bg": "#F0F4FF",
      "--bg-card": "#FFFFFF",
      "--primary": "#5C7AEA",
      "--primary-light": "#B8CAFB",
      "--secondary": "#45C4B0",
      "--secondary-light": "#D0F0E8",
      "--accent": "#7B8FF0",
      "--accent-light": "#DDE3FC",
      "--text": "#3D4F7C",
      "--text-light": "#7A8BB5",
      "--text-dark": "#2A3A66",
      "--danger": "#E8A0A0",
      "--success": "#A0D8B0",
      "--border": "#D8E2F8"
    },
    gradient: { from: "#5C7AEA", to: "#45C4B0" }
  },
  royal: {
    name: "Royal",
    primary: "#3D56B2",
    secondary: "#E8927C",
    vars: {
      "--bg": "#EEF0F8",
      "--bg-card": "#FFFFFF",
      "--primary": "#3D56B2",
      "--primary-light": "#A8B3DA",
      "--secondary": "#E8927C",
      "--secondary-light": "#F8DDD5",
      "--accent": "#6B7FCC",
      "--accent-light": "#D8DFF2",
      "--text": "#2E3A5E",
      "--text-light": "#6B7A9E",
      "--text-dark": "#1E2847",
      "--danger": "#E8A0A0",
      "--success": "#A0D8B0",
      "--border": "#D0D6E8"
    },
    gradient: { from: "#3D56B2", to: "#E8927C" }
  },
  midnight: {
    name: "Midnight",
    primary: "#14279B",
    secondary: "#E8505B",
    vars: {
      "--bg": "#0E1545",
      "--bg-card": "#1A2060",
      "--primary": "#14279B",
      "--primary-light": "#2A3DB0",
      "--secondary": "#E8505B",
      "--secondary-light": "#3A4880",
      "--accent": "#3060D0",
      "--accent-light": "#253590",
      "--text": "#C8D0F0",
      "--text-light": "#8890B8",
      "--text-dark": "#E8EEFF",
      "--danger": "#E8505B",
      "--success": "#50C878",
      "--border": "#2A3580"
    },
    gradient: { from: "#14279B", to: "#E8505B" }
  }
};

export function applyTheme(themeId) {
  const theme = THEMES[themeId] || THEMES.ocean;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }
  const stops = document.querySelectorAll("#gradient stop");
  if (stops.length === 2) {
    stops[0].style.stopColor = theme.gradient.from;
    stops[1].style.stopColor = theme.gradient.to;
  }
}
