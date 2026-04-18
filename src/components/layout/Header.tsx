"use client";

import { Link, useLocation } from 'react-router-dom';
import { BookMarked, Settings, ClipboardList, LayoutDashboard, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Baustellen' },
  { to: '/admin/aufmass', icon: Settings, label: 'Verwaltung' },
];

const Header = () => {
  const location = useLocation();
  const [theme, setTheme] = useState<'dark' | 'light'>(
    (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const isActive = (path: string) => location.pathname === path;

  // On the /aufmass page the page itself handles its own page-level header.
  // We keep the shell header ultra-slim on that route so it doesn't compete.
  const isAufmass = location.pathname === '/aufmass';

  return (
    <header className={`sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl bg-background/80 ${isAufmass ? 'h-12' : 'h-14 md:h-16'} flex items-center`}>
      <div className="w-full px-4 md:px-6 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-900/40 group-hover:shadow-emerald-700/40 transition-all duration-300">
            <BookMarked size={15} className="text-white" />
          </div>
          <span className="font-bold text-white tracking-tight text-sm hidden sm:block">Rebelein</span>
          <span className="text-white/20 text-xs hidden sm:block">|</span>
          <span className="text-white/50 text-xs hidden sm:block font-medium">Aufmaß</span>
        </Link>

        {/* Nav — pill-style, centered */}
        <nav className="hidden md:flex items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-full px-1.5 py-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                isActive(item.to)
                  ? 'bg-emerald-500 text-white shadow shadow-emerald-900/50'
                  : 'text-white/50 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <item.icon size={14} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="h-8 w-8 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </Button>

          {/* Mobile nav: just icon links */}
          <div className="flex md:hidden items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`p-2 rounded-full transition-all ${
                  isActive(item.to)
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-white/40 hover:text-white hover:bg-white/10'
                }`}
              >
                <item.icon size={17} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
