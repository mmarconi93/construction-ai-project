import { API_BASE } from "@/lib/api";
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
      <main style={{ display: "grid", gap: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Invalid project id</h1>
        <p style={{ color: "#666" }}>
          This route expects a numeric id, but got: <code>{id}</code>
        </p>
      </main>
    );
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Project #{projectId}</h1>

      <ProjectRunner projectId={projectId} />

      <div style={{ border: "1px solid #ddd", borderRadius: 10, overflow: "hidden" }}>
        <iframe
          id="project-report"
          src={`${API_BASE}/v1/projects/${projectId}/reports/latest`}
          style={{ width: "100%", height: 720, border: 0 }}
        />
      </div>
    </main>
  );
}