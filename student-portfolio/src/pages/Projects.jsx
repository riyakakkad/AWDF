import { useState, useEffect } from "react";
import Spinner from "../components/Spinner";
import ErrorMessage from "../components/ErrorMessage";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
} from "../api";

function Projects() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("low");

  const [editingId, setEditingId] = useState(null);

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
    <div>
      <h1>My Tasks</h1>

      <form onSubmit={editingId ? handleUpdate : handleCreate}>
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
          <option value="low">Low</option>
          <option value="high">High</option>
        </select>

        <button type="submit">
          {editingId ? "Update Task" : "Add Task"}
        </button>
      </form>

      {tasks.map((task) => (
        <div key={task._id}>
          <h3>{task.title}</h3>

          <p>{task.description}</p>

          <p>
            <strong>Priority:</strong> {task.priority}
          </p>

          <p>
            <strong>Status:</strong>{" "}
            {task.completed ? "Completed" : "Pending"}
          </p>

          <button onClick={() => handleEdit(task)}>
            Edit
          </button>

          <button onClick={() => handleDelete(task._id)}>
            Delete
          </button>

          <hr />
        </div>
      ))}
    </div>
  );
}

export default Projects;