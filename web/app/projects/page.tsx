import Link from "next/link";
import { listProjects } from "@/lib/api";
import CreateProjectForm from "./ui/CreateProjectForm";

export default async function ProjectsPage() {
  let projects = [];
  let apiError: string | null = null;

  try {
    projects = await listProjects();
  } catch (e: any) {
    apiError = e?.message ?? "Failed to reach API";
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Projects</h1>

      {apiError && (
        <div
          style={{
            padding: 12,
            border: "1px solid #f2c2c2",
            background: "#fff5f5",
            borderRadius: 10,
            color: "#8a1f1f",
          }}
        >
          API error: {apiError}. Is Docker running and the backend reachable?
        </div>
      )}

      <CreateProjectForm />

      <div style={{ border: "1px solid #ddd", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>Name</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>Timezone</th>
              <th style={{ padding: 10, borderBottom: "1px solid #eee" }}></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p: any) => (
              <tr key={p.id}>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f3f3" }}>
                  <strong>{p.name}</strong>
                </td>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f3f3" }}>{p.timezone}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f3f3" }}>
                  <Link href={`/projects/${p.id}`}>Open</Link>
                </td>
              </tr>
            ))}
            {projects.length === 0 && !apiError && (
              <tr>
                <td colSpan={3} style={{ padding: 14, color: "#666" }}>
                  No projects yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}