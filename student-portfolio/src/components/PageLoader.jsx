import React from "react";

/**
 * Fallback UI rendered by React Suspense while lazy-loaded chunks are downloading.
 */
function PageLoader({ message = "Loading page..." }) {
  return (
    <div className="page-loader-container" role="status" aria-live="polite">
      <div className="page-loader-spinner"></div>
      <p className="page-loader-text">{message}</p>
    </div>
  );
}

export default PageLoader;
