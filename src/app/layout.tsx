import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import Link from 'next/link';
import { LayoutDashboard, ListChecks, Settings, BookMarked } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Rebelein Aufmaß',
  description: 'Modernes Aufmaß-Management im Glassmorphism Design.',
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="dark">
      <body className="bg-[#0f172a] text-white min-h-screen relative overflow-x-hidden">
        {/* Ambient Light Blobs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[-10%] -left-10 w-72 h-72 bg-emerald-600 rounded-full mix-blend-multiply filter blur-[100px] opacity-30 animate-blob"></div>
          <div className="absolute top-[-10%] -right-10 w-72 h-72 bg-teal-600 rounded-full mix-blend-multiply filter blur-[100px] opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-[-10%] left-20 w-72 h-72 bg-cyan-600 rounded-full mix-blend-multiply filter blur-[100px] opacity-30 animate-blob animation-delay-4000"></div>
        </div>

        {/* Main Content Area */}
        <main className="pb-32 pt-8 container mx-auto px-4 relative z-10">
          {children}
        </main>

        {/* Floating Island Navigation */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md">
          <nav className="glass-card bg-gray-900/40 backdrop-blur-2xl border-white/10 px-6 py-4 flex items-center justify-around shadow-2xl">
            <Link href="/" className="flex flex-col items-center gap-1 group">
              <div className="p-2 rounded-xl group-hover:bg-white/10 transition-colors">
                <LayoutDashboard size={24} className="text-white/70 group-hover:text-emerald-400 transition-colors" />
              </div>
              <span className="text-[10px] uppercase tracking-wider font-medium text-white/50 group-hover:text-white transition-colors">Home</span>
            </Link>
            <Link href="/projects" className="flex flex-col items-center gap-1 group">
              <div className="p-2 rounded-xl group-hover:bg-white/10 transition-colors">
                <ListChecks size={24} className="text-white/70 group-hover:text-emerald-400 transition-colors" />
              </div>
              <span className="text-[10px] uppercase tracking-wider font-medium text-white/50 group-hover:text-white transition-colors">Aufmaß</span>
            </Link>
            <Link href="/admin/aufmass" className="flex flex-col items-center gap-1 group">
              <div className="p-2 rounded-xl group-hover:bg-white/10 transition-colors">
                <Settings size={24} className="text-white/70 group-hover:text-emerald-400 transition-colors" />
              </div>
              <span className="text-[10px] uppercase tracking-wider font-medium text-white/50 group-hover:text-white transition-colors">Admin</span>
            </Link>
          </nav>
        </div>

        <Toaster />
      </body>
    </html>
  );
}
