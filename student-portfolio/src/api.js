const BASE_URL = "http://localhost:5000";

export const getTasks = () =>
  fetch(`${BASE_URL}/tasks`).then(async (res) => {
    if (!res.ok) {
      throw new Error("Failed to fetch tasks");
    }
    return res.json();
  });

export const createTask = (task) =>
  fetch(`${BASE_URL}/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(task),
  }).then(async (res) => {
    if (!res.ok) {
      throw new Error("Failed to create task");
    }
    return res.json();
  });

export const updateTask = (id, task) =>
  fetch(`${BASE_URL}/tasks/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(task),
  }).then(async (res) => {
    if (!res.ok) {
      throw new Error("Failed to update task");
    }
    return res.json();
  });

export const deleteTask = (id) =>
  fetch(`${BASE_URL}/tasks/${id}`, {
    method: "DELETE",
  }).then(async (res) => {
    if (!res.ok) {
      throw new Error("Failed to delete task");
    }
    return res.json();
  });

// Practical 13: External AI API Integration (Server-side proxy)
export const generateAiDescription = (title) =>
  fetch(`${BASE_URL}/api/ai/generate-description`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title }),
  }).then(async (res) => {
    if (!res.ok) {
      throw new Error("Failed to generate AI description");
    }
    return res.json();
  });

export const getAiStatus = () =>
  fetch(`${BASE_URL}/api/ai/status`).then(async (res) => {
    if (!res.ok) {
      throw new Error("Failed to fetch AI status");
    }
    return res.json();
  });