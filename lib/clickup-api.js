const CLICKUP_API = "https://api.clickup.com/api/v2";

export async function fetchClickUpTeams(token) {
  const response = await fetch(`${CLICKUP_API}/team`, {
    headers: { "Authorization": token }
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.err || "Failed to fetch ClickUp teams");
  }
  const data = await response.json();
  return data.teams;
}

export async function fetchClickUpFolderLists(token, folderId) {
  const response = await fetch(`${CLICKUP_API}/folder/${folderId}`, {
    headers: { "Authorization": token }
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.err || "Failed to fetch folder lists");
  }
  const data = await response.json();
  return data.lists || [];
}

export async function fetchClickUpTasks(token, listId, assigneeIds) {
  let url = `${CLICKUP_API}/list/${listId}/task?subtasks=true`;
  if (assigneeIds && assigneeIds.length > 0) {
    assigneeIds.forEach((id) => { url += `&assignee_ids[]=${id}`; });
  }
  const response = await fetch(url, {
    headers: { "Authorization": token }
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.err || "Failed to fetch ClickUp tasks");
  }
  const data = await response.json();
  return data.tasks.map((task) => ({
    id: task.id,
    title: task.name,
    status: task.status.status,
    statusType: task.status.type,
    statusColor: task.status.color,
    source: "clickup"
  }));
}

export async function updateClickUpTaskStatus(token, taskId, status) {
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

export async function getClickUpListStatuses(token, listId) {
  const response = await fetch(`${CLICKUP_API}/list/${listId}`, {
    headers: { "Authorization": token }
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.statuses || [];
}
