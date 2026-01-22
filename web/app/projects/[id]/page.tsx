// web/app/projects/[id]/page.tsx
import ProjectRunner from "./ui/ProjectRunner";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = Number(id);

  if (!Number.isFinite(projectId)) {
    return (
      <div className="container">
        <div 
          className="glassCard"
          style={{
            padding: "3rem",
            textAlign: "center",
            borderColor: "var(--danger)",
            background: "rgba(239, 68, 68, 0.1)",
          }}
        >
          <h1 style={{ 
            fontSize: "2rem",
            fontWeight: 800,
            marginBottom: "1rem",
            color: "var(--danger)"
          }}>
            Invalid Project ID
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>
            This route expects a numeric ID, but got: <code style={{ 
              background: "rgba(0, 0, 0, 0.3)",
              padding: "0.25rem 0.5rem",
              borderRadius: "4px",
              fontFamily: "monospace",
              color: "var(--text-primary)"
            }}>{id}</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="pageHeader">
        <h1 className="pageTitle">Project #{projectId}</h1>
        <p className="pageSubtitle">Upload files, run weekly analysis, and view reports</p>
      </div>

      {/* Project Runner - Upload and Run Controls */}
      <ProjectRunner projectId={projectId} />

      {/* Report Display */}
      <div style={{ marginTop: "2rem" }}>
        <div className="reportHeader">
          <h2 className="reportTitle">Latest Report</h2>
          <div className="dateBadge">Live from backend</div>
        </div>

        <div 
          className="glassCard"
          style={{
            padding: 0,
            overflow: "hidden",
            minHeight: "720px",
          }}
        >
          <iframe
            id="project-report"
            src={`/v1/projects/${projectId}/reports/latest`}
            style={{ 
              width: "100%",
              height: "720px",
              border: 0,
              display: "block",
              background: "var(--surface)"
            }}
            title={`Project ${projectId} Report`}
          />
        </div>
      </div>
    </div>
  );
}