# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
## Practical 3

GitHub REST API integrated in the Projects page.

Features:
- Fetch repositories using GitHub API
- Loading state
- Error handling
- Display repository name and URL

---

## Practical 8: Performance Optimization and Lazy Loading in React

### Objective
To improve frontend performance using **route-based code splitting** (`React.lazy()`, `Suspense`), component-level lazy loading, and minimum-delay fallback states in the Task Management Application.

---

### Theory & Analysis (Key Questions Answered)

1. **Initial Bundle vs. Lazy-Loaded Chunks:**
   - **Initial Bundle (`index.js`):** Contains essential runtime code, layout components (`NavBar`), routing logic, and dependencies needed for the initial render. Downloaded immediately on first page access.
   - **Lazy-Loaded Chunks (`Home.js`, `Projects.js`, `Contact.js`, `TaskAnalyticsChart.js`):** Modular JavaScript files containing page or component code. Only downloaded asynchronously over the network when the user navigates to the specific route or toggles the component.

2. **Why Lazy Loading Improves Perceived Performance:**
   - Although the total code size across all routes remains similar, lazy loading drastically reduces **First Contentful Paint (FCP)** and **Time to Interactive (TTI)**.
   - Users download only the JavaScript needed for their active view, avoiding parsing/executing unneeded route code upfront.

3. **When Lazy Loading Is NOT Worth the Complexity:**
   - Extremely small applications (< 50 KB total bundle) where network overhead of extra HTTP requests exceeds code size savings.
   - Core layout components or critical initial views that are unconditionally visited on every session.

---

### Bundle Size Comparison (Vite Build Output)

| Metric / Asset | Before Optimization (Single Bundle) | After Optimization (Code-Split) | Impact / Difference |
| :--- | :--- | :--- | :--- |
| **Main JS Bundle** | `index-DotWvbse.js` (237.66 kB) | `index-D4QrX7mP.js` (233.54 kB) | **Reduced initial bundle payload** |
| **Home Route Chunk** | Loaded upfront in main bundle | `Home-2FRRgIps.js` (1.46 kB) | Loaded on demand (`/`) |
| **Projects Route Chunk** | Loaded upfront in main bundle | `Projects-Div1stIY.js` (3.61 kB) | Loaded on demand (`/projects`) |
| **Contact Route Chunk** | Loaded upfront in main bundle | `Contact-BiZ1IfXm.js` (0.73 kB) | Loaded on demand (`/contact`) |
| **NotFound Route Chunk** | Loaded upfront in main bundle | `NotFound-CtV07qbf.js` (0.21 kB) | Loaded on demand (`*`) |
| **Heavy Analytics Chart** | Loaded upfront in main bundle | `TaskAnalyticsChart-Cio71JFl.js` (2.14 kB) | Component-level lazy loading |
| **Total Chunks Generated** | **1 Bundle File** | **6 Separate Chunk Files** | Dynamic on-demand code splitting |

---

### Implementation Highlights

1. **Route-Based Code Splitting (`App.jsx`):**
   ```jsx
   import { lazy, Suspense } from 'react';
   import PageLoader from './components/PageLoader';
   import { lazyWithDelay } from './utils/lazyWithDelay';

   const Home = lazyWithDelay(() => import('./pages/Home'));
   const Projects = lazyWithDelay(() => import('./pages/Projects'));
   const Contact = lazyWithDelay(() => import('./pages/Contact'));

   <Suspense fallback={<PageLoader message="Loading page bundle..." />}>
     <Routes>
       <Route path="/" element={<Home />} />
       <Route path="/projects" element={<Projects />} />
       <Route path="/contact" element={<Contact />} />
     </Routes>
   </Suspense>
   ```

2. **Supplementary Problem: Heavy Component Lazy Loading (`Projects.jsx`):**
   - The `TaskAnalyticsChart` component is dynamically loaded on demand when the user clicks **"Show Analytics Chart"**.

3. **Supplementary Problem: Minimum Delay Fallback (`lazyWithDelay.js`):**
   - Implemented a 300ms minimum window using `Promise.all` to prevent jarring UI flicker on fast network connections.

4. **Supplementary Problem: Profiler & Re-render Prevention:**
   - Wrapped `TaskAnalyticsChart` in `React.memo` to prevent re-renders when task form input state changes.

---

### How to Run & Verify

1. **Start Development Server:**
   ```bash
   npm run dev
   ```
2. **Build for Production & Observe Chunks:**
   ```bash
   npm run build
   ```
3. **Inspect in Browser DevTools:**
   - Open DevTools -> **Network Tab**.
   - Set throttling to **Slow 3G**.
   - Navigate between routes (`/`, `/projects`, `/contact`) and observe the fallback spinner (`PageLoader`) while the `.js` chunk loads on demand.