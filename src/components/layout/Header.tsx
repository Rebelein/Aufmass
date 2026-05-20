"use client";

import { Link, useLocation } from 'react-router-dom';
import { BookMarked, Settings, LayoutDashboard, Moon, Sun, Menu, Database } from 'lucide-react';
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

export default function Header() {
  const location = useLocation();
  const { status } = useSyncStatus();
  const [theme, setTheme] = useState<'dark' | 'light'>(
    (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
  );

  useEffect(() => {
    const handleThemeChange = () => {
      const storedTheme = localStorage.getItem('theme') as 'dark' | 'light';
      if (storedTheme && storedTheme !== theme) {
        setTheme(storedTheme);
      }
    };
    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
    window.dispatchEvent(new Event('theme-change'));
  }, [theme]);

  const isActive = (path: string) => location.pathname === path;

  // On the /aufmass page the page itself handles its own page-level header.
  const isAufmass = location.pathname === '/aufmass';
  const isAdmin = location.pathname.startsWith('/admin');
  const pageLabel = isAdmin ? 'Verwaltung' 
    : location.pathname.startsWith('/aufmass') ? 'Aufmaß' 
    : 'Aufmaß';

  if (isAufmass) return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4 md:px-6">
        {/* Logo Section */}
        <div className="flex items-center gap-4 md:gap-6 mr-6">
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.dispatchEvent(new CustomEvent('toggle-catalog-sheet'))}
              className="xl:hidden h-9 w-9"
            >
              <Menu size={18} />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          )}
          <Link to="/" className="flex items-center space-x-2.5 group shrink-0">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm transition-all duration-300 group-hover:shadow-emerald-500/25 group-hover:scale-105">
              <BookMarked size={18} className="text-foreground" />
            </div>
            <div className="hidden flex-col sm:flex">
              <span className="font-bold tracking-tight text-sm leading-none">Rebelein</span>
              <span className="text-xs text-muted-foreground mt-1 font-medium">{pageLabel}</span>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex flex-1 items-center gap-1">
          {navItems.map((item) => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors hover:text-foreground",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="header-active-tab"
                    className="absolute inset-0 rounded-full bg-secondary"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <item.icon size={16} />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Actions / Right Side */}
        <div className="flex flex-1 items-center justify-end space-x-2">
          {/* Sync Status Button */}
          <div className="relative group/sync">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => preloadCatalog(true)}
              className={cn(
                "h-9 w-9 rounded-full transition-all",
                status.isVisible && !status.isInitialSync ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10" : "text-muted-foreground"
              )}
              title="Datenbank manuell synchronisieren"
            >
              <Database size={18} className={cn(status.isVisible && !status.isInitialSync && status.changesCount === 0 && "animate-spin")} />
              
              <AnimatePresence>
                {status.isVisible && !status.isInitialSync && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className={cn(
                      "absolute top-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-background",
                      status.changesCount > 0 ? "bg-emerald-500" : "bg-blue-500"
                    )}
                  />
                )}
              </AnimatePresence>
            </Button>

            <AnimatePresence>
              {status.isVisible && !status.isInitialSync && status.changesCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.9 }}
                  className="absolute top-full mt-2 right-0 z-[100] whitespace-nowrap bg-emerald-500 text-emerald-950 text-[10px] font-bold px-2.5 py-1 rounded-md shadow-sm pointer-events-none"
                >
                  {status.changesCount} {status.lastUpdateLabel}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="h-9 w-9 rounded-full relative text-muted-foreground hover:text-foreground flex items-center justify-center overflow-hidden"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={theme}
                initial={{ y: -20, opacity: 0, rotate: -90 }}
                animate={{ y: 0, opacity: 1, rotate: 0 }}
                exit={{ y: 20, opacity: 0, rotate: 90 }}
                transition={{ duration: 0.2 }}
                className="absolute flex items-center justify-center"
              >
                {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
              </motion.div>
            </AnimatePresence>
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* Mobile Navigation */}
          <div className="flex md:hidden items-center ml-2 border-l border-border pl-2">
            {navItems.map((item) => {
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "relative p-2 rounded-full transition-colors",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="header-active-tab-mobile"
                      className="absolute inset-0 rounded-full bg-secondary"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <span className="relative z-10">
                    <item.icon size={20} />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
