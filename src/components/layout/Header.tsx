"use client";

import { Link } from 'react-router-dom';
import { BookMarked, Settings, ListChecks, LayoutDashboard, Menu } from 'lucide-react';
import { useState } from 'react';
import { latestVersion } from '@/lib/whats-new-data';
import WhatsNewDialog from '@/components/dialogs/WhatsNewDialog';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger, SheetClose } from '@/components/ui/sheet';

const Header = () => {
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);

  return (
    <>
      <header className="bg-card text-card-foreground shadow-sm border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 h-16">
                <BookMarked size={40} className="text-primary"/>
                <h1 className="text-2xl font-headline font-bold text-primary">Rebelein</h1>
            </Link>
             <button
              onClick={() => setIsWhatsNewOpen(true)}
              className="text-xs font-mono bg-muted hover:bg-muted/80 text-muted-foreground px-2 py-1 rounded-md transition-colors"
              title="Was ist neu? anzeigen"
            >
              v{latestVersion}
            </button>
          </div>
          
          <nav className="hidden md:flex items-center gap-1">
            <Link to="/" className="text-foreground hover:bg-muted transition-colors flex items-center gap-1 p-2 rounded-md">
                <LayoutDashboard size={20} />
                <span className="font-body">Dashboard</span>
            </Link>
            <Link to="/projects" className="text-foreground hover:bg-muted transition-colors flex items-center gap-1 p-2 rounded-md">
                <ListChecks size={20} />
                <span className="font-body">Aufmaß</span>
            </Link>
            <Link to="/admin/aufmass" className="text-foreground hover:bg-muted transition-colors flex items-center gap-1 p-2 rounded-md">
              <Settings size={20} />
              <span className="font-body">Verwaltung</span>
            </Link>
          </nav>
          
          <div className="md:hidden">
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <Menu className="h-6 w-6" />
                        <span className="sr-only">Menü öffnen</span>
                    </Button>
                </SheetTrigger>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle className="sr-only">Hauptmenü</SheetTitle>
                        <SheetDescription className="sr-only">Wählen Sie einen Bereich aus, um dorthin zu navigieren.</SheetDescription>
                    </SheetHeader>
                    <nav className="flex flex-col gap-2 mt-8 text-lg">
                        <SheetClose asChild>
                            <Link to="/" className="text-foreground hover:bg-muted transition-colors flex items-center gap-2 p-3 rounded-md text-base">
                                <LayoutDashboard size={20} />
                                <span className="font-body">Dashboard</span>
                            </Link>
                        </SheetClose>
                        <SheetClose asChild>
                            <Link to="/projects" className="text-foreground hover:bg-muted transition-colors flex items-center gap-2 p-3 rounded-md text-base">
                                <ListChecks size={20} />
                                <span className="font-body">Aufmaß</span>
                            </Link>
                        </SheetClose>
                        <SheetClose asChild>
                            <Link to="/admin/aufmass" className="text-foreground hover:bg-muted transition-colors flex items-center gap-2 p-3 rounded-md text-base">
                                <Settings size={20} />
                                <span className="font-body">Verwaltung</span>
                            </Link>
                        </SheetClose>
                    </nav>
                </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <div className="bg-card shadow-sm -mt-px">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 64" className="block w-full text-primary -mb-1">
            <path fill="currentColor" d="M0,32L120,37.3C240,43,480,53,720,53.3C960,53,1200,43,1320,37.3L1440,32L1440,0L1320,0C1200,0,960,0,720,0C480,0,240,0,120,0L0,0Z"></path>
        </svg>
      </div>
      <WhatsNewDialog isOpen={isWhatsNewOpen} onClose={() => setIsWhatsNewOpen(false)} />
    </>
  );
};

export default Header;
