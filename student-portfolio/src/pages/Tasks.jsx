import { useState, useEffect, Suspense } from "react";
import Spinner from "../components/Spinner";
import ErrorMessage from "../components/ErrorMessage";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  generateAiDescription,
} from "../api";
import { lazyWithDelay } from "../utils/lazyWithDelay";

// Component-level Code Splitting: Lazy load heavy analytics chart
const TaskAnalyticsChart = lazyWithDelay(() => import("../components/TaskAnalyticsChart"));

const SAMPLE_TASKS = [
  { _id: "1", title: "Complete Practical 8", description: "Implement React lazy loading & code splitting", priority: "high", completed: true },
  { _id: "2", title: "DevTools Performance Audit", description: "Measure initial vs chunk bundle sizes in Network tab", priority: "low", completed: false },
  { _id: "3", title: "Backend API Integration", description: "Connect frontend with Task Management server", priority: "high", completed: false }
];

function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("low");

  const [editingId, setEditingId] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Practical 13: AI Assistant States
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNotice, setAiNotice] = useState(null);

  const loadTasks = async () => {
    try {
      const res = await getTasks();
      if (res && res.error) {
        setError(res.error);
        return;
      }

      // Safely extract array from API response envelope { data: [...] } or direct array [...]
      const taskList = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : [];

      setTasks(taskList);
      setError(null);
    } catch (err) {
      console.warn("Backend API offline at http://localhost:5000, using sample tasks for preview.", err);
      setTasks(SAMPLE_TASKS);
    }
  };

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    loadTasks().finally(() => {
      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setStatusMessage({
        type: "error",
        text: "Please enter a task title.",
      });
      return;
    }

    try {
      const res = await createTask({
        title: title.trim(),
        description: description.trim(),
        priority,
      });

      const newTask = res?.data || res;
      // Refresh task list from the server to guarantee sync with MongoDB
      await loadTasks();

      setStatusMessage({
        type: "success",
        text: `Task "${newTask.title || title.trim()}" created successfully!`,
      });
      setError(null);
    } catch {
      // Offline fallback
      const offlineTask = {
        _id: String(Date.now()),
        title: title.trim(),
        description: description.trim(),
        priority,
        completed: false,
      };
      setTasks((prev) => (Array.isArray(prev) ? [...prev, offlineTask] : [offlineTask]));
      setStatusMessage({
        type: "success",
        text: `Task "${title.trim()}" created (saved in offline preview mode).`,
      });
    }

    setTitle("");
    setDescription("");
    setPriority("low");
    setAiNotice(null);
  };

  // Practical 13: AI Generation with graceful failure handling
  const handleAiGenerate = async () => {
    if (!title.trim()) {
      setAiNotice({
        type: "warning",
        text: "Please enter a task title first so the AI assistant knows what to describe."
      });
      return;
    }

    setAiLoading(true);
    setAiNotice(null);

    try {
      const res = await generateAiDescription(title.trim());
      if (res.description) {
        setDescription(res.description);
      }
      if (res.suggestedPriority) {
        setPriority(res.suggestedPriority);
      }
      setAiNotice({
        type: res.fallback ? "fallback" : "success",
        text: res.disclaimer || (res.fallback ? "Rule-based fallback template generated." : "AI suggestion generated successfully!"),
        source: res.source
      });
    } catch {
      // Graceful client-side degradation if backend/network is completely unreachable
      setDescription(`Action plan for "${title}": Complete specifications, review code, and verify tests.`);
      setAiNotice({
        type: "fallback",
        text: "Network/Server offline. Client-side fallback template generated. Please review.",
        source: "client-fallback"
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleEdit = (task) => {
    const taskId = task._id || task.id;
    setEditingId(taskId);
    setTitle(task.title || "");
    setDescription(task.description || "");
    setPriority(task.priority || "medium");
    setStatusMessage(null);
    setAiNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setPriority("low");
    setStatusMessage(null);
    setAiNotice(null);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingId) return;

    if (!title.trim()) {
      setStatusMessage({
        type: "error",
        text: "Task title cannot be empty.",
      });
      return;
    }

    try {
      const res = await updateTask(editingId, {
        title: title.trim(),
        description: description.trim(),
        priority,
      });

      // Extract task entity from { message: '...', data: updatedTask } or raw task
      const updatedTask = res?.data || res;

      // Refresh task list from the server to guarantee MongoDB sync (Requirement 5)
      await loadTasks();

      setStatusMessage({
        type: "success",
        text: `Task "${updatedTask.title || title.trim()}" updated successfully in MongoDB!`,
      });
      setError(null);
    } catch (err) {
      console.warn("Update task API failed, falling back to local state:", err);
      // Offline fallback
      setTasks((prev) =>
        (Array.isArray(prev) ? prev : []).map((task) =>
          (task._id || task.id) === editingId
            ? { ...task, title: title.trim(), description: description.trim(), priority }
            : task
        )
      );
      setStatusMessage({
        type: "error",
        text: `Failed to update task on server (${err.message || 'Network error'}). Updated in local preview.`,
      });
    }

    setEditingId(null);
    setTitle("");
    setDescription("");
    setPriority("low");
    setAiNotice(null);
  };

  const handleDelete = async (id) => {
    try {
      await deleteTask(id);
      // Refresh task list from server to guarantee sync
      await loadTasks();
      setStatusMessage({
        type: "success",
        text: "Task deleted successfully!",
      });
      setError(null);
    } catch {
      console.warn("Backend offline, removing task from local state.");
      setTasks((prev) => (Array.isArray(prev) ? prev : []).filter((task) => (task._id || task.id) !== id));
      setStatusMessage({
        type: "error",
        text: "Backend offline. Removed task from local state.",
      });
    }
  };

  const safeTasks = Array.isArray(tasks) ? tasks : [];

  if (loading) return <Spinner />;
  if (error && safeTasks.length === 0) return <ErrorMessage message={error} />;

  return (
    <div className="container">
      <div className="card">
        <h1>My Tasks & Projects</h1>

        {/* Global error message */}
        {error && (
          <div style={{ marginBottom: "1rem" }}>
            <ErrorMessage message={error} />
          </div>
        )}

        {/* Status message (Success / Error notification) */}
        {statusMessage && (
          <div
            className={`ai-disclaimer ${statusMessage.type === "success" ? "success" : "warning"}`}
            style={{
              margin: "12px auto",
              maxWidth: "600px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>
              {statusMessage.type === "success" ? "✅ " : "❌ "}
              {statusMessage.text}
            </span>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              style={{
                background: "transparent",
                color: "inherit",
                border: "none",
                cursor: "pointer",
                padding: "2px 8px",
                fontSize: "14px",
                fontWeight: "bold",
              }}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        <button
          className="analytics-toggle-btn"
          onClick={() => setShowAnalytics(!showAnalytics)}
        >
          {showAnalytics ? "Hide Analytics Chart" : "📈 Show Analytics Chart (Lazy Loaded)"}
        </button>

        {showAnalytics && (
          <Suspense fallback={<div className="spinner">Loading chart chunk...</div>}>
            <TaskAnalyticsChart tasks={safeTasks} />
          </Suspense>
        )}

        {/* Active Edit Mode Banner */}
        {editingId && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              padding: "10px 16px",
              borderRadius: "8px",
              margin: "12px auto",
              maxWidth: "600px",
            }}
          >
            <span style={{ fontSize: "14px", color: "#1e40af" }}>
              ✏️ Editing Task: <strong>{title || "Untitled Task"}</strong>
            </span>
            <button
              type="button"
              onClick={handleCancelEdit}
              style={{
                background: "#6b7280",
                padding: "6px 14px",
                fontSize: "13px",
              }}
            >
              Cancel Edit
            </button>
          </div>
        )}

        <form onSubmit={editingId ? handleUpdate : handleCreate} className="task-form">
          <input
            type="text"
            placeholder="Task title (e.g. Implement OAuth Login)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          {/* Practical 13: Generate Description AI Button */}
          <button
            type="button"
            className="ai-btn"
            onClick={handleAiGenerate}
            disabled={aiLoading || !title.trim()}
          >
            {aiLoading ? "✨ Generating..." : "✨ Generate Description"}
          </button>

          <input
            type="text"
            placeholder="Task description (Editable AI suggestion)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
          </select>

          <button type="submit">
            {editingId ? "Update Task" : "Add Task"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              style={{ background: "#9ca3af" }}
            >
              Cancel
            </button>
          )}
        </form>

        {/* Practical 13: Responsible AI Disclaimer / Status Notice */}
        {aiNotice && (
          <div className={`ai-disclaimer ${aiNotice.type}`}>
            <span>
              {aiNotice.type === "success" && "🤖 "}
              {aiNotice.type === "fallback" && "🛡️ "}
              {aiNotice.type === "warning" && "⚠️ "}
              {aiNotice.text}
            </span>
          </div>
        )}

        <div className="task-list">
          {safeTasks.length === 0 ? (
            <p>No tasks found. Add a task above!</p>
          ) : (
            safeTasks.map((task) => (
              <div key={task._id || task.id} className="task-item">
                <h3>{task.title}</h3>
                <p>{task.description}</p>
                <p>
                  <strong>Priority:</strong> {task.priority}
                </p>
                <p>
                  <strong>Status:</strong>{" "}
                  {task.completed ? "Completed" : "Pending"}
                </p>
                <div className="task-actions">
                  <button onClick={() => handleEdit(task)}>Edit</button>
                  <button onClick={() => handleDelete(task._id || task.id)}>Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Tasks;
