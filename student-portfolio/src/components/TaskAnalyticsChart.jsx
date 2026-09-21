import React from "react";

/**
 * Heavy visual analytics chart component loaded dynamically on the Projects page.
 * Demonstrates component-level code splitting beyond route-level code splitting.
 */
function TaskAnalyticsChart({ tasks = [] }) {
  const total = tasks.length;
  const highPriority = tasks.filter((t) => t.priority === "high").length;
  const lowPriority = tasks.filter((t) => t.priority === "low").length;
  const completed = tasks.filter((t) => t.completed).length;
  const pending = total - completed;

  const highPct = total > 0 ? Math.round((highPriority / total) * 100) : 0;
  const lowPct = total > 0 ? Math.round((lowPriority / total) * 100) : 0;
  const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="analytics-card">
      <div className="analytics-header">
        <h3>📊 Task Performance & Distribution Analytics</h3>
        <span className="badge-heavy">Lazy Loaded Component</span>
      </div>

      <div className="analytics-grid">
        <div className="stat-box">
          <span className="stat-number">{total}</span>
          <span className="stat-label">Total Tasks</span>
        </div>
        <div className="stat-box warning">
          <span className="stat-number">{highPriority}</span>
          <span className="stat-label">High Priority ({highPct}%)</span>
        </div>
        <div className="stat-box info">
          <span className="stat-number">{lowPriority}</span>
          <span className="stat-label">Low Priority ({lowPct}%)</span>
        </div>
        <div className="stat-box success">
          <span className="stat-number">{completed}</span>
          <span className="stat-label">Completed ({completedPct}%)</span>
        </div>
      </div>

      <div className="chart-bars">
        <h4>Task Priority Breakdown</h4>
        <div className="bar-wrapper">
          <span className="bar-label">High Priority</span>
          <div className="bar-track">
            <div
              className="bar-fill high"
              style={{ width: `${highPct}%` }}
            ></div>
          </div>
          <span className="bar-value">{highPct}%</span>
        </div>

        <div className="bar-wrapper">
          <span className="bar-label">Low Priority</span>
          <div className="bar-track">
            <div
              className="bar-fill low"
              style={{ width: `${lowPct}%` }}
            ></div>
          </div>
          <span className="bar-value">{lowPct}%</span>
        </div>
      </div>
    </div>
  );
}

export default React.memo(TaskAnalyticsChart);
