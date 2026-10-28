"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("dashreply-theme");
    const next: Theme = saved === "dark" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    setReady(true);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("dashreply-theme", next);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#09090b" : "#f3f5fb");
  }

  return <button type="button" onClick={toggleTheme} aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"} title={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"} className="theme-toggle inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition">
    {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    <span>{ready ? (theme === "dark" ? "Tema claro" : "Tema escuro") : "Tema"}</span>
  </button>;
}
