"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE, getPortfolioWeek, listProjects, runAll } from "@/lib/api";

function isoMonday(d: Date) {
  // local Monday for the UI date input
  const x = new Date(d);
  const day = x.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtTime(ts?: number | null) {
  if (!ts) return "";
  return new Date(ts).toLocaleString();
}

function pillForBand(band?: string) {
  const b = (band || "").toUpperCase();
  if (b === "HIGH") return { bg: "#fff1f2", bd: "#fecdd3", fg: "#9f1239" };
  if (b === "MED") return { bg: "#fffbeb", bd: "#fde68a", fg: "#92400e" };
  return { bg: "#ecfdf5", bd: "#bbf7d0", fg: "#065f46" };
}

function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
}) {
  const styles: Record<string, any> = {
    neutral: { bg: "#ffffff", bd: "#e5e7eb", fg: "#111827" },
    good: { bg: "#ecfdf5", bd: "#bbf7d0", fg: "#065f46" },
    warn: { bg: "#fffbeb", bd: "#fde68a", fg: "#92400e" },
    bad: { bg: "#fff1f2", bd: "#fecdd3", fg: "#9f1239" },
    info: { bg: "#eff6ff", bd: "#bfdbfe", fg: "#1d4ed8" },
  };

  const s = styles[tone] ?? styles.neutral;

  return (
    <div
      style={{
        border: `1px solid ${s.bd}`,
        borderRadius: 14,
        padding: 14,
        background: s.bg,
        minWidth: 180,
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 950, marginTop: 6, color: s.fg }}>{value}</div>
      {sub ? <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
}

export default function PortfolioPage() {
  const [weekStart, setWeekStart] = useState(() => isoMonday(new Date()));
  const [busy, setBusy] = useState(false);

  const [msg, setMsg] = useState("");
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);

  const [totalProjects, setTotalProjects] = useState<number | null>(null);

  const [lastRunAll, setLastRunAll] = useState<any>(null);
  const [portfolioWeek, setPortfolioWeek] = useState<any>(null);

  const [reportNonce, setReportNonce] = useState(0);
  const [iframeLoading, setIframeLoading] = useState(false);

  const reportUrl = useMemo(() => {
    return `${API_BASE}/v1/portfolio/week/${weekStart}/report`;
  }, [weekStart]);

  const reportUrlBusted = useMemo(() => `${reportUrl}?t=${reportNonce}`, [reportUrl, reportNonce]);

  const summary = lastRunAll?.summary || null;
  const results: any[] = Array.isArray(lastRunAll?.results) ? lastRunAll.results : [];
  const rankedOk: any[] = Array.isArray(lastRunAll?.ranked_ok) ? lastRunAll.ranked_ok : [];

  const hasRun = !!summary;

  // KPIs: show 0 instead of "—" until run
  const okVal = hasRun ? summary.ok : 0;
  const skippedVal = hasRun ? summary.skipped : 0;
  const errorVal = hasRun ? summary.error : 0;

  const projectsForWeek = useMemo(() => {
    // Prefer run-all ranked_ok if present (freshest)
    if (Array.isArray(rankedOk) && rankedOk.length > 0) return rankedOk;

    // Fall back to portfolioWeek JSON (server truth)
    if (Array.isArray(portfolioWeek?.projects)) return portfolioWeek.projects;

    return [];
    }, [rankedOk, portfolioWeek]);

    const derived = useMemo(() => {
    let low = 0, med = 0, high = 0;
    let sum = 0;

    for (const p of projectsForWeek) {
        const score = Number(p?.risk_score) || 0;
        sum += score;

        const b = String(p?.risk_band || "").toUpperCase();
        if (b === "HIGH") high++;
        else if (b === "MED") med++;
        else low++;
    }

    const count = projectsForWeek.length;
    const avg = count ? Math.round(sum / count) : 0;

    return { count, avg, low, med, high };
    }, [projectsForWeek]);

    const avgRisk = derived.avg;
    const bandCounts = { low: derived.low, med: derived.med, high: derived.high, totalOk: derived.count };

    const stackedTotal = Math.max(1, bandCounts.totalOk);
    const lowPct = (bandCounts.low / stackedTotal) * 100;
    const medPct = (bandCounts.med / stackedTotal) * 100;
    const highPct = (bandCounts.high / stackedTotal) * 100;

  function refreshIframe() {
    setIframeLoading(true);
    setReportNonce(Date.now());
  }

  // Fetch total projects immediately so KPI isn't blank
  useEffect(() => {
    (async () => {
      try {
        const ps = await listProjects();
        setTotalProjects(ps.length);
      } catch {
        setTotalProjects(null);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
        try {
        const w = await getPortfolioWeek(weekStart);
        setPortfolioWeek(w);
        } catch {
        setPortfolioWeek(null);
        }
    })();
    }, [weekStart]);

  // Refresh report when week changes (and show loading overlay)
  useEffect(() => {
    refreshIframe();
  }, [weekStart]);

  async function onRunAll() {
    setBusy(true);
    setMsg("Running portfolio…");
    try {
      const res = await runAll(weekStart);
      setLastRunAll(res);
      setLastRunAt(Date.now());

      const ok = res?.summary?.ok ?? 0;
      const skipped = res?.summary?.skipped ?? 0;
      const error = res?.summary?.error ?? 0;
      setMsg(`Run complete ✅  ok=${ok}, skipped=${skipped}, error=${error}`);

      refreshIframe();
    } catch (e: any) {
      setMsg(e?.message ?? "Run all failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      style={{
        display: "grid",
        gap: 14,
        background: "#f8fafc",
        padding: 16,
        borderRadius: 16,
      }}
    >
      {/* Header / Controls */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 16,
          background: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          flexWrap: "wrap",
          gap: 10,
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 950 }}>Portfolio</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Weekly risk ranking + executive report</div>

          <div style={{ fontSize: 12, color: msg.includes("✅") ? "#065f46" : "#6b7280", fontWeight: 800 }}>
            {msg || (hasRun ? "" : "Run the portfolio to compute this week’s KPIs.")}
            {lastRunAt ? <span style={{ marginLeft: 8 }}>• Last run: {fmtTime(lastRunAt)}</span> : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, color: "#555" }}>Week start (Monday)</label>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              disabled={busy}
              style={{
                padding: 10,
                border: "1px solid #d1d5db",
                borderRadius: 10,
                minWidth: 165,
                background: "#fff",
              }}
            />
          </div>

          <button
            type="button"
            onClick={onRunAll}
            disabled={busy}
            style={{
              padding: "10px 12px",
              border: "1px solid #111",
              borderRadius: 12,
              background: "#111",
              color: "#fff",
              cursor: busy ? "not-allowed" : "pointer",
              fontWeight: 950,
              boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
            }}
          >
            Run portfolio this week
          </button>

          <a
            href={reportUrlBusted}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: "10px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 12,
              background: "#fff",
              textDecoration: "none",
              color: "#111",
              fontWeight: 850,
            }}
          >
            Open report ↗
          </a>

          <button
            type="button"
            onClick={refreshIframe}
            disabled={busy}
            style={{
              padding: "10px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 12,
              background: "#fff",
              cursor: busy ? "not-allowed" : "pointer",
              fontWeight: 850,
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <StatCard
        label="Overall Risk (Avg)"
        value={derived.avg}
        sub={derived.count ? "Across scored projects" : "Not computed yet"}
        tone="info"
      />

      <StatCard
        label="Total Projects"
        value={totalProjects ?? "—"}
        sub="In your portfolio"
        tone="neutral"
      />

      <StatCard
        label="OK"
        value={derived.count}
        sub="Scored projects"
        tone="good"
      />

      <StatCard
        label="High Risk Projects"
        value={derived.high}
        sub={derived.count ? "Needs attention" : "Not computed yet"}
        tone="bad"
      />

      <StatCard
        label="Errors"
        value={errorVal}
        sub="Parse / compute issues"
        tone="bad"
      />
      </div>

      {/* Band distribution */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 16,
          background: "#fff",
          display: "grid",
          gap: 10,
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 950 }}>Risk Band Distribution</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Based on ranked OK projects (from run-all).</div>
          </div>
        </div>

        <div style={{ border: "1px solid #e5e7eb", borderRadius: 999, overflow: "hidden", height: 14 }}>
          <div style={{ display: "flex", height: "100%" }}>
            <div style={{ width: `${lowPct}%`, background: "#bbf7d0" }} />
            <div style={{ width: `${medPct}%`, background: "#fde68a" }} />
            <div style={{ width: `${highPct}%`, background: "#fecdd3" }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: "#374151", fontWeight: 900 }}>
          <span>LOW: {bandCounts.low}</span>
          <span>MED: {bandCounts.med}</span>
          <span>HIGH: {bandCounts.high}</span>
        </div>
      </div>

      {/* Projects table */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 16,
          background: "#fff",
          display: "grid",
          gap: 10,
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 950 }}>Projects</div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#6b7280", fontSize: 12 }}>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #e5e7eb" }}>Project</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #e5e7eb" }}>Status</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #e5e7eb" }}>Score</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #e5e7eb" }}>Band</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #e5e7eb" }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 10, color: "#6b7280" }}>
                    Run the portfolio to populate this table.
                  </td>
                </tr>
              ) : (
                results
                  .slice()
                  .sort((a, b) => (Number(b?.risk_score) || 0) - (Number(a?.risk_score) || 0))
                  .map((r) => {
                    const status = String(r?.status || "");
                    const band = String(r?.risk_band || "").toUpperCase();
                    const pill = pillForBand(band);

                    let detail = "";
                    if (status === "skipped") {
                      const missing = Array.isArray(r?.missing) ? r.missing.join(", ") : "";
                      detail = missing ? `Missing: ${missing}` : "Missing uploads";
                    } else if (status === "error") {
                      if (r?.error_type === "parse_error") detail = "Parse error (CSV format/columns)";
                      else detail = r?.error || "Error";
                    } else {
                      detail = "OK";
                    }

                    return (
                      <tr key={`${r.project_id}-${status}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "10px 8px", fontWeight: 950 }}>{r?.project_name || `Project ${r?.project_id}`}</td>
                        <td style={{ padding: "10px 8px" }}>{status}</td>
                        <td style={{ padding: "10px 8px", fontWeight: 950 }}>{r?.risk_score ?? "—"}</td>
                        <td style={{ padding: "10px 8px" }}>
                          {band ? (
                            <span
                              style={{
                                padding: "3px 10px",
                                borderRadius: 999,
                                border: `1px solid ${pill.bd}`,
                                background: pill.bg,
                                color: pill.fg,
                                fontWeight: 950,
                                fontSize: 12,
                              }}
                            >
                              {band}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ padding: "10px 8px", color: "#6b7280" }}>{detail}</td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Executive report iframe */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 16,
          background: "#fff",
          display: "grid",
          gap: 10,
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 950 }}>Executive Report Preview</div>

        <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb" }}>
          {iframeLoading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(255,255,255,0.75)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 950,
                color: "#374151",
                zIndex: 2,
              }}
            >
              Loading report…
            </div>
          )}

          <iframe
            title="Portfolio report"
            src={reportUrlBusted}
            onLoad={() => setIframeLoading(false)}
            style={{
              width: "100%",
              height: 750,
              border: 0,
              background: "#fff",
            }}
          />
        </div>
      </div>
    </section>
  );
}