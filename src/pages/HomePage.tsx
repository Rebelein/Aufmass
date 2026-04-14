import { ListChecks, ArrowRight, Activity, Database, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div className="space-y-10 md:space-y-16 py-4 md:py-8">
      {/* Hero Section */}
      <div className="text-center space-y-4 animate-in fade-in slide-in-from-top duration-700 px-4">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
          <span className="text-slate-900">Willkommen bei</span><br/>
          <span className="text-gradient-emerald">Rebelein Aufmaß</span>
        </h1>
        <p className="text-slate-600 text-base md:text-lg max-w-xl mx-auto">
          Die moderne Lösung für präzise Materialerfassung und technisches Projektmanagement.
        </p>
      </div>

      {/* Quick Stats / Info Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto px-4">
        {[
          { icon: Activity, label: "Echtzeit", value: "Aktiv", color: "text-emerald-600", bg: "bg-emerald-50" },
          { icon: Database, label: "Cloud", value: "Supabase", color: "text-teal-600", bg: "bg-teal-50" },
          { icon: Sparkles, label: "Design", value: "Modern", color: "text-cyan-600", bg: "bg-cyan-50" },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className={`p-2.5 rounded-lg ${stat.bg}`}>
              <stat.icon size={20} className={stat.color} />
            </div>
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-wider font-medium">{stat.label}</p>
              <p className="text-slate-900 font-semibold">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Action Card */}
      <div className="max-w-2xl mx-auto px-4">
        <Link to="/projects" className="block group">
          <div className="bg-white rounded-xl border border-slate-200 p-6 md:p-8 shadow-sm hover:shadow-lg hover:border-emerald-300 transition-all duration-300">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-xl shadow-lg shrink-0">
                <ListChecks className="h-8 w-8 text-white" />
              </div>

              <div className="flex-grow text-center sm:text-left space-y-2">
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                  Aufmaß starten
                </h2>
                <p className="text-slate-600 text-sm md:text-base leading-relaxed">
                  Verwalten Sie Ihre Projekte und erstellen Sie professionelle Aufmaßlisten in wenigen Minuten.
                </p>
              </div>

              <div className="shrink-0 hidden sm:block">
                <div className="p-3 rounded-full bg-slate-100 border border-slate-200 group-hover:bg-emerald-500 group-hover:border-emerald-500 transition-all duration-300">
                  <ArrowRight size={20} className="text-slate-600 group-hover:text-white transition-colors" />
                </div>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Secondary Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto px-4">
        <Link to="/admin/aufmass" className="block group">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-slate-100">
                <Sparkles size={20} className="text-slate-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">Katalog verwalten</h3>
                <p className="text-sm text-slate-500">Artikel und Kategorien bearbeiten</p>
              </div>
            </div>
          </div>
        </Link>
        
        <div className="bg-slate-100 rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-white">
              <Activity size={20} className="text-slate-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-700">Schnellzugriff</h3>
              <p className="text-sm text-slate-500">Kürzlich bearbeitete Projekte</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="text-center pt-8 px-4">
        <p className="text-slate-500 text-xs uppercase tracking-wider font-medium">
          Powered by Rebelein Aufmaß System
        </p>
      </div>
    </div>
  )
}
