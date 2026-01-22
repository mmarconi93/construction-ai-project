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
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, maxWidth: 520 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800 }}>Create project</h2>

      <div style={{ display: "grid", gap: 6 }}>
        <label style={{ fontSize: 12, color: "#555" }}>Project name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Pilot Project"
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <label style={{ fontSize: 12, color: "#555" }}>Timezone</label>
        <input
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          placeholder="America/Chicago"
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc" }}
      >
        {busy ? "Creating..." : "Create"}
      </button>

      {err && <div style={{ color: "crimson" }}>{err}</div>}
    </form>
  );
}
