# Advanced Web Development Frameworks (ITUE301)

This repository contains practical implementations and coursework for Advanced Web Development Frameworks.

---

## Practical 9: In-Memory Caching and Query Optimization

Applied **server-side in-memory caching** using `node-cache` on Express/MongoDB task management backend, cache invalidation logic for write operations (`POST`, `PUT`, `DELETE`), single-task endpoint caching (`GET /tasks/:id`), debug stats monitoring endpoint (`GET /tasks/cache/stats`), and empirical performance benchmarking.

### Key Deliverables:
- **Shared Cache Module (`server/cache.js`):** Encapsulated `node-cache` instance with standard TTL (60s) and hit/miss analytics counters.
- **GET `/tasks` In-Memory Caching:** Instant response retrieval for all-tasks query (`X-Cache: HIT` vs `X-Cache: MISS`).
- **Single-Task Caching (`GET /tasks/:id`):** Isolated caching per task ID key (`task_${id}`).
- **Cache Invalidation:** Write operations (`POST`, `PUT`, `DELETE`) invalidate associated cache keys to guarantee zero stale data.
- **Debug Endpoint (`GET /tasks/cache/stats`):** Exposes live hit count, miss count, hit ratio percentage, active key count, and memory stats.
- **Empirical Performance Benchmarking (`server/benchmark.js`):**
  - **Uncached Avg Response Time:** ~16.59 ms
  - **Cached Avg Response Time:** ~0.75 ms
  - **Performance Speedup:** **22.12x faster** (~95.48% latency reduction)

### Running Backend Server & Benchmark:
```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Start Express & MongoDB server
npm start

# Run empirical benchmark suite
npm run benchmark
```

For full theoretical analysis, architecture diagrams, and lab journal, see [docs/PRACTICAL_9_LAB_REPORT.md](file:///c:/Users/sanja/OneDrive/Desktop/AWDF/docs/PRACTICAL_9_LAB_REPORT.md).

---

## Practical 8: Performance Optimization and Lazy Loading in React

Applied **route-based code splitting** (`React.lazy()`, `Suspense`), component-level lazy loading, minimum-delay fallback states, and build metrics profiling.

### Key Deliverables:
- **Route Lazy Loading:** `Home`, `Projects`, `Contact`, `NotFound` lazy-loaded dynamically on route navigation.
- **Heavy Component Lazy Loading:** `TaskAnalyticsChart` dynamically fetched on demand on the `/projects` page.
- **Flicker-Free Fallback:** `lazyWithDelay` wrapper (300ms minimum window) ensures smooth transitions.
- **Build Metrics:** Separated monolithic bundle into 6 distinct chunks in Vite production build output.
