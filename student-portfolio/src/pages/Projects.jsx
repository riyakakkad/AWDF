import { useState, useEffect, lazy, Suspense } from "react";
import Spinner from "../components/Spinner";
import ErrorMessage from "../components/ErrorMessage";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
} from "../api";
import { lazyWithDelay } from "../utils/lazyWithDelay";

// Component-level Code Splitting: Lazy load heavy analytics chart
const TaskAnalyticsChart = lazyWithDelay(() => import("../components/TaskAnalyticsChart"));

function Projects() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("low");

  const [editingId, setEditingId] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  useEffect(() => {
    getTasks()
      .then((data) => {
        setTasks(data);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();

    try {
      const newTask = await createTask({
        title,
        description,
        priority,
      });

      setTasks([...tasks, newTask]);

      setTitle("");
      setDescription("");
      setPriority("low");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (task) => {
    setEditingId(task._id);
    setTitle(task.title);
    setDescription(task.description);
    setPriority(task.priority);
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

      setTasks(
        tasks.map((task) =>
          task._id === editingId ? updatedTask : task
        )
      );

      setEditingId(null);
      setTitle("");
      setDescription("");
      setPriority("low");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteTask(id);

      setTasks(tasks.filter((task) => task._id !== id));
    } catch (err) {
      setError(err.message);
    }
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
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <input
            type="text"
            placeholder="Task description"
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