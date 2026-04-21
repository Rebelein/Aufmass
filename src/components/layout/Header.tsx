"use client";

import { Link, useLocation } from 'react-router-dom';
import { BookMarked, Settings, ClipboardList, LayoutDashboard, Moon, Sun, Menu, Database, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { preloadCatalog } from '@/lib/catalog-storage';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Baustellen' },
  { to: '/admin/aufmass', icon: Settings, label: 'Verwaltung' },
];

const Header = () => {
  const location = useLocation();
  const { status, hideStatus } = useSyncStatus();
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
  const isAdmin = location.pathname.startsWith('/admin');
  const pageLabel = isAdmin ? 'Verwaltung' 
    : location.pathname.startsWith('/aufmass') ? 'Aufmaß' 
    : 'Aufmaß';

  if (isAufmass) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/10 backdrop-blur-[40px] shadow-[inset_0_-1px_0_rgba(255,255,255,0.05)] h-14 md:h-16 flex items-center">
      <div className="w-full px-4 md:px-6 flex items-center justify-between gap-4">

        {/* Left: Logo + optional Katalog button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Katalog burger - admin only, mobile only */}
          {isAdmin && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('toggle-catalog-sheet'))}
              className="xl:hidden p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all"
            >
              <Menu size={18} className="text-emerald-400" />
            </button>
          )}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-900/40 group-hover:shadow-emerald-700/40 transition-all duration-300">
              <BookMarked size={15} className="text-white" />
            </div>
            <span className="font-bold text-white tracking-tight text-sm hidden xl:block">Rebelein</span>
            <span className="text-white/20 text-xs hidden xl:block">|</span>
            <span className="text-white/50 text-xs hidden xl:block font-medium">{pageLabel}</span>
          </Link>
        </div>

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
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <div className="relative group/sync">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => preloadCatalog(true)}
              className={cn(
                "h-8 w-8 rounded-full transition-all relative",
                status.isVisible && !status.isInitialSync ? "text-emerald-400 bg-emerald-500/10" : "text-white/40 hover:text-emerald-400 hover:bg-white/10"
              )}
              title="Datenbank manuell synchronisieren"
            >
              <Database size={15} className={cn(status.isVisible && !status.isInitialSync && status.changesCount === 0 && "animate-spin")} />
              
              {/* Subtle status dot */}
              <AnimatePresence>
                {status.isVisible && !status.isInitialSync && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className={cn(
                      "absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-black",
                      status.changesCount > 0 ? "bg-emerald-500" : "bg-blue-500"
                    )}
                  />
                )}
              </AnimatePresence>
            </Button>

            {/* Subtle Tooltip-like popup for changes */}
            <AnimatePresence>
              {status.isVisible && !status.isInitialSync && status.changesCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.9 }}
                  className="absolute top-full mt-2 right-0 z-[100] whitespace-nowrap bg-emerald-500 text-black text-[10px] font-bold px-2 py-1 rounded-md shadow-lg pointer-events-none"
                >
                  {status.changesCount} {status.lastUpdateLabel}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

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
