"use client";

type SingleReport = {
  projectName: string;
  variantName: string;
  environment: string;
  date: string;
  path: string;
}

type GroupedReports = {
  [projectName: string]: {
    [environment: string]: {
      [variantName: string]: SingleReport[];
    };
  };
}

interface ReportsGridProps {
  reports: GroupedReports;
}

export function ReportsGrid({ reports }: ReportsGridProps) {
  const projectNames = Object.keys(reports);

  if (projectNames.length === 0) {
    return (
      <div className="empty-state">
        <h2>No reports available</h2>
        <p>Reports will appear here once performance tests have been run.</p>
      </div>
    );
  }

  return (
    <div className="reports-grid">
      {projectNames.map(projectName => (
        <div key={projectName} className="project-card">
          <h2 className="project-title">{projectName}</h2>
          
          {Object.entries(reports[projectName]).map(([environment, variants]) => (
            <div key={environment} className="environment-section">
              <h3 className="environment-title">{environment}</h3>
              
              <div className="variants-grid">
                {Object.entries(variants).map(([variantName, reportsList]) => (
                  <div key={variantName} className="variant-card">
                    <h4 className="variant-title">{variantName}</h4>
                    
                    <div className="reports-list">
                      {reportsList
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .slice(0, 5) // Show latest 5 reports
                        .map((report, index) => (
                          <a 
                            key={index}
                            href={`/${report.path}`}
                            className="report-link"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <div className="report-item">
                              <span className="report-date">
                                {new Date(report.date).toLocaleDateString()} {new Date(report.date).toLocaleTimeString()}
                              </span>
                              {index === 0 && <span className="latest-badge">Latest</span>}
                            </div>
                          </a>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      <style jsx>{`
        .empty-state {
          text-align: center;
          background: white;
          padding: 60px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .empty-state h2 {
          color: #666;
          margin-bottom: 10px;
          font-size: 1.5rem;
        }

        .empty-state p {
          color: #999;
        }

        .reports-grid {
          display: grid;
          gap: 30px;
        }

        .project-card {
          background: white;
          border-radius: 8px;
          padding: 30px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .project-title {
          color: #2c3e50;
          margin-bottom: 25px;
          font-size: 1.8rem;
          border-bottom: 2px solid #3498db;
          padding-bottom: 10px;
        }

        .environment-section {
          margin-bottom: 25px;
        }

        .environment-title {
          color: #27ae60;
          margin-bottom: 15px;
          font-size: 1.3rem;
          text-transform: capitalize;
        }

        .variants-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }

        .variant-card {
          background: #f8f9fa;
          border-radius: 6px;
          padding: 20px;
          border-left: 4px solid #3498db;
        }

        .variant-title {
          color: #2c3e50;
          margin-bottom: 15px;
          font-size: 1.1rem;
          text-transform: capitalize;
        }

        .reports-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .report-link {
          text-decoration: none;
          color: inherit;
          transition: transform 0.2s ease;
        }

        .report-link:hover {
          transform: translateX(4px);
        }

        .report-item {
          background: white;
          padding: 12px 15px;
          border-radius: 4px;
          border: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.2s ease;
        }

        .report-item:hover {
          border-color: #3498db;
          box-shadow: 0 2px 8px rgba(52, 152, 219, 0.1);
        }

        .report-date {
          font-size: 0.9rem;
          color: #666;
        }

        .latest-badge {
          background: #27ae60;
          color: white;
          font-size: 0.7rem;
          padding: 2px 8px;
          border-radius: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        @media (max-width: 768px) {
          .variants-grid {
            grid-template-columns: 1fr;
          }
          
          .project-title {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}