import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const savedTheme = localStorage.getItem('nexus-theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('nexus-theme', theme);
      const root = document.documentElement;
      if (theme === 'light') {
        root.classList.add('light');
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      } else {
        root.classList.add('dark');
        root.classList.remove('light');
        root.style.colorScheme = 'dark';
      }
    } catch {
      // storage unavailable
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return { theme, setTheme, toggleTheme };
}
