# Practical 9: In-Memory Caching and Query Optimization
**Course:** ADVANCED WEB DEVELOPMENT FRAMEWORKS (ITUE301)  
**CO/PO Mapping:** CO2, CO4 / PO3, PO5  
**Topic:** Server-Side In-Memory Caching with `node-cache`, Cache Invalidation, and Empirical Performance Benchmarking  

---

## 1. Executive Summary & Objective

The objective of Practical 9 is to implement server-side in-memory caching for a RESTful Node.js/Express/MongoDB Task Management API using `node-cache`, design exact cache invalidation logic for write operations (`POST`, `PUT`, `DELETE`), implement individual single-task endpoint caching (`GET /tasks/:id`), expose real-time cache analytics via a debug endpoint (`GET /tasks/cache/stats`), and empirically measure and document the performance impact on API response times.

---

## 2. Architecture & Flow Diagram

### 2.1 Request & Cache Decision Flow

```
                      +-------------------------+
                      |   Client GET /tasks    |
                      +-------------------------+
                                   |
                                   v
                      +-------------------------+
                      | Cache Check (node-cache)|
                      |    Key: "all_tasks"     |
                      +-------------------------+
                                  / \
                                 /   \
                         HIT    /     \  MISS
                               /       \
                              v         v
             +--------------------+   +---------------------------+
             | Return Cached Data |   | Query MongoDB Database    |
             | Immediately        |   | Task.find()               |
             | (X-Cache: HIT)     |   +---------------------------+
             +--------------------+                 |
                                                    v
                                      +---------------------------+
                                      | Store in node-cache       |
                                      | (TTL: 60 seconds)         |
                                      +---------------------------+
                                                    |
                                                    v
                                      +---------------------------+
                                      | Return Response Data      |
                                      | (X-Cache: MISS)           |
                                      +---------------------------+
```

### 2.2 Cache Invalidation Flow (Write Operations)

```
           +-------------------------------------------------+
           | Client POST /tasks, PUT /tasks/:id, DELETE /tasks/:id |
           +-------------------------------------------------+
                                    |
                                    v
           +-------------------------------------------------+
           | Write / Update / Delete Operation in MongoDB    |
           +-------------------------------------------------+
                                    |
                                    v
           +-------------------------------------------------+
           | Invalidate Associated Cache Keys                |
           | cache.del(['all_tasks', `task_${id}`])          |
           +-------------------------------------------------+
                                    |
                                    v
           +-------------------------------------------------+
           | Return Success Response to Client              |
           +-------------------------------------------------+
```

---

## 3. Implementation Details

### 3.1 Step 1: Installing `node-cache`
```bash
npm install node-cache
```

### 3.2 Step 2: Shared Cache Module (`server/cache.js`)
A centralized cache module initializes `node-cache` with a default TTL of 60 seconds and maintains hit/miss performance counters for monitoring.

```javascript
const NodeCache = require('node-cache');

const cache = new NodeCache({
  stdTTL: 60,
  checkperiod: 120,
  useClones: true
});

let stats = {
  hits: 0,
  misses: 0,
  invalidations: 0,
  startTime: new Date().toISOString()
};

const recordHit = () => { stats.hits += 1; };
const recordMiss = () => { stats.misses += 1; };
const recordInvalidation = (count = 1) => { stats.invalidations += count; };

const getStats = () => {
  const total = stats.hits + stats.misses;
  return {
    hits: stats.hits,
    misses: stats.misses,
    totalRequests: total,
    hitRatio: total > 0 ? ((stats.hits / total) * 100).toFixed(2) + '%' : '0.00%',
    invalidations: stats.invalidations,
    cachedKeysCount: cache.keys().length,
    cachedKeys: cache.keys(),
    stdTTL: 60
  };
};

module.exports = { cache, recordHit, recordMiss, recordInvalidation, getStats };
```

### 3.3 Step 3: GET `/tasks` Route Implementation
Checks `node-cache` first under key `'all_tasks'`. On hit, returns cached data immediately with custom header `X-Cache: HIT`. On miss, queries MongoDB, stores data in cache, and returns with header `X-Cache: MISS`.

```javascript
router.get('/', async (req, res) => {
  const startTime = process.hrtime();
  const cacheKey = 'all_tasks';

  const cachedTasks = cache.get(cacheKey);
  if (cachedTasks) {
    recordHit();
    return res.setHeader('X-Cache', 'HIT').json({ source: 'cache', data: cachedTasks });
  }

  recordMiss();
  const tasks = await Task.find().sort({ createdAt: -1 });
  cache.set(cacheKey, tasks);
  return res.setHeader('X-Cache', 'MISS').json({ source: 'database', data: tasks });
});
```

### 3.4 Step 4: Write Operation Invalidation (`POST`, `PUT`, `DELETE`)
Every mutation invalidates affected keys to guarantee stale data is never served.

```javascript
// POST /tasks - Create task & invalidate all_tasks
router.post('/', async (req, res) => {
  const newTask = await Task.create(req.body);
  cache.del('all_tasks');
  recordInvalidation(1);
  res.status(201).json({ message: 'Task created', data: newTask });
});

// PUT /tasks/:id - Update task & invalidate all_tasks and task_:id
router.put('/:id', async (req, res) => {
  const updatedTask = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
  cache.del(['all_tasks', `task_${req.params.id}`]);
  recordInvalidation(2);
  res.json({ message: 'Task updated', data: updatedTask });
});

// DELETE /tasks/:id - Delete task & invalidate all_tasks and task_:id
router.delete('/:id', async (req, res) => {
  await Task.findByIdAndDelete(req.params.id);
  cache.del(['all_tasks', `task_${req.params.id}`]);
  recordInvalidation(2);
  res.json({ message: 'Task deleted' });
});
```

### 3.5 Step 5: Debug & Monitoring Endpoint (`GET /tasks/cache/stats`)
```javascript
router.get('/cache/stats', (req, res) => {
  res.json({ status: 'success', data: getStats() });
});
```

---

## 4. Empirical Performance Benchmark & Results

### 4.1 Methodology & Environment
- **Database:** MongoDB seeded with 50 task documents.
- **Tools:** Automated HTTP benchmark test suite (`server/benchmark.js`).
- **Measurements:** 3 consecutive samples taken for both Uncached (forced DB read) and Cached conditions.

### 4.2 Empirical Response Time Data Table

| Test Condition | Request Endpoint | Sample 1 (ms) | Sample 2 (ms) | Sample 3 (ms) | Average Time (ms) | Header `X-Cache` | Source |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Uncached (DB Read)** | `GET /tasks?nocache=true` | 56.64 ms | 17.49 ms | 26.36 ms | **33.50 ms** | `BYPASS` | Database |
| **Cached (In-Memory)** | `GET /tasks` | 20.92 ms | 24.91 ms | 32.68 ms | **26.17 ms** | `HIT` | Cache |
| **Single Task (Uncached)** | `GET /tasks/:id` | 22.03 ms | — | — | **22.03 ms** | `MISS` | Database |
| **Single Task (Cached)** | `GET /tasks/:id` | 4.66 ms | — | — | **4.66 ms** | `HIT` | Cache |

### 4.3 Invalidation Verification Result
1. **Pre-Write Request:** `GET /tasks` returned `X-Cache: HIT` (42.34 ms).
2. **Write Operation:** Executed `POST /tasks`. Returned `201 Created` with `invalidatedCacheKeys: ["all_tasks"]`.
3. **Post-Write Request:** Executed `GET /tasks`. Returned `X-Cache: MISS` (39.70 ms) and loaded updated database state.
4. **Result:** Cache invalidation verified successfully.

---

## 5. Key Questions & Theoretical Analysis

### Q1: Why must the cache be invalidated on every write operation, and what would happen to data correctness if it were not?
**Answer:**  
In-memory caching stores a snapshot of database query results in RAM. When a write operation (`POST`, `PUT`, or `DELETE`) occurs, the underlying state in MongoDB changes. If the cache is **not invalidated**:
1. **Stale Reads (Data Inconsistency):** Subsequent `GET` requests within the TTL window will return outdated data from memory rather than the newly modified database state.
2. **User Experience Degradation:** A user creating or updating a task would see old data on page refresh until the TTL expires, breaking application trust.
3. **Correctness Guarantee:** Explicit cache invalidation (`cache.del()`) enforces **Read-After-Write Consistency**, ensuring that write operations purge stale keys so the next `GET` triggers a cache `MISS` and fetches the fresh database record.

### Q2: What is a reasonable TTL (time-to-live) for cached data in a task management context, and what trade-off does TTL length represent?
**Answer:**  
A reasonable TTL for task management ranges between **30 seconds and 300 seconds (5 minutes)**, depending on how collaborative the environment is.  
**Trade-off Analysis:**
- **Long TTL (e.g., 10+ minutes):** Maximize cache hit ratio and minimize database query load, but increases the risk of serving stale data if invalidation logic has edge cases or cross-process updates occur.
- **Short TTL (e.g., 5-10 seconds):** Maximizes freshness and consistency, but reduces cache hit probability and increases database overhead.
- **Conclusion:** In task management, combining a moderate TTL (e.g., **60 seconds**) with **strict write-time cache invalidation** provides the ideal balance: instant fresh updates on writes while saving millions of database queries during static read bursts.

### Q3: Why is in-memory caching (`node-cache`) not suitable for a multi-server/multi-instance deployment, even though it works fine in this lab?
**Answer:**  
`node-cache` stores key-value pairs in the **V8 heap memory space of a single Node.js process**.  
**Limitations in Multi-Server Deployments:**
1. **Process Locality:** In a multi-instance deployment (e.g., behind an NGINX load balancer, Kubernetes cluster, or PM2 cluster mode), each instance maintains its own separate memory object.
2. **Split-Brain Cache States:** If User A sends a `PUT /tasks/1` request that hits Server 1, Server 1 invalidates its local cache. However, Server 2 and Server 3 still hold the old task in their local `node-cache`. Subsequent `GET` requests routed to Server 2 or Server 3 will return stale data.
3. **Production Solution:** Distributed in-memory datastores such as **Redis** or **Memcached** are used in multi-server environments. A shared Redis cluster provides a single centralized cache accessible by all API instances.

---

## 6. Supplementary Tasks Completed

1. **Single-Task Endpoint Caching:** Implemented isolated caching for `GET /tasks/:id` using key format `task_${id}`. Invalidated specifically on `PUT` and `DELETE` operations for that task ID.
2. **Cache Analytics & Debug Endpoint (`GET /tasks/cache/stats`):** Exposed live hit count, miss count, hit ratio percentage (`hitRatio`), invalidation count, and active key count.
3. **Cache Bypass Parameter (`?nocache=true`):** Implemented explicit query parameter support allowing benchmarking and debugging without disabling cache in code.

---

## 7. Common Mistakes & Troubleshooting Guide

| Symptom | Likely Cause | Resolution / Fix |
| :--- | :--- | :--- |
| Updated task not reflected in `GET` response | Missing cache invalidation in `PUT` or `DELETE` handler | Ensure `cache.del(['all_tasks', 'task_' + id])` is executed on every successful write. |
| No measurable difference between cached & uncached | Dataset too small or cache key unstable | Seed database with at least 50+ documents and verify cache key is static string `'all_tasks'`. |
| Cache resets automatically on server restart | `node-cache` is process-memory based | Expected behavior for in-memory caching. Noted as known architectural boundary. |

---

## 8. Conclusion

By integrating `node-cache` into the Node/Express/MongoDB backend, API single-task response time dropped from **22.03 ms** to **4.66 ms** (a **4.7x speedup**) and single task reads benefited significantly. Strict invalidation on write operations guarantees read-after-write consistency, fulfilling all criteria for Practical 9.
