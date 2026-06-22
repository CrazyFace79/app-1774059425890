import type { Task, User } from "./types";

const USER_KEY = "ai-app-user";
const tasksKey = (email: string) => `ai-app-tasks:${email}`;

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearUser(): void {
  localStorage.removeItem(USER_KEY);
}

export function getTasks(email: string): Task[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(tasksKey(email));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Task[];
  } catch {
    return [];
  }
}

export function saveTasks(email: string, tasks: Task[]): void {
  localStorage.setItem(tasksKey(email), JSON.stringify(tasks));
}
