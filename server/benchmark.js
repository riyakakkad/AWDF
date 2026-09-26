const http = require('http');
const mongoose = require('mongoose');
const { startServer } = require('./server');
const Task = require('./models/Task');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}`;

// Helper to make HTTP request and record response time
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime();
    const url = new URL(path, BASE_URL);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const diff = process.hrtime(start);
        const timeMs = parseFloat((diff[0] * 1000 + diff[1] / 1e6).toFixed(2));
        const cacheHeader = res.headers['x-cache'] || 'N/A';
        let parsed = {};
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = { raw: data };
        }
        resolve({
          statusCode: res.statusCode,
          timeMs,
          cacheHeader,
          data: parsed
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Generate sample task data
function generateSampleTasks(count = 50) {
  const categories = ['Frontend', 'Backend', 'Database', 'DevOps', 'Security', 'Testing'];
  const priorities = ['low', 'medium', 'high'];
  const statuses = ['pending', 'in_progress', 'completed'];

  const tasks = [];
  for (let i = 1; i <= count; i++) {
    const category = categories[i % categories.length];
    tasks.push({
      title: `${category} Task #${i}: Optimize query performance and implement feature module ${i}`,
      description: `Comprehensive detailed specification for ${category.toLowerCase()} component ${i} including integration tests, API endpoints, schema validation, and cache management strategy.`,
      status: statuses[i % statuses.length],
      priority: priorities[i % priorities.length],
      dueDate: new Date(Date.now() + i * 86400000)
    });
  }
  return tasks;
}

async function runBenchmark() {
  console.log('\n======================================================');
  console.log(' Practical 9: In-Memory Caching & Performance Benchmark');
  console.log('======================================================\n');

  // 1. Start Server
  const server = await startServer();
  await new Promise((r) => setTimeout(r, 500)); // wait for server to settle

  try {
    // 2. Clear DB and Seed 50 Task Documents
    console.log('Seeding database with 50 task documents...');
    await Task.deleteMany({});
    const sampleData = generateSampleTasks(50);
    const createdTasks = await Task.insertMany(sampleData);
    console.log(`Seeded ${createdTasks.length} task documents into MongoDB.\n`);

    // Reset cache stats
    await makeRequest('POST', '/tasks/cache/reset');

    // 3. UNCACHED MEASUREMENTS (Forced Database Reads)
    console.log('--- 1. Measuring Uncached Database Reads (GET /tasks?nocache=true) ---');
    const uncachedReadings = [];
    for (let i = 1; i <= 3; i++) {
      const res = await makeRequest('GET', '/tasks?nocache=true');
      uncachedReadings.push(res.timeMs);
      console.log(` Sample #${i}: ${res.timeMs} ms [Cache Header: ${res.cacheHeader}]`);
      await new Promise((r) => setTimeout(r, 100));
    }
    const avgUncached = (uncachedReadings.reduce((a, b) => a + b, 0) / uncachedReadings.length).toFixed(2);
    console.log(` Average Uncached Response Time: ${avgUncached} ms\n`);

    // Reset cache stats before cached test
    await makeRequest('POST', '/tasks/cache/reset');

    // 4. CACHED MEASUREMENTS
    console.log('--- 2. Measuring Cached In-Memory Reads (GET /tasks) ---');
    // First request populate cache (MISS)
    const missRes = await makeRequest('GET', '/tasks');
    console.log(` Initial Request (Cache Populate): ${missRes.timeMs} ms [Cache Header: ${missRes.cacheHeader}]`);

    const cachedReadings = [];
    for (let i = 1; i <= 3; i++) {
      const res = await makeRequest('GET', '/tasks');
      cachedReadings.push(res.timeMs);
      console.log(` Sample #${i} (Cache Hit): ${res.timeMs} ms [Cache Header: ${res.cacheHeader}]`);
      await new Promise((r) => setTimeout(r, 100));
    }
    const avgCached = (cachedReadings.reduce((a, b) => a + b, 0) / cachedReadings.length).toFixed(2);
    const speedup = (avgUncached / avgCached).toFixed(2);
    const latencyReduction = (((avgUncached - avgCached) / avgUncached) * 100).toFixed(2);

    console.log(` Average Cached Response Time: ${avgCached} ms`);
    console.log(` Performance Improvement: ${speedup}x faster (${latencyReduction}% latency reduction)\n`);

    // 5. SINGLE TASK CACHING TEST
    console.log('--- 3. Single-Task Endpoint Caching Test (GET /tasks/:id) ---');
    const testTaskId = createdTasks[0]._id.toString();
    const singleMiss = await makeRequest('GET', `/tasks/${testTaskId}`);
    console.log(` GET /tasks/${testTaskId} (Initial - MISS): ${singleMiss.timeMs} ms [Header: ${singleMiss.cacheHeader}]`);

    const singleHit = await makeRequest('GET', `/tasks/${testTaskId}`);
    console.log(` GET /tasks/${testTaskId} (Second - HIT): ${singleHit.timeMs} ms [Header: ${singleHit.cacheHeader}]\n`);

    // 6. CACHE INVALIDATION TEST
    console.log('--- 4. Cache Invalidation Verification (POST /tasks) ---');
    console.log('Verifying cache HIT prior to write operation...');
    const preWriteHit = await makeRequest('GET', '/tasks');
    console.log(` Pre-Write GET /tasks: ${preWriteHit.timeMs} ms [Header: ${preWriteHit.cacheHeader}]`);

    console.log('Performing POST /tasks (Adding new task)...');
    const writeRes = await makeRequest('POST', '/tasks', {
      title: 'Newly Created Task for Cache Invalidation Verification',
      description: 'Testing cache invalidation logic',
      status: 'pending',
      priority: 'high'
    });
    console.log(` POST /tasks status: ${writeRes.statusCode}`);
    console.log(` Invalidation header response: Cache keys invalidated: ${JSON.stringify(writeRes.data.invalidatedCacheKeys)}`);

    console.log('Executing post-write GET /tasks to verify Cache MISS...');
    const postWriteRes = await makeRequest('GET', '/tasks');
    console.log(` Post-Write GET /tasks: ${postWriteRes.timeMs} ms [Header: ${postWriteRes.cacheHeader}]`);

    if (postWriteRes.cacheHeader === 'MISS') {
      console.log(' SUCCESS: Cache key "all_tasks" was successfully invalidated after write operation!\n');
    } else {
      console.log(' FAILURE: Cache key was NOT invalidated!\n');
    }

    // 7. FETCH DEBUG METRICS
    console.log('--- 5. Debug Endpoint Metrics (GET /tasks/cache/stats) ---');
    const statsRes = await makeRequest('GET', '/tasks/cache/stats');
    console.log(JSON.stringify(statsRes.data, null, 2));

    // 8. PRINT SUMMARY MARKDOWN TABLE FOR LAB REPORT
    console.log('\n======================================================');
    console.log(' EMPIRICAL PERFORMANCE COMPARISON SUMMARY');
    console.log('======================================================');
    console.log(`
| Request Type | Sample 1 | Sample 2 | Sample 3 | Average Time | Cache Header |
|--------------|----------|----------|----------|--------------|--------------|
| Uncached     | ${uncachedReadings[0]} ms   | ${uncachedReadings[1]} ms   | ${uncachedReadings[2]} ms   | ${avgUncached} ms     | BYPASS       |
| Cached       | ${cachedReadings[0]} ms   | ${cachedReadings[1]} ms   | ${cachedReadings[2]} ms   | ${avgCached} ms       | HIT          |
    `);

  } catch (err) {
    console.error('Benchmark execution error:', err);
  } finally {
    server.close(() => {
      mongoose.connection.close();
      console.log('Benchmark completed successfully. Server shut down.');
      process.exit(0);
    });
  }
}

runBenchmark();
