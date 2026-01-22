const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

export default function HomePage() {
  return (
    <div>
      <h1 style={{ fontSize: 30, margin: "6px 0 6px", letterSpacing: "-0.02em" }}>Dashboard</h1>
      <p style={{ color: "#6b7280", marginTop: 0 }}>
        Latest portfolio exec summary (rendered by your FastAPI backend).
      </p>

      <div style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
      }}>
        <iframe
          title="Portfolio Latest"
          src={`${API_BASE}/v1/portfolio/latest/report`}
          style={{ width: "100%", height: 700, border: "0", background: "white" }}
        />
      </div>
    </div>
  );
}