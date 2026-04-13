'use client';
import { ListChecks, ArrowRight, Activity, Database, Sparkles } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
    return (
        <div className="space-y-12 py-10">
            {/* Hero Section */}
            <div className="text-center space-y-4 animate-in fade-in slide-in-from-top duration-700">
                <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
                    <span className="text-gradient">Willkommen bei</span><br/>
                    <span className="text-gradient-emerald">Rebelein Aufmaß</span>
                </h1>
                <p className="text-white/60 text-lg max-w-xl mx-auto font-medium">
                    Die moderne Lösung für präzise Materialerfassung und technisches Projektmanagement.
                </p>
            </div>

            {/* Quick Stats / Info Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                {[
                    { icon: Activity, label: "Echtzeit", value: "Aktiv", color: "text-emerald-400" },
                    { icon: Database, label: "Cloud", value: "Supabase", color: "text-teal-400" },
                    { icon: Sparkles, label: "Design", value: "Modern", color: "text-cyan-400" },
                ].map((stat, i) => (
                    <div key={i} className="glass-card p-4 flex items-center gap-4 border-white/5">
                        <div className={`p-2 rounded-lg bg-white/5 ${stat.color}`}>
                            <stat.icon size={20} />
                        </div>
                        <div>
                            <p className="text-white/40 text-xs uppercase tracking-wider font-bold">{stat.label}</p>
                            <p className="text-white font-semibold">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Action Card */}
            <div className="max-w-2xl mx-auto group">
                <Link href="/projects">
                    <div className="glass-card p-8 relative overflow-hidden transition-all duration-500 group-hover:shadow-[0_0_50px_rgba(16,185,129,0.2)] group-hover:border-emerald-500/50">
                        {/* Decorative background element */}
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-colors"></div>
                        
                        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-3xl shadow-lg shadow-emerald-900/20">
                                <ListChecks className="h-12 w-12 text-white" />
                            </div>
                            
                            <div className="flex-grow text-center md:text-left space-y-2">
                                <h2 className="text-2xl font-bold text-white group-hover:text-emerald-300 transition-colors">Aufmaß starten</h2>
                                <p className="text-white/60 leading-relaxed">
                                    Verwalten Sie Ihre Projekte und erstellen Sie professionelle Aufmaßlisten in wenigen Minuten.
                                </p>
                            </div>
                            
                            <div className="shrink-0">
                                <div className="p-3 rounded-full bg-white/5 border border-white/10 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                                    <ArrowRight size={24} />
                                </div>
                            </div>
                        </div>
                    </div>
                </Link>
            </div>

            {/* Footer Note */}
            <div className="text-center pt-12">
                <p className="text-white/20 text-xs uppercase tracking-[0.2em] font-bold">Powered by Rebelein Design System</p>
            </div>
        </div>
    )
}
