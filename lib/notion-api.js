const NOTION_API = "https://api.notion.com/v1";

export async function ensurePomodoroCountProperty(token, databaseId) {
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

export async function fetchTasks(token, databaseId) {
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

export async function updateTaskPomodoroCount(token, pageId, propertyName, count) {
  const response = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      properties: {
        [propertyName]: {
          number: count
        }
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update task");
  }

  return response.json();
}

export async function updateTaskStatus(token, pageId, propertyName, statusValue) {
  const response = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      properties: {
        [propertyName]: {
          status: { name: statusValue }
        }
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update task status");
  }

  return response.json();
}

export async function fetchDatabaseProperties(token, databaseId) {
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

export function extractTaskTitle(page) {
  const props = page.properties;
  for (const key of Object.keys(props)) {
    if (props[key].type === "title") {
      return props[key].title.map((t) => t.plain_text).join("");
    }
  }
  return "Untitled";
}

export function extractTaskStatus(page, statusPropertyName) {
  if (!statusPropertyName) {
    for (const [name, prop] of Object.entries(page.properties)) {
      if (prop.type === "status") {
        const value = prop.status?.name || null;
        if (!value) console.warn(`[notion-api] Status property "${name}" has no value on page ${page.id}`);
        return value;
      }
    }
    console.warn(`[notion-api] No status property found on page ${page.id}`);
    return null;
  }
  const prop = page.properties[statusPropertyName];
  if (!prop) {
    console.warn(`[notion-api] Property "${statusPropertyName}" not found on page ${page.id}`);
    return null;
  }
  if (prop.type !== "status") {
    console.warn(`[notion-api] Property "${statusPropertyName}" is type "${prop.type}", not "status"`);
    return null;
  }
  return prop.status?.name || null;
}

export function autoDetectProperties(properties) {
  const result = {
    title: null,
    status: [],
    number: [],
    select: [],
    checkbox: []
  };

  for (const [name, prop] of Object.entries(properties)) {
    switch (prop.type) {
      case "title":
        result.title = name;
        break;
      case "status":
        result.status.push(name);
        break;
      case "number":
        result.number.push(name);
        break;
      case "select":
        result.select.push(name);
        break;
      case "checkbox":
        result.checkbox.push(name);
        break;
    }
  }

  return result;
}

export function getActiveStatusOptions(properties, statusPropertyName) {
  if (!statusPropertyName || !properties[statusPropertyName]) return [];
  const statusProp = properties[statusPropertyName];
  if (statusProp.type !== "status" || !statusProp.status) return [];

  const doneGroup = (statusProp.status.groups || []).find(
    (g) => g.name.toLowerCase() === "complete" || g.name.toLowerCase() === "done"
  );
  const doneOptionIds = new Set(doneGroup ? doneGroup.option_ids : []);

  return (statusProp.status.options || [])
    .filter((opt) => !doneOptionIds.has(opt.id))
    .map((opt) => opt.name);
}
