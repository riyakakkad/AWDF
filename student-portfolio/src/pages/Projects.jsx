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

function Projects() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("low");

  const [editingId, setEditingId] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Practical 13: AI Assistant States
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNotice, setAiNotice] = useState(null);

  useEffect(() => {
    getTasks()
      .then((data) => {
        setTasks(data);
      })
      .catch(() => {
        console.warn("Backend API offline at http://localhost:5000, using sample tasks for preview.");
        setTasks(SAMPLE_TASKS);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const newTask = await createTask({
        title,
        description,
        priority,
      });
      setTasks((prev) => [...prev, newTask]);
    } catch {
      // Offline fallback
      const offlineTask = {
        _id: String(Date.now()),
        title,
        description,
        priority,
        completed: false,
      };
      setTasks((prev) => [...prev, offlineTask]);
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
    setEditingId(task._id || task.id);
    setTitle(task.title);
    setDescription(task.description);
    setPriority(task.priority);
    setAiNotice(null);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    try {
      const updatedTask = await updateTask(editingId, {
        title,
        description,
        priority,
        completed: false,
      });

      setTasks((prev) =>
        prev.map((task) =>
          (task._id || task.id) === editingId ? updatedTask : task
        )
      );
    } catch {
      // Offline fallback
      setTasks((prev) =>
        prev.map((task) =>
          (task._id || task.id) === editingId
            ? { ...task, title, description, priority }
            : task
        )
      );
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
    } catch {
      console.warn("Backend offline, removing task from local state.");
    }
    setTasks((prev) => prev.filter((task) => (task._id || task.id) !== id));
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="container">
      <div className="card">
        <h1>My Tasks & Projects</h1>

        <button
          className="analytics-toggle-btn"
          onClick={() => setShowAnalytics(!showAnalytics)}
        >
          {showAnalytics ? "Hide Analytics Chart" : "📈 Show Analytics Chart (Lazy Loaded)"}
        </button>

        {showAnalytics && (
          <Suspense fallback={<div className="spinner">Loading chart chunk...</div>}>
            <TaskAnalyticsChart tasks={tasks} />
          </Suspense>
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
            <option value="high">High Priority</option>
          </select>

          <button type="submit">
            {editingId ? "Update Task" : "Add Task"}
          </button>
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
          {tasks.length === 0 ? (
            <p>No tasks found. Add a task above!</p>
          ) : (
            tasks.map((task) => (
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

export default Projects;