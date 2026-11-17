import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Building2, Cloud, Database, GitBranch, Globe2, LockKeyhole, Server, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_unauthenticated/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="min-h-full bg-[#081525] text-white">
      <main className="mx-auto max-w-7xl px-6">
        <section className="grid items-center gap-12 py-20 md:grid-cols-[1.2fr_0.8fr] md:py-28">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-cyan-300">
              <ShieldCheck className="size-4" /> Infrastructure sovereignty for business
            </p>
            <h1 className="max-w-2xl text-5xl font-bold leading-[1.13] tracking-tight md:text-6xl">
              Your cloud. <span className="text-cyan-400">Your control.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
              MzansiCloud Private Hosting in a Box — customer-controlled infrastructure
              for your websites, applications, data and domains. Own the installation,
              choose professional management when you need it.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/login" className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-[#082034] hover:bg-cyan-300">
                Enter hosting workspace <ArrowRight className="size-4"/>
              </Link>
              <a href="#architecture" className="inline-flex items-center rounded-lg border border-white/20 px-5 py-3 text-slate-200 hover:bg-white/5">
                Explore architecture
              </a>
            </div>
            <p className="mt-5 flex items-center gap-2 text-xs text-slate-400">
              <LockKeyhole className="size-4"/> Protected operator workspace. Public self-registration is disabled.
            </p>
          </div>
          <div className="relative rounded-3xl border border-cyan-300/15 bg-[#0e263e] p-6 shadow-2xl shadow-black/30">
            <div className="mb-5 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold"><Cloud className="size-4 text-cyan-300"/> Private Hosting</span>
              <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[11px] font-medium text-emerald-300">Engineering v0.1</span>
            </div>
            <div className="space-y-3">
              {[
                { icon: <Building2 className="size-5"/>, title: "Customer tenants", subtitle: "Separate owners, policies and workspaces" },
                { icon: <Server className="size-5"/>, title: "Application environments", subtitle: "Planned, reviewed, then provisioned" },
                { icon: <Globe2 className="size-5"/>, title: "Domain management", subtitle: "Public and internal DNS separated" },
                { icon: <Database className="size-5"/>, title: "Data ownership", subtitle: "Dedicated volumes and backup policies" },
              ].map((item) => (
                <div key={item.title} className="flex items-center gap-4 rounded-xl border border-white/5 bg-[#07182a] p-4">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">{item.icon}</span>
                  <div><p className="font-semibold">{item.title}</p><p className="text-xs text-slate-400">{item.subtitle}</p></div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-400">Deployment, payment and DNS changes remain approval-gated in this engineering release.</p>
          </div>
        </section>
        <section id="architecture" className="border-t border-white/10 py-16">
          <div className="mb-9">
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">One platform · Two editions</p>
            <h2 className="mt-3 text-3xl font-bold">Built around business ownership</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#102138] p-7">
              <Building2 className="mb-5 size-9 text-cyan-300"/>
              <h3 className="text-xl font-bold">Corporate Private Hosting</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">Host public websites and private applications while maintaining customer-controlled access, storage and administrative authority.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#102138] p-7">
              <Globe2 className="mb-5 size-9 text-cyan-300"/>
              <h3 className="text-xl font-bold">Webhosting Business in a Box</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">A white-label reseller workspace for tenant hosting, domain lifecycle, billing integration and service operations.</p>
            </div>
          </div>
          <div className="mt-9 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-2"><GitBranch className="size-4 text-cyan-400"/> React 19 + Hono</span>
            <span>·</span>
            <span>Komodo</span><span>·</span><span>Technitium DNS</span><span>·</span><span>MBC Hosting Engine</span>
          </div>
        </section>
      </main>
      <footer className="border-t border-white/10 px-6 py-5 text-center text-xs text-slate-500">
        MzansiCloud · Corporate Private Hosting in a Box · Customer-owned by design
      </footer>
    </div>
  );
}
