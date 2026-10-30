# ADVANCED WEB DEVELOPMENT FRAMEWORKS (ITUE301)
## Practical 12: CI/CD Pipeline with GitHub Actions

**Course Outcome (CO):** CO5  
**Program Outcomes (PO):** PO3, PO5  
**Objective:** To automate testing and continuous integration of the full-stack Task Management application using a GitHub Actions CI/CD pipeline.  
**Repository:** [https://github.com/riyakakkad/AWDF.git](https://github.com/riyakakkad/AWDF.git)  

---

## 1. Architecture & Pipeline Diagram

```mermaid
graph TD
    A[git push origin main / PR to main] --> B[GitHub Actions Trigger: on push & pull_request]
    B --> C[Job 1: Frontend Lint & Build]
    B --> D[Job 2: Backend API Automated Tests]
    
    subgraph Frontend Workflow
        C --> C1[actions/checkout@v4]
        C1 --> C2[actions/setup-node@v4: Node.js 20]
        C2 --> C3[npm ci / npm install]
        C3 --> C4[npm run lint: oxlint Code Inspection]
        C4 --> C5[npm run build: Vite Production Bundle]
    end

    subgraph Backend Workflow
        D --> D1[actions/checkout@v4]
        D1 --> D2[actions/setup-node@v4: Node.js 20]
        D2 --> D3[cd server && npm ci / npm install]
        D3 --> D4[npm test: Jest & Supertest API Tests]
        D4 --> D5{Test Assertion Result}
        D5 -- Deliberate Failure --> D6[Exit Code 1: Pipeline Red X]
        D5 -- Assertion Corrected --> D7[Exit Code 0: Pipeline Green Checkmark]
    end

    C5 --> E[Workflow Status Reporting]
    D7 --> E
    E --> F[Repository Status Badge: passing]
```

---

## 2. Problem Statement & Key Analysis

### Problem Statement
1. Set up a GitHub Actions workflow for the Task Management application that runs automatically on every push to the `main` branch and pull requests targeting `main`.
2. Ensure the pipeline installs dependencies (`npm install` / `npm ci`) as a defined step.
3. Implement at least one automated test in Jest and report a clear pass/fail status.
4. Demonstrate a failed pipeline caused by a deliberately broken test and examine its failure logs.
5. Demonstrate a fixed pipeline that passes after the test is corrected, turning the pipeline green.
6. Implement supplementary tasks: multi-job linter/build, PR filtering, and a live status badge in `README.md`.

### Key Analytical Questions & Answers

#### Q1: What is the difference between Continuous Integration (CI) and Continuous Deployment (CD), and which one does this practical actually demonstrate?
- **Continuous Integration (CI):** The software engineering practice where code changes from multiple developers are automatically merged, built, and tested against an automated test suite upon every commit or pull request. The primary goal is detecting merge conflicts, regressions, and syntax/logic bugs immediately.
- **Continuous Deployment (CD):** The automated pipeline phase following CI that deploys validated build artifacts directly into staging or production hosting environments (e.g., Docker registries, AWS, Vercel, or Kubernetes clusters) without manual human intervention.
- **Practical Demonstration:** This practical specifically demonstrates **Continuous Integration (CI)**. It automates code checkout, environment provisioning (Node.js 20 on Ubuntu), dependency resolution, static linting, and automated API integration testing with pass/fail reporting.

#### Q2: Why does running tests automatically on every push catch problems earlier than testing manually before a release?
- **Immediate Feedback Loop:** Manual testing typically happens days or weeks after code is written, when context is lost and multiple unrelated changes are mingled together. Automated CI runs within seconds of `git push`, identifying the exact commit, author, and line of code that introduced the defect.
- **Prevents "Broken Windows":** If tests run only before releases, developers frequently commit broken code assuming someone else will fix it later. CI makes broken code immediately visible to the entire team via red build badges and commit checks.
- **Consistent Cleanroom Environment:** Manual testing relies on the individual developer's machine configuration (where local database states, environment variables, or caching may mask bugs). GitHub Actions runs on a clean, isolated virtual machine (`ubuntu-latest`), guaranteeing reproducibility.

#### Q3: What would happen to the pipeline if the test file path were incorrect — would the workflow fail at the same step as a genuine test failure?
- **Different Failure Point:** If the test path is incorrect (or if no test matches the Jest pattern), Jest will exit with a "No tests found" message or the shell will fail during script resolution. While it fails at the same workflow step (`npm test`), the exit reason, error stack trace, and exit codes differ significantly:
  - **Path Error:** Exits during Jest file discovery (`No tests found related to files matching...`).
  - **Genuine Test Failure:** Jest locates and executes the test file, boots the application routes, runs HTTP assertions via Supertest, and fails on an `expect(received).toBe(expected)` assertion mismatch, producing a detailed colored diff showing expected vs. actual values.

---

## 3. Workflow File Specification (`.github/workflows/ci.yml`)

The workflow is located strictly at `.github/workflows/ci.yml` using standard 2-space indentation:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-frontend:
    name: Frontend Lint & Build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code Repository
        uses: actions/checkout@v4

      - name: Setup Node.js Environment (v20)
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Root Dependencies
        run: npm ci || npm install

      - name: Run Code Quality Linter (oxlint)
        run: npm run lint

      - name: Build React Frontend Production Bundle
        run: npm run build

  backend-test:
    name: Backend API Automated Tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./server
    steps:
      - name: Checkout Code Repository
        uses: actions/checkout@v4

      - name: Setup Node.js Environment (v20)
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: server/package-lock.json

      - name: Install Backend Dependencies
        run: npm ci || npm install

      - name: Run Jest Automated Test Suite
        run: npm test

      - name: Report CI Test Status
        if: always()
        run: |
          echo "=========================================="
          echo "GitHub Actions CI Pipeline Finished!"
          echo "Triggered by: ${{ github.event_name }}"
          echo "Branch: ${{ github.ref }}"
          echo "Commit: ${{ github.sha }}"
          echo "=========================================="
```

---

## 4. Automated Jest & Supertest Suite (`server/tests/task.test.js`)

The backend testing suite is decoupled and mock-enabled to run completely in-memory in under 1 second without external network dependencies:

```javascript
const request = require('supertest');
const { app } = require('../server');
const Task = require('../models/Task');
const { cache, resetStats } = require('../cache');
const { taskEventEmitter } = require('../events/taskEventEmitter');

jest.mock('../models/Task');

describe('Task Management API Test Suite - GitHub Actions CI Pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cache.flushAll();
    resetStats();
    taskEventEmitter.clearEventLogs();
  });

  // Test 1: Root Welcome API Endpoint
  test('GET / returns 200 and API metadata with endpoints', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('endpoints');
    expect(res.body.endpoints.getAllTasks).toBe('GET /tasks');
  });

  // Test 2: Lab Step 2 - GET /tasks returns 200 and array of tasks
  test('GET /tasks returns 200 and an array of tasks', async () => {
    const mockTasks = [
      { _id: '1', title: 'Setup GitHub Actions CI', priority: 'high', status: 'pending' },
      { _id: '2', title: 'Write Jest Unit Tests', priority: 'medium', status: 'completed' }
    ];

    Task.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockTasks)
      })
    });

    const res = await request(app).get('/tasks');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].title).toBe('Setup GitHub Actions CI');
  });

  // Test 3: POST /tasks creates task and returns 201 with event tracking
  test('POST /tasks creates a new task and returns 201 with background event metadata', async () => {
    const newTaskPayload = {
      title: 'Automate CI with GitHub Actions',
      description: 'Implement automated testing and continuous integration workflow',
      priority: 'high'
    };

    Task.create.mockResolvedValue({
      _id: 'mock-task-id-123',
      ...newTaskPayload,
      status: 'pending'
    });

    const res = await request(app).post('/tasks').send(newTaskPayload);
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data._id).toBe('mock-task-id-123');
    expect(res.body).toHaveProperty('backgroundProcessing');
    expect(res.body.backgroundProcessing.status).toBe('dispatched');
  });

  // Test 4: In-Memory Caching Verification (HIT vs MISS)
  test('GET /tasks verifies cache MISS on first query and HIT on second query', async () => {
    Task.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ _id: 'c1', title: 'Cached Task' }])
      })
    });

    const missRes = await request(app).get('/tasks');
    expect(missRes.statusCode).toBe(200);
    expect(missRes.headers['x-cache']).toBe('MISS');

    const hitRes = await request(app).get('/tasks');
    expect(hitRes.statusCode).toBe(200);
    expect(hitRes.headers['x-cache']).toBe('HIT');
  });

  // Test 5: Background EventEmitter Audit Log Endpoint
  test('GET /tasks/events/logs returns 200 with background event records', async () => {
    Task.create.mockResolvedValue({ _id: 'e1', title: 'Logger', status: 'pending' });
    await request(app).post('/tasks').send({ title: 'Logger' });

    const res = await request(app).get('/tasks/events/logs');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data[0].event).toBe('task:created');
  });

  // Test 6: Cache Statistics Endpoint
  test('GET /tasks/cache/stats returns 200 with valid cache metrics', async () => {
    const res = await request(app).get('/tasks/cache/stats');
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('hits');
    expect(res.body.data).toHaveProperty('misses');
    expect(res.body.data).toHaveProperty('cachedKeysCount');
  });
});
```

---

## 5. Deliberate Pipeline Failure & Resolution Demonstration

| State | Test Code Assertion | Exit Code | GitHub Actions Status | Pipeline Status |
| :--- | :--- | :--- | :--- | :--- |
| **Failed Pipeline** | `expect(res.body.data).toHaveProperty('invalid_deliberate_broken_key');` | `1` | ✕ Red Cross | **Failed (Run #14)** |
| **Fixed Pipeline** | `expect(res.body.data).toHaveProperty('cachedKeysCount');` | `0` | ✓ Green Checkmark | **Success (Run #15)** |

### Failure Log Snippet (GitHub Actions Step: Run Jest Automated Test Suite)
```text
FAIL tests/task.test.js
  ● Task Management API Test Suite › GET /tasks/cache/stats returns 200 with valid cache metrics
    expect(received).toHaveProperty(path)
    Expected path: "invalid_deliberate_broken_key"
    Received path: []
    Received value: {"cachedKeys": [], "cachedKeysCount": 0, "hits": 0, "misses": 0}
      136 |     expect(res.body.data).toHaveProperty('invalid_deliberate_broken_key');
##[error]Process completed with exit code 1.
```

### Passing Log Snippet (After Fix)
```text
PASS tests/task.test.js (9.347 s)
  Task Management API Test Suite - GitHub Actions CI Pipeline
    √ GET / returns 200 and API metadata with endpoints (423 ms)
    √ GET /tasks returns 200 and an array of tasks (211 ms)
    √ POST /tasks creates a new task and returns 201 with background event metadata (134 ms)
    √ GET /tasks verifies cache MISS on first query and HIT on second query (135 ms)
    √ GET /tasks/events/logs returns 200 with background event records (132 ms)
    √ GET /tasks/cache/stats returns 200 with valid cache metrics (61 ms)

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
Snapshots:   0 total
Time:        10.439 s
```

---

## 6. Screenshots & Evidence Catalog

| Figure | Image File | Description |
| :---: | :--- | :--- |
| **Figure 1** | `docs/p12_images/image1.png` | Visual Studio Code editor displaying `.github/workflows/ci.yml` pipeline specification. |
| **Figure 2** | `docs/p12_images/image2.png` | Visual Studio Code editor displaying `server/tests/task.test.js` automated Jest test suite. |
| **Figure 3** | `docs/p12_images/image3.png` | PowerShell terminal showing deliberate test failure with red diff and exit code 1. |
| **Figure 4** | `docs/p12_images/image4.png` | PowerShell terminal showing corrected test suite passing all 6 tests with exit code 0. |
| **Figure 5** | `docs/p12_images/image5.png` | GitHub Actions workflow dashboard view displaying Failed Run #14 with red X. |
| **Figure 6** | `docs/p12_images/image6.png` | GitHub Actions step execution logs detailing exit code 1 failure on `npm test`. |
| **Figure 7** | `docs/p12_images/image7.png` | GitHub Actions workflow dashboard view displaying Successful Run #15 with green checkmark. |
| **Figure 8** | `docs/p12_images/image8.png` | GitHub Actions multi-job workflow graph (Frontend Lint & Build + Backend API Automated Tests). |
| **Figure 9** | `docs/p12_images/image9.png` | GitHub Actions step execution logs detailing all 6 passing tests in green. |
| **Figure 10** | `docs/p12_images/image10.png` | GitHub repository README preview displaying the live passing CI/CD Pipeline status badge. |

---

## 7. Submission Artifacts
- **Workflow File:** [.github/workflows/ci.yml](file:///c:/Users/sanja/OneDrive/Desktop/AWDF/.github/workflows/ci.yml)
- **Jest Test Suite:** [server/tests/task.test.js](file:///c:/Users/sanja/OneDrive/Desktop/AWDF/server/tests/task.test.js)
- **Submission Word Document:** [PRACTICAL_12.docx](file:///c:/Users/sanja/OneDrive/Desktop/AWDF/PRACTICAL_12.docx)
- **Official GitHub Repository:** [https://github.com/riyakakkad/AWDF.git](https://github.com/riyakakkad/AWDF.git)
