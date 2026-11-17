import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Activity, ArrowRight, Building2, Container,
  Globe2, HardDrive, Layers3, LockKeyhole, Plus, RefreshCw, Server,
  ShieldCheck, Network,
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { hostingRequest, type HostingOverview, type Tenant } from "@/lib/hosting-client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const empty: HostingOverview = {
  tenants: [], domains: [], applications: [], integrations: [],
  policy: "Draft records only", counts: { tenants: 0, domains: 0, applications: 0 },
};

function DashboardPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<HostingOverview>(empty);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState<"tenant" | "domain" | "app">("tenant");
  const [tenantName, setTenantName] = useState("");
  const [edition, setEdition] = useState("corporate");
  const [tenantId, setTenantId] = useState("");
  const [domainName, setDomainName] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [appName, setAppName] = useState("");
  const [runtime, setRuntime] = useState("container");
  const [source, setSource] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await hostingRequest<HostingOverview>("/overview");
      setData(result);
      setTenantId((old) => old || result.tenants[0]?.id || "");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load hosting information");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const createRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      if (form === "tenant") {
        await hostingRequest("/tenants", { name: tenantName, edition });
        setTenantName("");
        setMessage("Customer tenant saved as draft.");
      } else if (form === "domain") {
        await hostingRequest("/domains", { tenantId, fqdn: domainName, visibility });
        setDomainName("");
        setMessage("Domain recorded. DNS was not changed.");
      } else {
        await hostingRequest("/applications", { tenantId, name: appName, runtime, source });
        setAppName("");
        setSource("");
        setMessage("Application saved. Nothing was deployed.");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save record");
    } finally {
      setSubmitting(false);
    }
  };

  const tenantLabel = (id: string) =>
    data.tenants.find((tenant) => tenant.id === id)?.name ?? "Unknown customer";

  return (
    <div className="min-h-full bg-[#081525] text-[#e5effa]">
      <div className="border-b border-white/10 bg-[#0c1c2e]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-7">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">
              <span className="size-2 rounded-full bg-cyan-400" />
              Corporate private hosting / Command centre
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              Your infrastructure. Your control.
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Customer-owned hosting workspace · {session?.user?.name ?? "Operator"} · Infrastructure records
            </p>
          </div>
          <button onClick={() => void refresh()} className="flex items-center gap-2 rounded-lg border border-cyan-700/50 bg-cyan-950/40 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-900/50" disabled={loading}>
            <RefreshCw className={"size-4 " + (loading ? "animate-spin" : "")} /> Refresh status
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-5 py-3 text-sm text-amber-100">
          <span className="inline-flex items-center gap-2 font-semibold"><LockKeyhole className="size-4" /> Safe engineering mode</span>
          <span className="ml-2 text-amber-100/80">Tenant, domain and application records are persistent drafts. No payment capture, production deployment or DNS mutation is enabled.</span>
        </div>
        {message && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</div>}
        {error && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<Building2 className="size-5" />} label="Customer tenants" number={data.counts.tenants} detail="Customer-owned environments" />
          <Metric icon={<Globe2 className="size-5" />} label="Registered domains" number={data.counts.domains} detail="Public and internal zones" />
          <Metric icon={<Container className="size-5" />} label="Applications" number={data.counts.applications} detail="Deployments planned" />
          <Metric icon={<ShieldCheck className="size-5" />} label="Connected services" number={data.integrations.filter((x) => x.state === "reachable").length} detail="Live adapter reachability" />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
          <section className="rounded-2xl border border-white/10 bg-[#11233a] p-5 shadow-lg shadow-black/10">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><Layers3 className="size-5 text-cyan-400" /> Customer tenants</h2>
                <p className="mt-1 text-xs text-slate-400">Isolated by customer ownership, not just a shared project folder.</p>
              </div>
              <span className="rounded-full bg-slate-700/50 px-3 py-1 text-xs text-slate-300">{data.tenants.length} records</span>
            </div>
            <div className="mt-5 overflow-x-auto">
              {data.tenants.length === 0 ? <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/15 py-12 text-center"><Building2 className="mb-3 size-10 text-cyan-500/50"/><p className="font-medium">No customer tenants yet</p><p className="mt-1 text-sm text-slate-400">Create your first corporate workspace on the right.</p></div> :
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400"><th className="py-3 font-medium">Customer</th><th className="py-3 font-medium">Edition</th><th className="py-3 font-medium">State</th></tr></thead>
                <tbody>{data.tenants.map((t: Tenant) => <tr key={t.id} className="border-b border-white/5 last:border-0">
                  <td className="py-4 font-medium text-white">{t.name}<span className="block font-normal text-xs text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</span></td>
                  <td className="py-4 capitalize text-slate-300">{t.edition}</td>
                  <td className="py-4"><StatePill state={t.status}/></td>
                </tr>)}</tbody>
              </table>}
            </div>
          </section>
          <section className="rounded-2xl border border-cyan-400/20 bg-[#102840] p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><Plus className="size-5 text-cyan-300"/> Add to workspace</h2>
            <p className="mt-1 text-xs text-slate-400">Save real records; provisioning remains approval-gated.</p>
            <div className="mt-5 flex flex-wrap gap-1 rounded-lg bg-[#09192b] p-1">
              {(["tenant","domain","app"] as const).map((choice) =>
                <button key={choice} type="button" onClick={() => { setForm(choice);setError("");setMessage(""); }} className={"flex-1 rounded-md px-2 py-2 text-sm capitalize transition " + (form === choice ? "bg-cyan-600 text-white" : "text-slate-300 hover:bg-white/5")}>{choice === "app" ? "App" : choice}</button>
              )}
            </div>
            <form onSubmit={(e) => void createRecord(e)} className="mt-5 space-y-4">
              {form === "tenant" ? <>
                <Field label="Customer / company name"><input className="mzc-input" required minLength={2} maxLength={120} placeholder="Example: Acme Private Cloud" value={tenantName} onChange={(e) => setTenantName(e.target.value)} /></Field>
                <Field label="Hosting edition"><select className="mzc-input" value={edition} onChange={(e) => setEdition(e.target.value)}><option value="corporate">Corporate Private</option><option value="reseller">Webhosting Business in a Box</option></select></Field>
              </> : <>
                <Field label="Customer tenant"><select className="mzc-input" required value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
                  <option value="">Select customer...</option>{data.tenants.map((t) => <option value={t.id} key={t.id}>{t.name}</option>)}
                </select></Field>
                {form === "domain" ? <>
                  <Field label="Fully qualified domain"><input className="mzc-input" required placeholder="portal.example.co.za" value={domainName} onChange={(e) => setDomainName(e.target.value)} /></Field>
                  <Field label="Visibility"><select className="mzc-input" value={visibility} onChange={(e) => setVisibility(e.target.value)}><option value="public">Public</option><option value="internal">Internal / VPN only</option></select></Field>
                </> : <>
                  <Field label="Application name"><input className="mzc-input" required placeholder="Customer portal" value={appName} onChange={(e) => setAppName(e.target.value)} /></Field>
                  <Field label="Runtime"><select className="mzc-input" value={runtime} onChange={(e) => setRuntime(e.target.value)}>{["container","node","python","wordpress","static"].map((x) => <option value={x} key={x}>{x}</option>)}</select></Field>
                  <Field label="Source repository (optional)"><input className="mzc-input" placeholder="https://git.example/repo" value={source} onChange={(e) => setSource(e.target.value)} /></Field>
                </>}
              </>}
              <button type="submit" disabled={submitting || (form !== "tenant" && !tenantId)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-3 font-semibold text-[#062033] transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40">
                <Plus className="size-4" /> {submitting ? "Saving..." : form === "tenant" ? "Create tenant draft" : form === "domain" ? "Save domain record" : "Save app record"} <ArrowRight className="ml-1 size-4" />
              </button>
            </form>
          </section>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <section className="rounded-2xl border border-white/10 bg-[#11233a] p-5 lg:col-span-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><Network className="size-5 text-cyan-300" /> Domains and applications</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-[#09192b] p-4">
                <h3 className="mb-3 flex items-center gap-2 font-semibold"><Globe2 className="size-4 text-cyan-400"/> Domains</h3>
                {data.domains.length === 0 ? <p className="text-sm text-slate-500">No domain records yet.</p> : data.domains.map((x) => <div key={x.id} className="border-t border-white/10 py-3"><div className="flex items-center justify-between gap-2"><p className="truncate font-medium text-white">{x.fqdn}</p><StatePill state={x.status}/></div><p className="mt-1 text-xs text-slate-400">{tenantLabel(x.tenantId)} · {x.visibility}</p></div>)}
              </div>
              <div className="rounded-xl bg-[#09192b] p-4">
                <h3 className="mb-3 flex items-center gap-2 font-semibold"><Container className="size-4 text-cyan-400"/> Applications</h3>
                {data.applications.length === 0 ? <p className="text-sm text-slate-500">No application records yet.</p> : data.applications.map((x) => <div key={x.id} className="border-t border-white/10 py-3"><div className="flex items-center justify-between gap-2"><p className="truncate font-medium text-white">{x.name}</p><StatePill state={x.status}/></div><p className="mt-1 text-xs text-slate-400">{tenantLabel(x.tenantId)} · {x.runtime}</p></div>)}
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-white/10 bg-[#11233a] p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><Activity className="size-5 text-cyan-300" /> Integration health</h2>
            <p className="mt-1 text-xs text-slate-400">Server-side reachability checks, not fabricated service metrics.</p>
            <div className="mt-4 space-y-3">
              {data.integrations.map((x) => <div key={x.name} className="flex items-center gap-3 rounded-xl bg-[#09192b] p-3">
                <span className={"flex size-9 shrink-0 items-center justify-center rounded-lg " + (x.state === "reachable" ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/10 text-amber-300")}>
                  {x.name === "Komodo" ? <Server className="size-5"/> : x.name.includes("DNS") ? <Globe2 className="size-5"/> : <HardDrive className="size-5"/>}
                </span>
                <div className="min-w-0"><p className="font-semibold text-sm">{x.name}</p><p className="text-xs text-slate-400">{x.detail}</p></div>
                <span className={"ml-auto size-2 rounded-full " + (x.state === "reachable" ? "bg-emerald-400" : "bg-amber-400")}/>
              </div>)}
              {data.integrations.length === 0 && <p className="text-sm text-slate-400">{loading ? "Checking services..." : "Service status unavailable"}</p>}
            </div>
          </section>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 py-3 text-xs text-slate-500">
          <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-cyan-500"/> MzansiCloud Private Hosting · Engineering release 0.1</span>
          <span>Purchased outright · Privately deployed · Customer-controlled</span>
        </footer>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-2"><span className="text-xs font-semibold text-slate-300">{label}</span>{children}</label>;
}
function Metric({ icon, label, number, detail }: { icon: React.ReactNode; label: string; number: number; detail: string }) {
  return <div className="rounded-2xl border border-white/10 bg-[#11233a] p-5 shadow-lg shadow-black/10">
    <div className="flex items-center justify-between"><p className="text-sm text-slate-400">{label}</p><span className="text-cyan-400">{icon}</span></div>
    <p className="mt-3 text-4xl font-bold tracking-tight text-white">{number}</p>
    <p className="mt-2 text-xs text-slate-500">{detail}</p>
  </div>;
}
function StatePill({ state }: { state: string }) {
  return <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[11px] font-medium capitalize text-amber-300"><span className="size-1.5 rounded-full bg-amber-400"/>{state}</span>;
}
