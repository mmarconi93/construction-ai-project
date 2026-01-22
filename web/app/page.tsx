// web/app/page.tsx
import { getPortfolioWeek } from "@/lib/api";

// Helper to get the most recent Monday
function getRecentMonday() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day; // If Sunday, go back 6 days; otherwise go to Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().split("T")[0];
}

export default async function DashboardPage() {
  const weekStart = getRecentMonday();
  
  let portfolioData;
  let error = null;
  
  try {
    portfolioData = await getPortfolioWeek(weekStart);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load portfolio data";
  }

  // Calculate stats from portfolio data
  const totalProjects = portfolioData?.projects?.length ?? 0;
  const okProjects = portfolioData?.projects?.filter(p => p.risk_band === "LOW").length ?? 0;
  const highRiskProjects = portfolioData?.projects?.filter(p => p.risk_band === "HIGH").length ?? 0;
  const avgRiskScore = totalProjects > 0 
    ? Math.round(portfolioData!.projects.reduce((sum, p) => sum + p.risk_score, 0) / totalProjects)
    : 0;

  // Calculate risk distribution
  const lowCount = portfolioData?.projects?.filter(p => p.risk_band === "LOW").length ?? 0;
  const medCount = portfolioData?.projects?.filter(p => p.risk_band === "MED").length ?? 0;
  const highCount = portfolioData?.projects?.filter(p => p.risk_band === "HIGH").length ?? 0;
  const total = lowCount + medCount + highCount;

  const lowPercent = total > 0 ? (lowCount / total) * 100 : 0;
  const medPercent = total > 0 ? (medCount / total) * 100 : 0;
  const highPercent = total > 0 ? (highCount / total) * 100 : 0;

  // Format date range
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  };

  const getWeekEnd = (startStr: string) => {
    const start = new Date(startStr);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return formatDate(end.toISOString());
  };

  return (
    <div className="container">
      <div className="pageHeader">
        <h1 className="pageTitle">Dashboard</h1>
        <p className="pageSubtitle">
          Latest portfolio exec summary (rendered by your FastAPI backend)
        </p>
      </div>

      {error && (
        <div style={{ 
          background: 'rgba(239, 68, 68, 0.1)', 
          border: '1px solid var(--danger)',
          borderRadius: 'var(--radius-md)',
          padding: '1.5rem',
          marginBottom: '2rem',
          color: 'var(--danger)'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="statsGrid">
        <div className="statCard glassCard statRisk">
          <div className="statHeader">
            <div className="statIcon">📊</div>
          </div>
          <div className="statLabel">Overall Risk</div>
          <div className="statValue statValueRisk">{avgRiskScore}</div>
          <div className="statDesc">Across scored projects</div>
        </div>

        <div className="statCard glassCard statTotal">
          <div className="statHeader">
            <div className="statIcon">📁</div>
          </div>
          <div className="statLabel">Total Projects</div>
          <div className="statValue statValueTotal">{totalProjects}</div>
          <div className="statDesc">In your portfolio</div>
        </div>

        <div className="statCard glassCard statOk">
          <div className="statHeader">
            <div className="statIcon">✓</div>
          </div>
          <div className="statLabel">OK Status</div>
          <div className="statValue statValueOk">{okProjects}</div>
          <div className="statDesc">Scored projects</div>
        </div>

        <div className="statCard glassCard statHigh">
          <div className="statHeader">
            <div className="statIcon">⚠</div>
          </div>
          <div className="statLabel">High Risk</div>
          <div className="statValue statValueHigh">{highRiskProjects}</div>
          <div className="statDesc">Needs attention</div>
        </div>

        <div className="statCard glassCard statError">
          <div className="statHeader">
            <div className="statIcon">⚡</div>
          </div>
          <div className="statLabel">Errors</div>
          <div className="statValue statValueError">0</div>
          <div className="statDesc">Parse / compute issues</div>
        </div>
      </div>

      <div className="riskDistribution glassCard">
        <div className="sectionHeader">
          <div>
            <h2 className="sectionTitle">Risk Band Distribution</h2>
            <p className="sectionSubtitle">Based on ranked OK projects (from run-all)</p>
          </div>
        </div>
        <div className="riskBar">
          {lowPercent > 0 && (
            <div className="riskSegment riskLow" style={{ width: `${lowPercent}%` }}>
              {lowCount > 0 && `LOW: ${lowCount}`}
            </div>
          )}
          {medPercent > 0 && (
            <div className="riskSegment riskMed" style={{ width: `${medPercent}%` }}>
              {medCount > 0 && `MED: ${medCount}`}
            </div>
          )}
          {highPercent > 0 && (
            <div className="riskSegment riskHigh" style={{ width: `${highPercent}%` }}>
              {highCount > 0 && `HIGH: ${highCount}`}
            </div>
          )}
        </div>
        <div className="riskLegend">
          <div className="legendItem">
            <div className="legendIndicator legendLow"></div>
            <div>
              <div className="legendLabel">Low Risk</div>
              <div className="legendValue">{lowCount}</div>
            </div>
          </div>
          <div className="legendItem">
            <div className="legendIndicator legendMed"></div>
            <div>
              <div className="legendLabel">Medium Risk</div>
              <div className="legendValue">{medCount}</div>
            </div>
          </div>
          <div className="legendItem">
            <div className="legendIndicator legendHigh"></div>
            <div>
              <div className="legendLabel">High Risk</div>
              <div className="legendValue">{highCount}</div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="reportHeader">
          <h2 className="reportTitle">Portfolio Risk Report</h2>
          <div className="dateBadge">
            Week: {weekStart} → {getWeekEnd(weekStart)}
          </div>
        </div>

        <div className="reportCard glassCard">
          <div className="cardHeader">
            <h3 className="cardTitle">Portfolio Risk Report</h3>
            <p className="cardDesc">
              Ranked by risk score (highest first). Use this as an exec summary.
            </p>
          </div>

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Score</th>
                  <th>Band</th>
                  <th>Top Drivers</th>
                </tr>
              </thead>
              <tbody>
                {portfolioData?.projects && portfolioData.projects.length > 0 ? (
                  portfolioData.projects
                    .sort((a, b) => b.risk_score - a.risk_score)
                    .map((project) => (
                      <tr key={project.project_id}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>
                              {project.project_name}
                            </span>
                            <span style={{ 
                              fontFamily: 'monospace', 
                              fontSize: '0.8rem', 
                              color: 'var(--text-tertiary)' 
                            }}>
                              Project ID: {project.project_id}
                            </span>
                            <a 
                              href={`/projects/${project.project_id}`}
                              style={{
                                color: 'var(--accent)',
                                textDecoration: 'none',
                                fontSize: '0.9rem',
                                fontWeight: 600
                              }}
                            >
                              Latest report: Open →
                            </a>
                          </div>
                        </td>
                        <td>
                          <div style={{
                            fontSize: '3rem',
                            fontWeight: 800,
                            lineHeight: 1,
                            background: 'linear-gradient(135deg, var(--text-primary), var(--text-secondary))',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                          }}>
                            {project.risk_score}
                          </div>
                        </td>
                        <td>
                          <span className={`badge${project.risk_band === 'LOW' ? 'Low' : project.risk_band === 'MED' ? 'Med' : 'High'}`}>
                            {project.risk_band}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {project.drivers && project.drivers.length > 0 ? (
                              project.drivers.slice(0, 3).map((driver, idx) => (
                                <div 
                                  key={idx}
                                  style={{
                                    padding: '1rem',
                                    background: 'rgba(0, 0, 0, 0.2)',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)'
                                  }}
                                >
                                  <div style={{ 
                                    fontWeight: 700, 
                                    marginBottom: '0.5rem',
                                    fontSize: '0.95rem'
                                  }}>
                                    {driver.factor}
                                  </div>
                                  <div style={{ 
                                    color: 'var(--text-secondary)', 
                                    fontSize: '0.85rem',
                                    display: 'flex',
                                    gap: '1rem'
                                  }}>
                                    <span>
                                      value: <span style={{ 
                                        fontFamily: 'monospace',
                                        color: 'var(--text-primary)'
                                      }}>{driver.value}</span>
                                    </span>
                                    <span style={{ 
                                      color: 'var(--accent)', 
                                      fontWeight: 700 
                                    }}>
                                      points: {driver.points}
                                    </span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <span style={{ color: 'var(--text-secondary)' }}>
                                No drivers available
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      No portfolio results yet. Run the portfolio analysis to see data.
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