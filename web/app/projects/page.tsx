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
              padding: "1.5rem",
              borderColor: "var(--danger)",
              background: "rgba(239, 68, 68, 0.1)",
              marginBottom: "2rem",
            }}
          >
            <span style={{ fontWeight: 800, color: "var(--danger)" }}>API error:</span>{" "}
            <span style={{ color: "var(--text-primary)" }}>{apiError}</span>
            <span style={{ color: "var(--text-secondary)" }}>
              {" "}— Is the backend reachable?
            </span>
          </div>
        )}

        <div style={{ display: "grid", gap: "2rem" }}>
          {/* Create Project Section */}
          <div className="glassCard" style={{ padding: "2.5rem" }}>
            <div className="sectionHeader" style={{ marginBottom: "1.5rem" }}>
              <div>
                <h2 className="sectionTitle">Create Project</h2>
                <p className="sectionSubtitle">Projects are stored in the backend database.</p>
              </div>
            </div>

            <CreateProjectForm />
          </div>

          {/* Projects List */}
          <div className="glassCard reportCard">
            <div className="cardHeader">
              <h2 className="cardTitle">Your Projects</h2>
              <p className="cardDesc">
                Click a project to upload files, run weekly scoring, and open reports.
              </p>
            </div>

            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Timezone</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          <div style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--text-primary)" }}>
                            {p.name}
                          </div>
                          <div 
                            style={{ 
                              fontFamily: "monospace",
                              color: "var(--text-tertiary)", 
                              fontSize: "0.8rem" 
                            }}
                          >
                            Project ID: {p.id}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span 
                          style={{ 
                            color: "var(--text-secondary)",
                            fontFamily: "monospace",
                            fontSize: "0.9rem"
                          }}
                        >
                          {p.timezone}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link
                          href={`/projects/${p.id}`}
                          style={{
                            color: "var(--accent)",
                            textDecoration: "none",
                            fontWeight: 700,
                            fontSize: "0.95rem",
                            transition: "all 0.3s",
                          }}
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {projects.length === 0 && !apiError && (
                    <tr>
                      <td 
                        colSpan={3} 
                        style={{ 
                          padding: "3rem 2rem",
                          textAlign: "center",
                          color: "var(--text-secondary)" 
                        }}
                      >
                        <div style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
                          No projects yet.
                        </div>
                        <div style={{ fontSize: "0.9rem", color: "var(--text-tertiary)" }}>
                          Create one above to get started.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Helpful Tip */}
          <div
            className="glassCard"
            style={{
              padding: "1.5rem",
              background: "rgba(59, 130, 246, 0.05)",
              borderColor: "rgba(59, 130, 246, 0.3)",
            }}
          >
            <div 
              style={{ 
                fontWeight: 800,
                marginBottom: "0.75rem",
                fontSize: "1rem",
                color: "var(--text-primary)"
              }}
            >
              💡 Tip
            </div>
            <div style={{ color: "var(--text-secondary)", lineHeight: 1.6, fontSize: "0.95rem" }}>
              After creating a project, open it to upload RFIs, Submittals, and Schedule files, 
              then run weekly scoring. Reports are rendered from the FastAPI backend.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}