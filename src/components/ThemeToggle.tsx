'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return <div className="w-[72px] h-7" />; // Placeholder to prevent layout shift
  }

  return (
    <div className="flex items-center gap-1 bg-white/10 p-0.5 rounded-md">
      <button
        onClick={() => setTheme('light')}
        className={`p-1 rounded transition-colors ${
          theme === 'light'
            ? 'bg-white/20 text-white'
            : 'text-white/40 hover:text-white/80'
        }`}
        title="Light Mode"
      >
        <Sun size={13} />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`p-1 rounded transition-colors ${
          theme === 'system'
            ? 'bg-white/20 text-white'
            : 'text-white/40 hover:text-white/80'
        }`}
        title="System Theme"
      >
        <Monitor size={13} />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`p-1 rounded transition-colors ${
          theme === 'dark'
            ? 'bg-white/20 text-white'
            : 'text-white/40 hover:text-white/80'
        }`}
        title="Dark Mode"
      >
        <Moon size={13} />
      </button>
    </div>
  );
}