// Live mode never silently falls back to demo data.
const base =
  import.meta.env.VITE_BROWSER_DEMO === "true"
    ? ""
    : import.meta.env.VITE_API_BASE_URL || "/api";
export const api = {
  enabled: Boolean(base),
  async request(path, { method = "GET", body, signal } = {}) {
    if (!base)
      throw new Error(
        "No backend configured. This workspace is using the browser demo.",
      );
    const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || `Request failed (${res.status})`);
    }
    return res.status === 204 ? null : res.json();
  },
  snapshot() {
    return this.request("/workspace");
  },
  command(command) {
    return this.request("/commands", { method: "POST", body: command });
  },
  session() {
    return this.request("/auth/session");
  },
  auth(action, body = {}) {
    return this.request(`/auth/${action}`, { method: "POST", body });
  },
  subscribe(onData, onError) {
    if (!base) return () => {};
    const stream = new EventSource(`${base.replace(/\/$/, "")}/events`, {
      withCredentials: true,
    });
    stream.onmessage = () => onData();
    stream.onerror = onError;
    return () => stream.close();
  },
};
