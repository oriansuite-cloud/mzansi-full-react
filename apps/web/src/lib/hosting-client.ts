export type Tenant = {
  id: string; name: string; edition: string; status: string; createdAt: string;
};
export type Domain = {
  id: string; tenantId: string; fqdn: string; visibility: string; status: string; createdAt: string;
};
export type HostingApp = {
  id: string; tenantId: string; name: string; runtime: string; source: string | null; status: string; createdAt: string;
};
export type Integration = { name: string; state: "reachable" | "unavailable" | "not-configured"; detail: string };
export type HostingOverview = {
  tenants: Tenant[]; domains: Domain[]; applications: HostingApp[];
  integrations: Integration[]; policy: string;
  counts: { tenants: number; domains: number; applications: number };
};
const urlBase = import.meta.env.VITE_API_URL ?? "";
export async function hostingRequest<T>(path: string, input?: Record<string, string>): Promise<T> {
  const res = await fetch(urlBase + "/api/hosting" + path, {
    method: input ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...(input ? { body: JSON.stringify(input) } : {}),
  });
  if (res.status === 401) {
    window.location.assign("/login");
    throw new Error("Sign in required");
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Request failed");
  return data as T;
}
