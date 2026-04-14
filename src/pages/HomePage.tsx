import { ListChecks, ArrowRight, Activity, Database, Sparkles, Zap } from "lucide-react";
import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="orb orb-emerald w-96 h-96 -top-20 -left-20" style={{ animationDelay: '0s' }} />
        <div className="orb orb-teal w-80 h-80 top-1/2 -right-20" style={{ animationDelay: '-2s' }} />
        <div className="orb orb-emerald w-64 h-64 bottom-20 left-1/3" style={{ animationDelay: '-4s' }} />
      </div>

      <div className="relative z-10 space-y-12 md:space-y-20 py-8 md:py-12">
        {/* Hero Section */}
        <div className="text-center space-y-6 animate-in fade-in slide-in-from-top duration-700 px-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card-light text-sm font-medium text-white/90 mb-4">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Schnelle Materialerfassung für Monteure</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
            <span className="text-gradient-white">Rebelein</span>
            <br />
            <span className="text-gradient-emerald">Aufmaß</span>
          </h1>
          
          <p className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Die moderne Lösung für präzise Materialerfassung. 
            Erstellen Sie professionelle Aufmaßlisten in Minuten.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto px-4">
          {[
            { icon: Activity, label: "Echtzeit-Sync", value: "Cloud-basiert", gradient: "from-emerald-500 to-teal-500" },
            { icon: Database, label: "Supabase", value: "Backend", gradient: "from-teal-500 to-cyan-500" },
            { icon: Sparkles, label: "Modern", value: "iOS-Design", gradient: "from-cyan-500 to-blue-500" },
          ].map((stat, i) => (
            <div key={i} className="ios-card p-5 flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                <stat.icon size={22} className="text-white" />
              </div>
              <div>
                <p className="text-white/50 text-xs uppercase tracking-wider font-medium">{stat.label}</p>
                <p className="text-white font-semibold text-lg">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Main Action Card */}
        <div className="max-w-2xl mx-auto px-4">
          <Link to="/projects" className="block group">
            <div className="glass-card p-8 md:p-10">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="bg-gradient-to-br from-emerald-400 to-teal-500 p-6 rounded-2xl shadow-xl shrink-0 transform group-hover:scale-110 transition-transform duration-500">
                  <ListChecks className="h-10 w-10 text-white" />
                </div>
                <div className="flex-grow text-center sm:text-left space-y-3">
                  <h2 className="text-2xl md:text-3xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                    Aufmaß starten
                  </h2>
                  <p className="text-white/60 text-base md:text-lg leading-relaxed">
                    Verwalten Sie Ihre Projekte und erstellen Sie Aufmaßlisten für Materialbestellungen.
                  </p>
                </div>
                <div className="shrink-0 hidden sm:block">
                  <div className="p-4 rounded-2xl bg-white/10 border border-white/10 group-hover:bg-emerald-500/30 group-hover:border-emerald-400/50 transition-all duration-500">
                    <ArrowRight size={24} className="text-white/70 group-hover:text-white transition-colors" />
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Secondary Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto px-4">
          <Link to="/admin/aufmass" className="block group">
            <div className="ios-card p-6">
              <div className="flex items-center gap-5">
                <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-white/10">
                  <Sparkles size={24} className="text-purple-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg group-hover:text-emerald-300 transition-colors">
                    Katalog verwalten
                  </h3>
                  <p className="text-sm text-white/50">Artikel & Kategorien bearbeiten</p>
                </div>
              </div>
            </div>
          </Link>
          
          <div className="ios-card p-6 opacity-70">
            <div className="flex items-center gap-5">
              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 border border-white/10">
                <Activity size={24} className="text-amber-300" />
              </div>
              <div>
                <h3 className="font-semibold text-white/80 text-lg">Demnächst</h3>
                <p className="text-sm text-white/40">Letzte Projekte</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center pt-12 px-4">
          <p className="text-white/30 text-xs uppercase tracking-wider font-medium">
            Powered by Rebelein Aufmaß System
          </p>
        </div>
      </div>
    </div>
  );
}
