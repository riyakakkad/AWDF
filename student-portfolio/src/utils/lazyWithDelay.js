import { lazy } from "react";

/**
 * Custom lazy loading wrapper that enforces a minimum fallback delay.
 * Prevents flickering loading states on fast network connections.
 * 
 * @param {Function} importFn - Dynamic import function, e.g. () => import('./Page')
 * @param {number} delayMs - Minimum time in ms to display the loading fallback (default 300ms)
 */
export function lazyWithDelay(importFn, delayMs = 300) {
  return lazy(() =>
    Promise.all([
      importFn(),
      new Promise((resolve) => setTimeout(resolve, delayMs)),
    ]).then(([moduleExports]) => moduleExports)
  );
}

export default lazyWithDelay;
