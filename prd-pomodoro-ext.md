# PRD: Notion Pomodoro Extension

## Product Overview

A Chromium browser extension that combines a Pomodoro timer with multi-source task management (Notion + ClickUp). Users can import tasks from both platforms, track focus sessions, and sync progress back — all from a minimal popup UI.

---

## Problem Statement

- Users manage tasks across multiple platforms (Notion, ClickUp) but lack a unified focus tool
- Pomodoro apps are disconnected from actual task management systems
- Completing a pomodoro session often goes unnoticed when deep in browser work

---

## Target Users

- Knowledge workers using Notion and/or ClickUp for task management
- Developers, students, and project managers who use the Pomodoro technique
- Teams wanting to track focus time against specific tasks

---

## Core Features

### 1. Pomodoro Timer
- Configurable work duration (default: 25 min)
- Short break (default: 5 min) and long break (default: 15 min)
- Long break interval (default: every 4 sessions)
- Auto-start options for breaks and work sessions
- Circular progress ring with gradient theming
- Session dot indicators

### 2. Multi-Source Task Integration
- **Notion**: Connect via Integration Token + Database ID
  - Auto-detects database properties (status, number fields)
  - Auto-creates "Pomodoro Count" number property if missing
  - Writes pomodoro count back to Notion on session completion
  - Updates task status to "Done" on mark complete

- **ClickUp**: Connect via API Token + List selection
  - Pre-configured team (90181891649) and folder (Avatar/Pengembangan)
  - List dropdown populated from Avatar folder
  - Filter by assignee (show only "my tasks" — user ID: 294741560)
  - Updates task status to "complete" on mark complete
  - No pomodoro count write-back (per user preference)

- **Both sources active simultaneously**: Tasks merged into unified list
  - Source indicated by badge: `[N]` Notion (purple), `[C]` ClickUp (amber)
  - Matching statuses grouped together (e.g., "To Do" from both sources in one group)
  - Tasks sorted by source within each group (Notion first)
  - Partial results if one source fails (error banner shown)

### 3. Task List UI (Popup)
- Two-column layout (540×440px): tasks left, timer right
- Tasks grouped by status with colored dots and task counts
- Status ordering: In progress → To Do → Blocked → Ready to test → Need fixing → Complete
- Click task row to select for pomodoro session
- "Mark Done" button per task row (appears on hover)
- Done tasks: muted opacity, not selectable
- "Hide completed tasks" toggle (checked by default)

### 4. Full-Screen Overlay
- Injected into active browser tab on session completion
- Dark semi-transparent backdrop with blur
- Centered card showing:
  - Session completion message ("Focus Complete!" / "Break Over!")
  - Session count and progress bar
  - Action buttons: Start Break/Focus, Skip, Dismiss
  - Close (×) button
- Stays until user interacts (no auto-dismiss)
- Fallback: notification + sound if tab is chrome:// page

### 5. Notifications
- Browser notification via `chrome.notifications` API
- Audio alert via `chrome.offscreen` API (bell sound)
- Both fire simultaneously with overlay

### 6. Theming
- 4 color themes: Silver, Ocean, Royal, Midnight
- CSS custom properties applied dynamically
- Settings page shows clickable gradient swatches
- Applied to popup, options page, and overlay

| Theme | Primary | Secondary | Style |
|---|---|---|---|
| Silver | `#E6E6E6` | `#A8B8C8` | Neutral, light |
| Ocean | `#5C7AEA` | `#45C4B0` | Fresh, bright (default) |
| Royal | `#3D56B2` | `#E8927C` | Elegant contrast |
| Midnight | `#14279B` | `#E8505B` | Dark mode |

---

## Technical Architecture

### Permissions
- `storage` — persist settings and timer state
- `alarms` — reliable timer in service worker
- `notifications` — browser notifications
- `offscreen` — audio playback (Manifest V3 requirement)
- `scripting` — inject overlay into active tab
- `activeTab` — access current tab for overlay
- Host: `https://api.notion.com/*`

### Project Structure
```
pomodoro-extension/
├── manifest.json
├── package.json
├── background/
│   └── service-worker.js       # Timer engine, overlay injection, API routing
├── popup/
│   ├── popup.html              # Two-column layout
│   ├── popup.js                # Task list, timer controls, source badges
│   └── theme.css               # CSS variables + structural styles
├── options/
│   ├── options.html            # Settings: sources, timer, theme, preferences
│   ├── options.js              # Config logic, property detection
│   └── theme.css               # Shared theme styles
├── content/
│   ├── overlay.js              # Session-complete overlay (injected)
│   └── overlay.css             # Overlay styles
├── offscreen/
│   ├── offscreen.html          # Audio playback document
│   └── offscreen.js            # Sound trigger handler
├── lib/
│   ├── notion-api.js           # Notion API: fetch, update, property detection
│   ├── clickup-api.js          # ClickUp API: fetch, update, list/status queries
│   └── task-source.js          # Abstraction: multi-source fetch + markDone routing
├── utils/
│   ├── storage.js              # Settings + timer state wrappers
│   └── themes.js               # Theme definitions + applyTheme()
└── assets/
    ├── icons/ (16, 48, 128px)
    └── sounds/bell.wav
```

### Data Flow
```
Settings (both sources enabled)
    │
    ├── Notion ──── notion-api.js ──┐
    │                                ├─► Promise.allSettled ─► Merged Tasks ─► Popup UI
    └── ClickUp ─── clickup-api.js ─┘
                                                                      │
                                                              markDone(taskId, source)
                                                                      │
                                                              Service Worker routes
                                                              by source parameter
```

### Common Task Format
```js
{
  id: string,
  title: string,
  status: string,          // "To Do", "In progress", "complete", etc.
  statusType: string,      // "open" | "custom" | "unstarted" | "closed"
  statusColor: string,     // "#1090e0" (from API or derived)
  source: "notion" | "clickup"
}
```

### Timer State
```js
{
  isRunning: boolean,
  isPaused: boolean,
  currentSession: "work" | "shortBreak" | "longBreak",
  sessionCount: number,
  remainingSeconds: number,
  selectedTaskId: string | null,
  selectedTaskName: string | null,
  selectedTaskSource: "notion" | "clickup" | null
}
```

---

## ClickUp Status Mapping

| Status | Type | Color | Group Order |
|---|---|---|---|
| In progress | custom | `#1090e0` (blue) | 1st |
| To Do | open | `#656f7d` (gray) | 2nd |
| Blocked | unstarted | `#d33d44` (red) | 3rd |
| Ready to test | custom | `#f8ae00` (amber) | 4th |
| Need fixing | custom | `#b660e0` (purple) | 5th |
| Complete | closed | `#008844` (green) | Last (hidden by default) |

---

## Notion Property Auto-Detection

- Status property: auto-detected from database schema
- Pomodoro Count: auto-created as number property if missing
- Done status: configurable (default "Done"), matched case-insensitively
- Active status options: extracted from status groups (non-"Complete" group)

---

## Build & Distribution

- `npm run build` → creates `notion-pomodoro.zip` via bestzip
- Load unpacked in `chrome://extensions` for development
- ZIP ready for Chrome Web Store submission

---

## Future Considerations

- Additional task sources (Todoist, Linear, Jira) via same abstraction layer
- Pomodoro count write-back for ClickUp (custom fields)
- Stats/history dashboard (daily/weekly summary)
- Content script for embedding mini-timer on Notion/ClickUp pages
- Keyboard shortcuts for timer controls
- Sync settings across devices via `chrome.storage.sync`
