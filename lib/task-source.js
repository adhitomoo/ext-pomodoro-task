import { fetchTasks, extractTaskTitle, extractTaskStatus, updateTaskStatus, updateTaskPomodoroCount } from "./notion-api.js";
import { fetchClickUpTasks, updateClickUpTaskStatus } from "./clickup-api.js";
import { fetchGoogleTasks, updateGoogleTaskStatus } from "./google-tasks-api.js";

export async function fetchAllTasks(settings) {
  const promises = [];

  if (settings.notionEnabled && settings.notionToken && settings.notionDatabaseId) {
    promises.push({
      source: "notion",
      fn: (async () => {
        const pages = await fetchTasks(settings.notionToken, settings.notionDatabaseId);
        return pages.map((page) => {
          const statusName = extractTaskStatus(page, settings.statusProperty) || "Unknown";
          const isDone = statusName.toLowerCase() === (settings.doneStatusValue || "done").toLowerCase();
          return {
            id: page.id,
            title: extractTaskTitle(page),
            status: statusName,
            statusType: isDone ? "closed" : "open",
            statusColor: getStatusColor(statusName),
            source: "notion"
          };
        });
      })()
    });
  }

  if (settings.clickupEnabled && settings.clickupToken && settings.clickupListId) {
    promises.push({
      source: "clickup",
      fn: fetchClickUpTasks(
        settings.clickupToken,
        settings.clickupListId,
        settings.clickupFilterMe ? [settings.clickupUserId] : []
      )
    });
  }

  if (settings.googleTasksEnabled && settings.googleTasksToken && settings.googleTasksListId) {
    promises.push({
      source: "google",
      fn: fetchGoogleTasks(settings.googleTasksToken, settings.googleTasksListId)
    });
  }

  if (promises.length === 0) return { tasks: [], errors: [] };

  const results = await Promise.allSettled(promises.map((p) => p.fn));

  const tasks = [];
  const errors = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      tasks.push(...result.value);
    } else {
      errors.push({ source: promises[i].source, error: result.reason?.message || "Unknown error" });
    }
  });

  return { tasks, errors };
}

export async function markTaskDone(settings, taskId, source) {
  const taskSource = source || settings.taskSource || "notion";

  if (taskSource === "clickup") {
    await updateClickUpTaskStatus(settings.clickupToken, taskId, "complete");
    return;
  }

  if (taskSource === "google") {
    await updateGoogleTaskStatus(settings.googleTasksToken, settings.googleTasksListId, taskId, "completed");
    return;
  }

  await updateTaskStatus(
    settings.notionToken,
    taskId,
    settings.statusProperty,
    settings.doneStatusValue || "Done"
  );
}

function getStatusColor(status) {
  if (!status) return "#888888";
  const lower = status.toLowerCase();
  if (lower === "to do") return "#656f7d";
  if (lower.includes("progress")) return "#1090e0";
  if (lower === "done" || lower === "complete") return "#008844";
  return "#888888";
}
