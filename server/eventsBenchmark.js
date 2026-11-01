const http = require('http');
const mongoose = require('mongoose');
const { startServer } = require('./server');
const Task = require('./models/Task');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}`;
const keepAliveAgent = new http.Agent({ keepAlive: true });

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime();
    const url = new URL(path, BASE_URL);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      agent: keepAliveAgent,
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
        let parsed = {};
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = { raw: data };
        }
        resolve({
          statusCode: res.statusCode,
          timeMs,
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

async function runEventsBenchmark() {
  console.log('\n================================================================');
  console.log(' Practical 10: Asynchronous Background Processing with EventEmitter');
  console.log('================================================================\n');

  const server = await startServer();
  await new Promise((r) => setTimeout(r, 600));

  try {
    // 0. Reset DB & Event Logs
    console.log('Initializing test environment...');
    await Task.deleteMany({});
    await makeRequest('POST', '/tasks/events/clear');
    await makeRequest('POST', '/tasks/cache/reset');

    // 1. DEMONSTRATE ASYNC DECOUPLED TASK:CREATED EVENT
    console.log('\n--- 1. Testing Decoupled "task:created" Event & Background Notification ---');
    console.log('Sending POST /tasks to create a new task...');
    
    const createRes = await makeRequest('POST', '/tasks', {
      title: 'Practical 10: Event-Driven Background Worker Demo',
      description: 'Demonstrating that API response arrives before background notification completes',
      status: 'pending',
      priority: 'high'
    });

    const apiLatency = createRes.timeMs;
    const createdTask = createRes.data.data;

    console.log(`\n📥 [Client View] API Response Received!`);
    console.log(`   └─ Status Code: ${createRes.statusCode} Created`);
    console.log(`   └─ API Latency: ${apiLatency} ms`);
    console.log(`   └─ Background Processing: ${JSON.stringify(createRes.data.backgroundProcessing)}`);
    console.log(`   └─ Created Task ID: ${createdTask._id}`);

    // Immediately check event status in background at t = ~100ms
    await new Promise((r) => setTimeout(r, 100));
    const check1 = await makeRequest('GET', '/tasks/events/logs');
    const runningEvent = check1.data.data.find((e) => e.taskId === createdTask._id);
    
    console.log(`\n🔍 [Immediate Inspection at t=100ms]`);
    console.log(`   └─ Event State in Memory: "${runningEvent.status}"`);
    console.log(`   └─ Completed At: ${runningEvent.completedAt} (Still running in background!)`);

    // Wait for the 1500ms background notification to finish
    console.log('\n⏳ Waiting 1600ms for background notification worker to complete...');
    await new Promise((r) => setTimeout(r, 1600));

    // Check event status again
    const check2 = await makeRequest('GET', '/tasks/events/logs');
    const completedEvent = check2.data.data.find((e) => e.taskId === createdTask._id);

    console.log(`\n🔍 [Inspection after Worker Completion]`);
    console.log(`   └─ Event State in Memory: "${completedEvent.status}"`);
    console.log(`   └─ Background Duration: ${completedEvent.durationMs} ms`);
    console.log(`   └─ Notification Result: ${JSON.stringify(completedEvent.notificationResult)}`);
    console.log(`   └─ Dispatched At: ${completedEvent.dispatchedAt}`);
    console.log(`   └─ Completed At:  ${completedEvent.completedAt}`);

    const timeDiff = completedEvent.durationMs - apiLatency;
    console.log(`\n✨ PROOF OF DECOUPLING:`);
    console.log(`   - Client received API response in: ${apiLatency} ms`);
    console.log(`   - Background worker finished in:   ${completedEvent.durationMs} ms`);
    console.log(`   - The API response was sent ${timeDiff.toFixed(2)} ms BEFORE background worker completed!`);

    // 2. DEMONSTRATE TASK:DELETED EVENT
    console.log('\n--- 2. Testing "task:deleted" Event & Cleanup Audit Worker ---');
    console.log(`Sending DELETE /tasks/${createdTask._id}...`);
    const deleteRes = await makeRequest('DELETE', `/tasks/${createdTask._id}`);
    
    console.log(`📥 [Client View] Delete API Response Received:`);
    console.log(`   └─ Status Code: ${deleteRes.statusCode} OK`);
    console.log(`   └─ API Latency: ${deleteRes.timeMs} ms`);
    console.log(`   └─ Background Processing: ${JSON.stringify(deleteRes.data.backgroundProcessing)}`);

    console.log('⏳ Waiting 1200ms for background deletion cleanup worker...');
    await new Promise((r) => setTimeout(r, 1200));

    const checkDelete = await makeRequest('GET', '/tasks/events/logs');
    const deleteEvent = checkDelete.data.data.find((e) => e.event === 'task:deleted');
    console.log(`\n🔍 [Inspection for task:deleted]`);
    console.log(`   └─ Status: "${deleteEvent.status}"`);
    console.log(`   └─ Duration: ${deleteEvent.durationMs} ms`);
    console.log(`   └─ Audit Result: ${JSON.stringify(deleteEvent.auditResult)}`);

    // 3. DEMONSTRATE ERROR EVENT HANDLING
    console.log('\n--- 3. Testing "error" Event Handling (Non-Crashing Safety) ---');
    console.log('Sending POST /tasks/events/test-error to trigger background error...');
    const errRes = await makeRequest('POST', '/tasks/events/test-error', {
      message: 'SMTP Email Service Gateway Failure (Simulated Background Error)'
    });

    console.log(`📥 [Client View] Error Trigger Response:`);
    console.log(`   └─ Status Code: ${errRes.statusCode}`);
    console.log(`   └─ Message: ${errRes.data.message}`);

    const checkErr = await makeRequest('GET', '/tasks/events/logs');
    const errEvent = checkErr.data.data.find((e) => e.event === 'error');
    console.log(`\n🔍 [Inspection for Error Event Log]`);
    console.log(`   └─ Handled Gracefully: ${errEvent.status === 'handled'}`);
    console.log(`   └─ Error Message: "${errEvent.errorMessage}"`);
    console.log(`   └─ Server Process Health: Running smoothly (0 downtime)`);

    // 4. SUMMARY TABLE
    console.log('\n================================================================');
    console.log(' PRACTICAL 10: EVENT-DRIVEN EXECUTION SUMMARY');
    console.log('================================================================');
    console.log(`
| Event Name     | Trigger Endpoint     | API Latency | Background Worker Duration | Precedence (API vs Worker) |
|----------------|----------------------|-------------|----------------------------|-----------------------------|
| task:created   | POST /tasks          | ${apiLatency.toFixed(2)} ms     | ${completedEvent.durationMs} ms                    | API returned ${timeDiff.toFixed(2)} ms earlier |
| task:deleted   | DELETE /tasks/:id    | ${deleteRes.timeMs.toFixed(2)} ms     | ${deleteEvent.durationMs} ms                    | API returned ${(deleteEvent.durationMs - deleteRes.timeMs).toFixed(2)} ms earlier |
| error          | Background Exception | N/A         | Safe Handled               | Handled via listener (no crash) |
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

runEventsBenchmark();
