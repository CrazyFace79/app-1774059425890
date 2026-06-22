import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import type { Task } from "../lib/types";
import {
  clearUser,
  getTasks,
  getUser,
  saveTasks,
} from "../lib/storage";

type Filter = "all" | "active" | "done";

function createTask(title: string): Task {
  return {
    id: crypto.randomUUID(),
    title,
    done: false,
    createdAt: new Date().toISOString(),
  };
}

export default function Tasks() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    setEmail(user.email);
    setTasks(getTasks(user.email));
  }, [router]);

  useEffect(() => {
    if (email) saveTasks(email, tasks);
  }, [email, tasks]);

  const filtered = useMemo(() => {
    if (filter === "active") return tasks.filter((t) => !t.done);
    if (filter === "done") return tasks.filter((t) => t.done);
    return tasks;
  }, [tasks, filter]);

  const pending = tasks.filter((t) => !t.done).length;

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setTasks((prev) => [createTask(title), ...prev]);
    setNewTitle("");
  }

  function toggleTask(id: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }

  function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function handleLogout() {
    clearUser();
    router.push("/login");
  }

  if (!email) {
    return (
      <div className="auth-page">
        <p style={{ color: "var(--text-muted)" }}>Cargando...</p>
      </div>
    );
  }

  return (
    <>
      <header className="app-header">
        <h1>Mis tareas</h1>
        <div className="user">
          <span className="email">{email}</span>
          <button className="btn btn-ghost" onClick={handleLogout}>
            Salir
          </button>
        </div>
      </header>

      <main className="app-main">
        <form className="task-form" onSubmit={handleAdd}>
          <input
            type="text"
            placeholder="Nueva tarea..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            Añadir
          </button>
        </form>

        <div className="filters">
          {(["all", "active", "done"] as const).map((f) => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Todas" : f === "active" ? "Pendientes" : "Hechas"}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            {tasks.length === 0
              ? "No tienes tareas. ¡Añade la primera!"
              : "No hay tareas en este filtro."}
          </div>
        ) : (
          <ul className="task-list">
            {filtered.map((task) => (
              <li
                key={task.id}
                className={`task-item ${task.done ? "done" : ""}`}
              >
                <input
                  type="checkbox"
                  className="task-checkbox"
                  checked={task.done}
                  onChange={() => toggleTask(task.id)}
                  aria-label={`Marcar "${task.title}"`}
                />
                <span className="task-title">{task.title}</span>
                <button
                  className="btn btn-danger"
                  onClick={() => deleteTask(task.id)}
                  aria-label={`Eliminar "${task.title}"`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="stats">
          {pending} pendiente{pending !== 1 ? "s" : ""} · {tasks.length} en total
        </p>
      </main>
    </>
  );
}
