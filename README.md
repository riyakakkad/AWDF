# Advanced Web Development Frameworks (ITUE301)

This repository contains practical implementations and coursework for Advanced Web Development Frameworks.

---

## Practical 10: Asynchronous Background Processing with Node.js EventEmitter

Implemented **event-driven architecture and asynchronous background processing** using Node.js's native `EventEmitter` module (`events`) to decouple notification processing from the HTTP request-response cycle.

### Key Deliverables:
- **Centralized Event Emitter Module (`server/events/taskEventEmitter.js`):** Custom `EventEmitter` instance with decoupled background handlers for `task:created`, `task:deleted`, and `error`.
- **Custom Event (`task:created`):** Emitted on `POST /tasks`. Decoupled notification executes asynchronously in the background (~1500ms).
- **Empirical Decoupling Proof:** Client receives API response in **~30.08 ms**, which is **1473.92 ms BEFORE** the background worker finishes!
- **Additional Events:**
  - `task:deleted`: Emitted on `DELETE /tasks/:id` for asynchronous audit logging and resource cleanup.
  - `error`: Dedicated error listener preventing Node.js process crashes upon unhandled background exceptions.
- **Audit & Monitoring Endpoint (`GET /tasks/events/logs`):** Exposes live event state, timestamps, and execution history.
- **Automated Verification Suite (`server/eventsBenchmark.js`):** Empirical timing benchmark validating background execution precedence.

### Running Practical 10 Benchmark:
```bash
# Navigate to server directory
cd server

# Run EventEmitter asynchronous benchmark
npm run events-benchmark
```

For full architecture diagrams, sequence diagrams, and lab report, see [docs/PRACTICAL_10_LAB_REPORT.md](file:///c:/Users/sanja/OneDrive/Desktop/AWDF/docs/PRACTICAL_10_LAB_REPORT.md).  
Submission Word Document: [PRACTICAL_10.docx](file:///c:/Users/sanja/OneDrive/Desktop/AWDF/PRACTICAL_10.docx).

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
  - **Uncached Avg Response Time:** ~12.27 ms
  - **Cached Avg Response Time:** ~2.72 ms
  - **Performance Speedup:** **4.51x faster** (~77.83% latency reduction)
  - **Single Task Speedup:** **3.0x faster** (6.06 ms -> 2.02 ms)

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
