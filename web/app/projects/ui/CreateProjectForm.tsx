"use client";

import { useState } from "react";
import { createProject } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function CreateProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const p = await createProject({ name, timezone });
      setName("");
      router.push(`/projects/${p.id}`);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Failed to create project");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 16, maxWidth: 600 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <label 
          style={{ 
            fontSize: "0.8rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "1px",
            color: "var(--text-tertiary)"
          }}
        >
          Project name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g., Downtown Office Tower"
          style={{ 
            padding: "12px 14px",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            background: "rgba(0, 0, 0, 0.2)",
            color: "var(--text-primary)",
            fontSize: "1rem",
            fontWeight: 500,
          }}
        />
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <label 
          style={{ 
            fontSize: "0.8rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "1px",
            color: "var(--text-tertiary)"
          }}
        >
          Timezone
        </label>
        <input
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          placeholder="America/Chicago"
          style={{ 
            padding: "12px 14px",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            background: "rgba(0, 0, 0, 0.2)",
            color: "var(--text-primary)",
            fontSize: "1rem",
            fontWeight: 500,
          }}
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        style={{ 
          padding: "14px 20px",
          borderRadius: "10px",
          border: "1px solid var(--accent)",
          background: busy 
            ? "rgba(59, 130, 246, 0.3)" 
            : "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(16, 185, 129, 0.2))",
          color: "var(--text-primary)",
          fontWeight: 800,
          fontSize: "0.9rem",
          textTransform: "uppercase",
          letterSpacing: "1px",
          cursor: busy ? "not-allowed" : "pointer",
          transition: "all 0.3s",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "Creating..." : "Create Project"}
      </button>

      {err && (
        <div 
          style={{ 
            padding: "12px 16px",
            borderRadius: "10px",
            border: "1px solid var(--danger)",
            background: "rgba(239, 68, 68, 0.1)",
            color: "var(--danger)",
            fontSize: "0.9rem",
            fontWeight: 600,
          }}
        >
          <strong>Error:</strong> {err}
        </div>
      )}
    </form>
  );
}