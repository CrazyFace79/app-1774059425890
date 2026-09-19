import { create } from "zustand"

interface UIState {
  activeTab: string
  theme: "dark" | "light"
  hotkeysEnabled: boolean
  setActiveTab: (tab: string) => void
  setTheme: (theme: "dark" | "light") => void
  setHotkeysEnabled: (enabled: boolean) => void
}

export const useUIStore = create<UIState>()((set) => ({
  activeTab: "generator",
  theme: "dark",
  hotkeysEnabled: true,
  setActiveTab: (tab) => set({ activeTab: tab }),
  setTheme: (theme) => set({ theme }),
  setHotkeysEnabled: (enabled) => set({ hotkeysEnabled: enabled }),
}))
