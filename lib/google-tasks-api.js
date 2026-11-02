const GOOGLE_TASKS_API = "https://www.googleapis.com/tasks/v1";

export async function fetchGoogleTaskLists(token) {
  const response = await fetch(`${GOOGLE_TASKS_API}/users/@me/lists`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch Google task lists");
  }
  
  const data = await response.json();
  return data.items || [];
}

export async function fetchGoogleTasks(token, tasklistId) {
  const response = await fetch(`${GOOGLE_TASKS_API}/lists/${tasklistId}/tasks?showCompleted=false`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch Google tasks");
  }
  
  const data = await response.json();
  return data.items
    .filter(task => task.title && task.title.trim() !== "")
    .map((task) => ({
      id: task.id,
      title: task.title,
      status: getTaskStatusDisplay(task.status),
      statusType: task.status === "completed" ? "closed" : "open",
      statusColor: task.status === "completed" ? "#008844" : "#4285f4",
      source: "google"
    }));
}

function getTaskStatusDisplay(status) {
  if (status === "completed") return "completed";
  if (status === "needsAction") return "needs action";
  return status;
}

export async function updateGoogleTaskStatus(token, tasklistId, taskId, status) {
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

export async function getGoogleTaskListById(token, tasklistId) {
  const response = await fetch(`${GOOGLE_TASKS_API}/users/@me/lists/${tasklistId}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch Google task list");
  }
  
  return response.json();
}