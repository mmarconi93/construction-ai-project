// web/app/portfolio/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getPortfolioWeek, listProjects, runAll } from "@/lib/api";

function isoMonday(d: Date) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay(); // 0 Sun
  const diff = (day === 0 ? -6 : 1) - day; // move to Monday
  x.setUTCDate(x.getUTCDate() + diff);
  return x.toISOString().slice(0, 10);
}

export default function PortfolioPage() {
  const [weekStart, setWeekStart] = useState(() => isoMonday(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [portfolio, setPortfolio] = useState<any>(null);
  const [projectsCount, setProjectsCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const ps = await listProjects();
        setProjectsCount(ps.length);
      } catch {
        // ignore – portfolio can still render
      }
    })();
  }, []);

  async function refresh() {
    setError(null);
    try {
      const data = await getPortfolioWeek(weekStart);
      setPortfolio(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load portfolio");
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  async function runThisWeek() {
    setLoading(true);
    setError(null);
    try {
      await runAll(weekStart);
      await refresh();
    } catch (e: any) {
      setError(e?.message || "Run all failed");
    } finally {
      setLoading(false);
    }
  }

  const rows = portfolio?.projects || [];
  const okCount = rows.length;
  const highCount = rows.filter((r: any) => r.risk_band === "HIGH").length;
  const medCount = rows.filter((r: any) => r.risk_band === "MED").length;
  const lowCount = rows.filter((r: any) => r.risk_band === "LOW").length;

  const overallRisk = rows.length
    ? Math.round(rows.reduce((a: number, r: any) => a + (r.risk_score || 0), 0) / rows.length)
    : 0;

  const weekEnd = useMemo(() => {
    const d = new Date(`${weekStart}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  }, [weekStart]);

  const total = Math.max(lowCount + medCount + highCount, 1);
  const lowPct = (lowCount / total) * 100;
  const medPct = (medCount / total) * 100;
  const highPct = (highCount / total) * 100;

  return (
    <div className="container">
      <div className="pageHeader">
        <h1 className="pageTitle">Dashboard</h1>
        <p className="pageSubtitle">Latest portfolio exec summary (rendered by your FastAPI backend)</p>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 24, flexWrap: "wrap" }}>
        <div className="glassCard" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div
              style={{
                color: "var(--text-tertiary)",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Week start (Monday)
            </div>
            <input
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              type="date"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "rgba(0,0,0,0.2)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <button
            onClick={runThisWeek}
            disabled={loading}
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "rgba(255,255,255,0.06)",
              color: "var(--text-primary)",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {loading ? "Running..." : "Run portfolio this week"}
          </button>

          <button
            onClick={refresh}
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "rgba(255,255,255,0.03)",
              color: "var(--text-primary)",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div
          className="glassCard"
          style={{
            padding: 14,
            borderColor: "rgba(239,68,68,0.35)",
            background: "rgba(239,68,68,0.08)",
            marginBottom: 24,
          }}
        >
          <span style={{ fontWeight: 800 }}>Error:</span> {error}
        </div>
      )}

      {/* Stats */}
      <div className="statsGrid">
        <div className="glassCard statCard statRisk">
          <div className="statHeader">
            <div className="statIcon">📊</div>
          </div>
          <div className="statLabel">Overall Risk</div>
          <div className="statValue statValueRisk">{overallRisk}</div>
          <div className="statDesc">Across scored projects</div>
        </div>

        <div className="glassCard statCard statTotal">
          <div className="statHeader">
            <div className="statIcon">📁</div>
          </div>
          <div className="statLabel">Total Projects</div>
          <div className="statValue statValueTotal">{projectsCount}</div>
          <div className="statDesc">In your portfolio</div>
        </div>

        <div className="glassCard statCard statOk">
          <div className="statHeader">
            <div className="statIcon">✓</div>
          </div>
          <div className="statLabel">OK Status</div>
          <div className="statValue statValueOk">{okCount}</div>
          <div className="statDesc">Scored projects</div>
        </div>

        <div className="glassCard statCard statHigh">
          <div className="statHeader">
            <div className="statIcon">⚠</div>
          </div>
          <div className="statLabel">High Risk</div>
          <div className="statValue statValueHigh">{highCount}</div>
          <div className="statDesc">Needs attention</div>
        </div>

        <div className="glassCard statCard statError">
          <div className="statHeader">
            <div className="statIcon">⚡</div>
          </div>
          <div className="statLabel">Errors</div>
          <div className="statValue statValueError">0</div>
          <div className="statDesc">Parse / compute issues</div>
        </div>
      </div>

      {/* Risk Distribution */}
      <div className="glassCard riskDistribution">
        <div className="sectionHeader">
          <div>
            <h2 className="sectionTitle">Risk Band Distribution</h2>
            <p className="sectionSubtitle">Based on ranked OK projects (from run-all)</p>
          </div>
        </div>

        <div className="riskBar">
          {lowCount > 0 && (
            <div className="riskSegment riskLow" style={{ width: `${lowPct}%` }}>
              LOW: {lowCount}
            </div>
          )}
          {medCount > 0 && (
            <div className="riskSegment riskMed" style={{ width: `${medPct}%` }}>
              MED: {medCount}
            </div>
          )}
          {highCount > 0 && (
            <div className="riskSegment riskHigh" style={{ width: `${highPct}%` }}>
              HIGH: {highCount}
            </div>
          )}
        </div>

        <div className="riskLegend">
          <div className="legendItem">
            <div className="legendIndicator legendLow" />
            <div>
              <div className="legendLabel">Low Risk</div>
              <div className="legendValue">{lowCount}</div>
            </div>
          </div>

          <div className="legendItem">
            <div className="legendIndicator legendMed" />
            <div>
              <div className="legendLabel">Medium Risk</div>
              <div className="legendValue">{medCount}</div>
            </div>
          </div>

          <div className="legendItem">
            <div className="legendIndicator legendHigh" />
            <div>
              <div className="legendLabel">High Risk</div>
              <div className="legendValue">{highCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Report */}
      <div>
        <div className="reportHeader">
          <h2 className="reportTitle">Portfolio Risk Report</h2>
          <div className="dateBadge">
            Week: {weekStart} → {weekEnd}
          </div>
        </div>

        <div className="glassCard reportCard">
          <div className="cardHeader">
            <h3 className="cardTitle">Portfolio Risk Report</h3>
            <p className="cardDesc">Ranked by risk score (highest first). Use this as an exec summary.</p>
          </div>

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Score</th>
                  <th>Band</th>
                  <th>Top drivers</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.project_id}>
                    <td>
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontWeight: 800, fontSize: 18 }}>{r.project_name}</div>
                        <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
                          Project ID: {r.project_id}
                        </div>
                        <a
                          href={`/projects/${r.project_id}`}
                          style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}
                        >
                          Latest report: Open →
                        </a>
                      </div>
                    </td>

                    <td style={{ fontSize: 42, fontWeight: 900, letterSpacing: -1 }}>{r.risk_score}</td>

                    <td>
                      {r.risk_band === "LOW" ? (
                        <span className="badgeLow">Low</span>
                      ) : r.risk_band === "MED" ? (
                        <span className="badgeMed">Med</span>
                      ) : (
                        <span className="badgeHigh">High</span>
                      )}
                    </td>

                    <td>
                      <div style={{ display: "grid", gap: 12 }}>
                        {(r.drivers || []).slice(0, 2).map((d: any, idx: number) => (
                          <div
                            key={idx}
                            style={{
                              padding: 14,
                              background: "rgba(0,0,0,0.2)",
                              borderRadius: 10,
                              border: "1px solid var(--border)",
                            }}
                          >
                            <div style={{ fontWeight: 800, marginBottom: 6 }}>{d.factor}</div>
                            <div style={{ color: "var(--text-secondary)", fontSize: 13, display: "flex", gap: 12 }}>
                              <span>
                                value: <span style={{ color: "var(--text-primary)" }}>{String(d.value)}</span>
                              </span>
                              <span style={{ color: "var(--accent)", fontWeight: 800 }}>points: {d.points}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 24, color: "var(--text-secondary)" }}>
                      No data yet. Run the portfolio to compute the week.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}