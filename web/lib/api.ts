// web/lib/api.ts

function getServerApiBase() {
  // ✅ Server-side (Vercel runtime) should call Cloud Run directly
  // Set this in Vercel as an Environment Variable:
  // API_BASE_INTERNAL="https://<your-cloud-run-service>.run.app"
  if (process.env.API_BASE_INTERNAL) return process.env.API_BASE_INTERNAL;

  // Optional: explicit canonical site URL (rarely needed for API calls)
  if (process.env.SITE_URL) return process.env.SITE_URL;

  // Optional: if you ever want a public canonical URL available to the browser too
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;

  // Vercel provides VERCEL_URL like: myapp.vercel.app (no scheme)
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  // Local dev fallback (Next dev server)
  return "http://localhost:3000";
}

function apiUrl(path: string) {
  // Always call with "/v1/..."
  if (!path.startsWith("/")) path = `/${path}`;

  // ✅ Browser: use relative URL so rewrites apply
  if (typeof window !== "undefined") return path;

  // ✅ Server: absolute URL, preferably Cloud Run via API_BASE_INTERNAL
  return `${getServerApiBase()}${path}`;
}

export type Project = {
  id: number;
  name: string;
  timezone: string;
};

export type PortfolioWeek = {
  week_start: string;
  projects: Array<{
    project_id: number;
    project_name: string;
    week_start: string;
    risk_score: number;
    risk_band: "LOW" | "MED" | "HIGH";
    drivers: Array<{ factor: string; value: any; points: number }> | null;
  }>;
};

export class ApiError extends Error {
  status: number;
  payload: any;

  constructor(message: string, status: number, payload: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function safeJson(res: Response) {
  try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await res.json();
    return { text: await res.text() };
  } catch {
    return null;
  }
}

async function throwApiError(res: Response, fallbackMsg: string): Promise<never> {
  const payload = await safeJson(res);

  const msg =
    (payload as any)?.detail?.message ||
    (payload as any)?.detail?.msg ||
    (payload as any)?.detail ||
    (payload as any)?.message ||
    (payload as any)?.error ||
    fallbackMsg;

  throw new ApiError(msg, res.status, payload);
}

export async function listProjects(): Promise<Project[]> {
  const res = await fetch(apiUrl("/v1/projects"), { cache: "no-store" });
  if (!res.ok) return throwApiError(res, `Failed to list projects: ${res.status}`);
  return res.json();
}

export async function createProject(payload: { name: string; timezone: string }): Promise<Project> {
  const res = await fetch(apiUrl("/v1/projects"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return throwApiError(res, `Failed to create project: ${res.status}`);
  return res.json();
}

export async function uploadFile(opts: {
  projectId: number;
  kind: "rfis" | "submittals" | "schedule";
  weekStart: string;
  file: File;
}) {
  const fd = new FormData();
  fd.append("kind", opts.kind);
  fd.append("week_start", opts.weekStart);
  fd.append("file", opts.file);

  const res = await fetch(apiUrl(`/v1/projects/${opts.projectId}/uploads`), {
    method: "POST",
    body: fd,
  });

  if (!res.ok) return throwApiError(res, `Upload failed (${opts.kind})`);
  return res.json();
}

export async function runWeekly(projectId: number, weekStart: string) {
  const fd = new FormData();
  fd.append("week_start", weekStart);

  const res = await fetch(apiUrl(`/v1/projects/${projectId}/run-weekly`), {
    method: "POST",
    body: fd,
  });

  if (!res.ok) return throwApiError(res, "Run weekly failed");
  return res.json();
}

export async function runAll(weekStart: string) {
  const fd = new FormData();
  fd.append("week_start", weekStart);

  const res = await fetch(apiUrl("/v1/run-all"), {
    method: "POST",
    body: fd,
  });

  if (!res.ok) return throwApiError(res, "Run all failed");
  return res.json();
}

export async function getPortfolioWeek(weekStart: string): Promise<PortfolioWeek> {
  const res = await fetch(apiUrl(`/v1/portfolio/week/${weekStart}`), { cache: "no-store" });
  if (!res.ok) return throwApiError(res, "Failed to load portfolio week");
  return res.json();
}