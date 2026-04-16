"use client";

import { Link, useLocation } from 'react-router-dom';
import { BookMarked, Settings, ListChecks, LayoutDashboard, Menu, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { useState, useEffect } from 'react';

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

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Home' },
    { to: '/projects', icon: ListChecks, label: 'Aufmaß' },
    { to: '/admin/aufmass', icon: Settings, label: 'Verwaltung' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="glass-nav sticky top-0 z-50">
      <div className="w-full px-4 md:px-6">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg transform group-hover:scale-105 transition-transform duration-300">
              <BookMarked size={24} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-gradient-emerald">Rebelein</span>
              <span className="text-xs text-white/40 font-medium tracking-wide">Aufmaß</span>
            </div>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 mr-4">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                    isActive(item.to)
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-white/70 hover:text-white hover:bg-white/10 rounded-xl"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </Button>

            {/* Mobile Menu */}
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10 rounded-xl">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Menü öffnen</span>
                  </Button>
                </SheetTrigger>
                <SheetContent className="glass-card border-l border-white/10 bg-slate-900/95">
                  <SheetHeader>
                    <SheetTitle className="text-gradient-emerald text-left">Navigation</SheetTitle>
                    <SheetDescription className="text-white/50 text-left">
                      Wählen Sie einen Bereich aus
                    </SheetDescription>
                  </SheetHeader>
                  <nav className="flex flex-col gap-2 mt-6">
                    {navItems.map((item) => (
                      <SheetClose key={item.to} asChild>
                        <Link
                          to={item.to}
                          className={`flex items-center gap-3 p-4 rounded-xl font-medium transition-all duration-300 ${
                            isActive(item.to)
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'text-white/70 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <item.icon size={22} />
                          <span className="text-lg">{item.label}</span>
                        </Link>
                      </SheetClose>
                    ))}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
