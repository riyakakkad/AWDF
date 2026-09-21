# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Practical 8: Performance Optimization and Lazy Loading in React

Applied **route-based code splitting** (`React.lazy()`, `Suspense`), component-level lazy loading, minimum-delay fallback states, and build metrics profiling.

### Key Deliverables:
- **Route Lazy Loading:** `Home`, `Projects`, `Contact`, `NotFound` lazy-loaded dynamically on route navigation.
- **Heavy Component Lazy Loading:** `TaskAnalyticsChart` dynamically fetched on demand on the `/projects` page.
- **Flicker-Free Fallback:** `lazyWithDelay` wrapper (300ms minimum window) ensures smooth transitions.
- **Build Metrics:** Separated monolithic bundle into 6 distinct chunks in Vite production build output.

