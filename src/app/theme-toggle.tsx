"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("dashreply-theme");
    const next: Theme = saved === "light" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    setReady(true);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("dashreply-theme", next);
  }

  return <button type="button" onClick={toggleTheme} aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"} title={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"} className="fixed right-4 top-4 z-[100] inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-xs font-medium text-zinc-100 shadow-lg backdrop-blur transition hover:border-violet-400 hover:bg-zinc-800">
    {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    <span>{ready ? (theme === "dark" ? "Tema claro" : "Tema escuro") : "Tema"}</span>
  </button>;
}
