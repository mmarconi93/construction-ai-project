// web/app/projects/page.tsx
import Link from "next/link";
import TopNav from "../ui/TopNav";
import { listProjects, type Project } from "@/lib/api";
import CreateProjectForm from "./ui/CreateProjectForm";

export default async function ProjectsPage() {
  let projects: Project[] = [];
  let apiError: string | null = null;

  try {
    projects = await listProjects();
  } catch (e: unknown) {
    apiError = e instanceof Error ? e.message : "Failed to reach API";
  }

  return (
    <>
      <TopNav active="projects" />

      <div className="container">
        <div className="pageHeader">
          <h1 className="pageTitle">Projects</h1>
          <p className="pageSubtitle">Create, view, and run weekly uploads + reports.</p>
        </div>

        {apiError && (
          <div
            className="glassCard"
            style={{
              padding: 14,
              borderColor: "rgba(239,68,68,0.35)",
              background: "rgba(239,68,68,0.08)",
              marginBottom: 18,
            }}
          >
            <span style={{ fontWeight: 800 }}>API error:</span> {apiError}
            <span style={{ color: "var(--text-secondary)" }}>
              {" "}
              — Is the backend reachable?
            </span>
          </div>
        )}

        <div style={{ display: "grid", gap: 18 }}>
          {/* Create */}
          <div className="glassCard" style={{ padding: 18 }}>
            <div className="sectionHeader" style={{ marginBottom: 10 }}>
              <div>
                <h2 className="sectionTitle">Create project</h2>
                <p className="sectionSubtitle">Projects are stored in the backend database.</p>
              </div>
            </div>

            <CreateProjectForm />
          </div>

          {/* List */}
          <div className="glassCard" style={{ padding: 0, overflow: "hidden" }}>
            <div className="cardHeader" style={{ padding: 18 }}>
              <h2 className="cardTitle" style={{ margin: 0 }}>
                Your projects
              </h2>
              <p className="cardDesc" style={{ margin: "6px 0 0" }}>
                Click a project to upload files, run weekly scoring, and open reports.
              </p>
            </div>

            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Timezone</th>
                    <th style={{ textAlign: "right" }}>Open</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ fontWeight: 900, fontSize: 16 }}>{p.name}</div>
                          <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
                            Project ID: {p.id}
                          </div>
                        </div>
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>{p.timezone}</td>
                      <td style={{ textAlign: "right" }}>
                        <Link
                          href={`/projects/${p.id}`}
                          style={{
                            color: "var(--accent)",
                            textDecoration: "none",
                            fontWeight: 800,
                          }}
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {projects.length === 0 && !apiError && (
                    <tr>
                      <td colSpan={3} style={{ padding: 24, color: "var(--text-secondary)" }}>
                        No projects yet. Create one above to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Helpful hint */}
          <div
            className="glassCard"
            style={{
              padding: 16,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Tip</div>
            <div style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
              After creating a project, open it to upload RFIs / Submittals / Schedule and run weekly scoring.
              Reports render from the FastAPI backend.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}