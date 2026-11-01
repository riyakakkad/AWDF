const request = require('supertest');
const { app } = require('../server');
const Task = require('../models/Task');
const { cache, resetStats } = require('../cache');
const { taskEventEmitter } = require('../events/taskEventEmitter');

// Mock Task model to make tests 100% self-contained, blazing fast (<1s), and reliable in CI
jest.mock('../models/Task');

describe('Task Management API Test Suite - GitHub Actions CI Pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cache.flushAll();
    resetStats();
    taskEventEmitter.clearEventLogs();
  });

  // Test 1: Root Welcome API Endpoint (Verifies API gateway and routing)
  test('GET / returns 200 and API metadata with endpoints', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('endpoints');
    expect(res.body.endpoints.getAllTasks).toBe('GET /tasks');
  });

  // Test 2: Practical 12 Primary Step - GET /tasks returns 200 and task array
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

  // Test 3: POST /tasks Endpoint creates task and returns 201 with event tracking
  test('POST /tasks creates a new task and returns 201 with background event metadata', async () => {
    const newTaskPayload = {
      title: 'Automate CI with GitHub Actions',
      description: 'Implement automated testing and continuous integration workflow',
      priority: 'high',
      dueDate: new Date(Date.now() + 86400000).toISOString()
    };

    const createdTask = {
      _id: 'mock-task-id-123',
      ...newTaskPayload,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    Task.create.mockResolvedValue(createdTask);

    const res = await request(app)
      .post('/tasks')
      .send(newTaskPayload);

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data._id).toBe('mock-task-id-123');
    expect(res.body.data.title).toBe(newTaskPayload.title);
    expect(res.body).toHaveProperty('backgroundProcessing');
    expect(res.body.backgroundProcessing.status).toBe('dispatched');
  });

  // Test 4: In-Memory Caching Verification (HIT vs MISS)
  test('GET /tasks verifies cache MISS on first query and HIT on second query', async () => {
    const mockTasks = [
      { _id: 'cached-1', title: 'Cached Task Verification', priority: 'medium' }
    ];

    Task.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockTasks)
      })
    });

    // 1st request -> Database query (MISS)
    const missRes = await request(app).get('/tasks');
    expect(missRes.statusCode).toBe(200);
    expect(missRes.headers['x-cache']).toBe('MISS');
    expect(missRes.body.cacheStatus).toBe('MISS');

    // 2nd request -> In-Memory cache (HIT)
    const hitRes = await request(app).get('/tasks');
    expect(hitRes.statusCode).toBe(200);
    expect(hitRes.headers['x-cache']).toBe('HIT');
    expect(hitRes.body.cacheStatus).toBe('HIT');
    expect(hitRes.body.data[0].title).toBe('Cached Task Verification');
  });

  // Test 5: Background EventEmitter Audit Log Endpoint
  test('GET /tasks/events/logs returns 200 with background event records', async () => {
    const newTaskPayload = {
      title: 'Event Logger Test',
      description: 'Verify EventEmitter decoupled logging',
      priority: 'low'
    };

    Task.create.mockResolvedValue({
      _id: 'mock-event-id',
      ...newTaskPayload,
      status: 'pending'
    });

    // Trigger POST to dispatch event
    await request(app).post('/tasks').send(newTaskPayload);

    // Query event logs endpoint
    const res = await request(app).get('/tasks/events/logs');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.count).toBeGreaterThan(0);
    expect(res.body.data[0].event).toBe('task:created');
  });

  // Test 6: Cache Statistics Endpoint
  test('GET /tasks/cache/stats returns 200 with valid cache metrics', async () => {
    const res = await request(app).get('/tasks/cache/stats');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('hits');
    expect(res.body.data).toHaveProperty('misses');
    expect(res.body.data).toHaveProperty('cachedKeysCount');
  });

  // Test 7: PUT /tasks/:id successfully updates task details
  test('PUT /tasks/:id successfully updates title, description and priority', async () => {
    const validId = '507f1f77bcf86cd799439011';
    const updatePayload = {
      title: 'Updated Task Title',
      description: 'Updated Task Description',
      priority: 'high'
    };

    const updatedTask = {
      _id: validId,
      ...updatePayload,
      status: 'pending'
    };

    Task.findByIdAndUpdate.mockResolvedValue(updatedTask);

    const res = await request(app)
      .put(`/tasks/${validId}`)
      .send(updatePayload);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data.title).toBe(updatePayload.title);
    expect(res.body.data.description).toBe(updatePayload.description);
    expect(res.body.data.priority).toBe(updatePayload.priority);
  });

  // Test 8: PUT /tasks/:id rejects invalid ObjectId format with 400
  test('PUT /tasks/:id returns 400 for invalid ObjectId format', async () => {
    const res = await request(app)
      .put('/tasks/invalid-id-format')
      .send({ title: 'New Title' });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/invalid task ID/i);
  });

  // Test 9: PUT /tasks/:id returns 404 when task not found
  test('PUT /tasks/:id returns 404 when task is not found', async () => {
    const validId = '507f1f77bcf86cd799439011';
    Task.findByIdAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .put(`/tasks/${validId}`)
      .send({ title: 'Non-existent Task' });

    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/task not found/i);
  });
});
