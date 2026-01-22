"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE, runWeekly, uploadFile, ApiError } from "@/lib/api";

function isoMonday(d: Date) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay(); // 0 Sun
  const diff = (day === 0 ? -6 : 1) - day; // move to Monday
  x.setUTCDate(x.getUTCDate() + diff);
  return x.toISOString().slice(0, 10);
}

type Kind = "rfis" | "submittals" | "schedule";

type UploadStatus = {
  uploaded: boolean;
  filename?: string;
  uploadedAt?: number; // epoch ms
  error?: string;      // inline upload error
};

const KIND_LABEL: Record<Kind, string> = {
  rfis: "RFIs",
  submittals: "Submittals",
  schedule: "Schedule",
};

function fmtTime(ts?: number) {
  if (!ts) return "";
  return new Date(ts).toLocaleString();
}

/** Download a text file (CSV) in the browser */
function downloadTextFile(filename: string, content: string, mime = "text/csv") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

/** CSV templates that match your current ingest parsers */
function templatesForWeek(weekStart: string) {
  const rfis = `created_date,closed_date,status,discipline,assignee
${weekStart},,Open,Structural,Alex
${weekStart},${weekStart},Closed,MEP,Jamie
`;

  const submittals = `submitted_date,approved_date,status,spec_section,lead_time_days
${weekStart},,Pending,03 30 00,10
${weekStart},${weekStart},Approved,09 29 00,5
`;

  const schedule = `task_name,start_date,finish_date,percent_complete,is_critical,baseline_finish_date
Foundation,${weekStart},${weekStart},0,true,${weekStart}
Framing,${weekStart},${weekStart},50,false,${weekStart}
`;

  return { rfis, submittals, schedule };
}

export default function ProjectRunner({ projectId }: { projectId: number }) {
  const [weekStart, setWeekStart] = useState<string>(() => isoMonday(new Date()));
  const [files, setFiles] = useState<Partial<Record<Kind, File>>>({});
  const [busy, setBusy] = useState(false);

  const [msg, setMsg] = useState<string>("");
  const [parseErr, setParseErr] = useState<any>(null);
  const [lastRun, setLastRun] = useState<any>(null);

  // used for cache-busting the iframe
  const [reportNonce, setReportNonce] = useState(0);

  const [status, setStatus] = useState<Record<Kind, UploadStatus>>({
    rfis: { uploaded: false },
    submittals: { uploaded: false },
    schedule: { uploaded: false },
  });

  const [lastRunAt, setLastRunAt] = useState<number | null>(null);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [lastReportRefreshAt, setLastReportRefreshAt] = useState<number | null>(null);

  const readyToRun = (["rfis", "submittals", "schedule"] as Kind[]).every(
    (k) => status[k].uploaded
  );

  const missingKinds = (["rfis", "submittals", "schedule"] as Kind[]).filter(
    (k) => !status[k].uploaded
  );

  const reportWeekUrl = useMemo(() => {
    return `${API_BASE}/v1/projects/${projectId}/reports/week/${weekStart}`;
  }, [projectId, weekStart]);

  const reportWeekUrlBusted = useMemo(() => {
    return `${reportWeekUrl}?t=${reportNonce}`;
  }, [reportWeekUrl, reportNonce]);

  function getFriendlyParseError(e: unknown) {
    if (!(e instanceof ApiError)) return null;

    const payload: any = (e as any).payload;
    if (payload?.error === "parse_error" && payload?.detail) return payload.detail;

    if ((e as any).status === 422 && payload?.detail) {
      return { kind: "unknown", message: (e as any).message, raw: payload };
    }

    return null;
  }

  function refreshReportIframe() {
    setIframeLoading(true);
    setLastReportRefreshAt(Date.now());
    setReportNonce(Date.now());
  }

  // Optional: auto-refresh iframe whenever weekStart changes
  useEffect(() => {
    refreshReportIframe();
  }, [weekStart]);

  const isErrorMsg = useMemo(() => {
    const t = msg.toLowerCase();
    return t.includes("fail") || t.includes("error") || t.includes("missing") || t.includes("invalid");
  }, [msg]);

  async function doUpload(kind: Kind) {
    const f = files[kind];
    if (!f) {
      setMsg(`Pick a ${kind}.csv file first.`);
      return;
    }

    // Basic client-side validation
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setStatus((prev) => ({
        ...prev,
        [kind]: { ...prev[kind], error: "Please upload a .csv file." },
      }));
      setMsg(`${KIND_LABEL[kind]} needs a CSV file`);
      return;
    }

    setBusy(true);
    setMsg(`Uploading ${kind}…`);

    // clear only this kind's error before trying
    setStatus((prev) => ({
      ...prev,
      [kind]: { ...prev[kind], error: undefined },
    }));

    try {
      const res = await uploadFile({ projectId, kind, weekStart, file: f });

      setStatus((prev) => ({
        ...prev,
        [kind]: {
          uploaded: true,
          filename: f.name,
          uploadedAt: Date.now(),
          error: undefined,
        },
      }));

      setMsg(`Uploaded ${kind}: ${res?.stored_path || res?.filename || "OK"}`);
    } catch (e: any) {
      const m = e?.message ?? `Upload failed for ${kind}`;

      setStatus((prev) => ({
        ...prev,
        [kind]: {
          ...prev[kind],
          error: m,
        },
      }));

      setMsg(m);
    } finally {
      setBusy(false);
    }
  }

  async function uploadAll() {
    const missing: Kind[] = (["rfis", "submittals", "schedule"] as Kind[]).filter((k) => !files[k]);
    if (missing.length) {
      setMsg(`Missing file(s): ${missing.map((k) => `${k}.csv`).join(", ")}`);
      return;
    }

    setBusy(true);
    setMsg("Uploading all files…");

    // clear errors for all kinds
    setStatus((prev) => ({
      rfis: { ...prev.rfis, error: undefined },
      submittals: { ...prev.submittals, error: undefined },
      schedule: { ...prev.schedule, error: undefined },
    }));

    try {
      for (const k of ["rfis", "submittals", "schedule"] as Kind[]) {
        await uploadFile({ projectId, kind: k, weekStart, file: files[k]! });
        setStatus((prev) => ({
          ...prev,
          [k]: { uploaded: true, filename: files[k]!.name, uploadedAt: Date.now(), error: undefined },
        }));
      }
      setMsg("Uploaded all files ✅");
    } catch (e: any) {
      setMsg(e?.message ?? "Upload all failed");
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    if (!readyToRun) {
      setMsg(`Upload remaining inputs: ${missingKinds.map((k) => KIND_LABEL[k]).join(", ")}`);
      return;
    }

    setBusy(true);
    setMsg("Running weekly scoring…");
    setParseErr(null);

    try {
      const result = await runWeekly(projectId, weekStart);
      setLastRun(result);
      setLastRunAt(Date.now());

      const score = result?.score?.risk_score ?? "?";
      const band = result?.score?.risk_band ?? "?";
      setMsg(`Run complete ✅  Score: ${score} (${band})`);

      refreshReportIframe();
    } catch (e: any) {
      const pe = getFriendlyParseError(e);
      if (pe) {
        setParseErr(pe);
        const kindLabel = pe.kind ? String(pe.kind).toUpperCase() : "CSV";
        setMsg(`${kindLabel} input needs fixing`);
      } else {
        setMsg(e?.message ?? "Run weekly failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 16,
        display: "grid",
        gap: 14,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 12, color: "#555" }}>Week start (Monday)</label>
          <input
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            type="date"
            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 8, minWidth: 160 }}
            disabled={busy}
          />
        </div>

        <a
          href={reportWeekUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            padding: "8px 12px",
            border: "1px solid #ccc",
            borderRadius: 8,
            textDecoration: "none",
            color: "#111",
            background: "#f7f7f7",
          }}
        >
          Open report (week) ↗
        </a>

        <button
          type="button"
          onClick={refreshReportIframe}
          disabled={busy}
          style={{
            padding: "8px 12px",
            border: "1px solid #ccc",
            borderRadius: 8,
            background: "#f7f7f7",
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          Refresh report
        </button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {/* Template download row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16 }}>Upload inputs</h3>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const t = templatesForWeek(weekStart);
                downloadTextFile(`rfis_template_${weekStart}.csv`, t.rfis);
                setMsg("Downloaded RFI template ✅");
              }}
              style={{
                padding: "6px 10px",
                border: "1px solid #ccc",
                borderRadius: 8,
                background: "#fff",
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              Download RFI template
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const t = templatesForWeek(weekStart);
                downloadTextFile(`submittals_template_${weekStart}.csv`, t.submittals);
                setMsg("Downloaded Submittals template ✅");
              }}
              style={{
                padding: "6px 10px",
                border: "1px solid #ccc",
                borderRadius: 8,
                background: "#fff",
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              Download Submittals template
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const t = templatesForWeek(weekStart);
                downloadTextFile(`schedule_template_${weekStart}.csv`, t.schedule);
                setMsg("Downloaded Schedule template ✅");
              }}
              style={{
                padding: "6px 10px",
                border: "1px solid #ccc",
                borderRadius: 8,
                background: "#fff",
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              Download Schedule template
            </button>
          </div>
        </div>

        {(["rfis", "submittals", "schedule"] as Kind[]).map((k) => {
          const s = status[k];

          const pill = s.uploaded
            ? {
                text: `✔ ${s.filename || "Uploaded"} • ${fmtTime(s.uploadedAt)}`,
                bg: "#ecfdf5",
                bd: "#bbf7d0",
                fg: "#065f46",
              }
            : s.error
            ? {
                text: `✖ ${s.error}`,
                bg: "#fff5f5",
                bd: "#fecaca",
                fg: "#7f1d1d",
              }
            : {
                text: "⏳ Missing",
                bg: "#f3f4f6",
                bd: "#e5e7eb",
                fg: "#374151",
              };

          return (
            <div
              key={k}
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1fr 120px",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 12, color: "#333" }}>{k}</div>

              <input
                type="file"
                accept=".csv,text/csv"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setFiles((prev) => ({ ...prev, [k]: f || undefined }));
                }}
              />

              <button
                type="button"
                onClick={() => doUpload(k)}
                disabled={busy}
                style={{
                  padding: "8px 10px",
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  background: "#fff",
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                Upload
              </button>

              {/* ✅ status pill row */}
              <div
                style={{
                  gridColumn: "1 / -1",
                  marginTop: 6,
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: `1px solid ${pill.bd}`,
                  background: pill.bg,
                  color: pill.fg,
                  fontSize: 12,
                }}
              >
                {KIND_LABEL[k]}: {pill.text}
              </div>
            </div>
          );
        })}


        {/* Actions row */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={uploadAll}
            disabled={busy}
            style={{
              padding: "10px 12px",
              border: "1px solid #ccc",
              borderRadius: 10,
              background: "#fff",
              cursor: busy ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            Upload all
          </button>

          <button
            type="button"
            onClick={run}
            disabled={busy || !readyToRun}
            style={{
              padding: "10px 12px",
              border: "1px solid #111",
              borderRadius: 10,
              background: readyToRun ? "#111" : "#9ca3af",
              color: "#fff",
              cursor: busy || !readyToRun ? "not-allowed" : "pointer",
              fontWeight: 800,
            }}
          >
            {readyToRun ? "Run weekly" : `Upload remaining (${missingKinds.length})`}
          </button>

          {!readyToRun && (
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Missing: {missingKinds.map((k) => KIND_LABEL[k]).join(", ")}
            </div>
          )}


          {msg && !parseErr && <div style={{ color: isErrorMsg ? "#b00020" : "#333" }}>{msg}</div>}
        </div>

        {/* Parse error */}
        {parseErr && (
          <div
            style={{
              marginTop: 10,
              border: "1px solid #f1c2c2",
              background: "#fff5f5",
              borderRadius: 10,
              padding: 12,
              color: "#5a1a1a",
              display: "grid",
              gap: 8,
              maxWidth: 980,
            }}
          >
            <div style={{ fontWeight: 900 }}>
              CSV Parse Error {parseErr?.kind ? `(${String(parseErr.kind).toUpperCase()})` : ""}
            </div>

            <div>{parseErr?.message || "Your CSV did not match the expected format."}</div>

            {Array.isArray(parseErr?.missing_required) && parseErr.missing_required.length > 0 && (
              <div>
                <div style={{ fontWeight: 800, marginTop: 6 }}>Missing required columns:</div>
                <ul style={{ margin: "6px 0 0 18px" }}>
                  {parseErr.missing_required.map((c: string) => (
                    <li
                      key={c}
                      style={{
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      }}
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {Array.isArray(parseErr?.found_columns) && parseErr.found_columns.length > 0 && (
              <div>
                <div style={{ fontWeight: 800, marginTop: 6 }}>Columns found in your CSV:</div>
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  }}
                >
                  {parseErr.found_columns.join(", ")}
                </div>
              </div>
            )}

            {parseErr?.mapped_columns && typeof parseErr.mapped_columns === "object" && (
              <div>
                <div style={{ fontWeight: 800, marginTop: 6 }}>Columns we mapped:</div>
                <pre
                  style={{
                    background: "#fff",
                    border: "1px solid #f1c2c2",
                    padding: 10,
                    borderRadius: 8,
                    overflowX: "auto",
                    fontSize: 12,
                    margin: 0,
                  }}
                >
                  {JSON.stringify(parseErr.mapped_columns, null, 2)}
                </pre>
              </div>
            )}

            <div style={{ marginTop: 4 }}>Tip: download the template above, copy your data into it, and upload again.</div>
          </div>
        )}

        {/* Preview block */}
        <div style={{ borderTop: "1px solid #eee", paddingTop: 12, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 800 }}>Weekly report preview</div>
          <div style={{ border: "1px solid #ddd", borderRadius: 10, overflow: "hidden" }}>
            <iframe title="project-week-report" src={reportWeekUrlBusted} style={{ width: "100%", height: 560, border: 0 }} />
          </div>
        </div>

        {lastRun && (
          <div style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Last run output</div>
            <pre
              style={{
                background: "#f7f7f7",
                padding: 12,
                borderRadius: 10,
                overflowX: "auto",
                margin: 0,
                fontSize: 12,
              }}
            >
              {JSON.stringify(lastRun, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}