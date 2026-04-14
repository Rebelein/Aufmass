import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import Link from 'next/link';
import { LayoutDashboard, ListChecks, Settings, BookMarked } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Rebelein Aufmaß',
  description: 'Modernes Aufmaß-Management für das Handwerk.',
};

export const viewport: Viewport = {
  themeColor: '#10B981',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="light">
      <body className="bg-slate-50 min-h-screen flex flex-col md:flex-row">
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 shadow-sm">
          {/* Logo */}
          <div className="flex items-center gap-3 p-6 border-b border-slate-100">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center shadow-sm">
              <BookMarked size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold text-gradient-emerald">
              Rebelein
            </span>
          </div>
          
          {/* Navigation Links */}
          <nav className="flex flex-col gap-1 p-4 flex-grow">
            <NavLink href="/" icon={<LayoutDashboard size={20} />} label="Dashboard" />
            <NavLink href="/projects" icon={<ListChecks size={20} />} label="Aufmaß" />
            <NavLink href="/admin/aufmass" icon={<Settings size={20} />} label="Admin" />
          </nav>
          
          {/* Footer */}
          <div className="p-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center">
              Aufmaß System v1.0
            </p>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 md:ml-64 pb-20 md:pb-8 min-h-screen">
          <div className="container mx-auto px-4 py-6 md:py-8">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-around py-2 px-4">
            <MobileNavLink href="/" icon={<LayoutDashboard size={22} />} label="Home" />
            <MobileNavLink href="/projects" icon={<ListChecks size={22} />} label="Aufmaß" />
            <MobileNavLink href="/admin/aufmass" icon={<Settings size={22} />} label="Admin" />
          </div>
        </nav>

        <Toaster />
      </body>
    </html>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors font-medium aria-[current=page]:bg-emerald-50 aria-[current=page]:text-emerald-700 aria-[current=page]:font-semibold"
      aria-current="page"
    >
      <span className="aria-[current=page]:text-emerald-600">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function MobileNavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1 py-2 px-4 rounded-lg text-slate-500 hover:text-slate-700 transition-colors flex-1 aria-[current=page]:text-emerald-600 aria-[current=page]:font-semibold"
      aria-current="page"
    >
      <span className="aria-[current=page]:text-emerald-600">{icon}</span>
      <span className="text-xs">{label}</span>
    </Link>
  );
}
