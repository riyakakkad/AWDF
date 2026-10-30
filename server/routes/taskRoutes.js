const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const {
  cache,
  recordHit,
  recordMiss,
  recordInvalidation,
  getStats,
  resetStats
} = require('../cache');
const { taskEventEmitter, EVENTS } = require('../events/taskEventEmitter');

// Helper to measure controller execution time
const measureTime = (startHrTime) => {
  const diff = process.hrtime(startHrTime);
  return (diff[0] * 1000 + diff[1] / 1e6).toFixed(2); // ms
};

/**
 * @route   GET /tasks/events/logs
 * @desc    Expose live background EventEmitter activity & audit log
 * @access  Public
 */
router.get('/events/logs', (req, res) => {
  res.json({
    status: 'success',
    count: taskEventEmitter.getEventLogs().length,
    data: taskEventEmitter.getEventLogs()
  });
});

/**
 * @route   POST /tasks/events/clear
 * @desc    Clear in-memory event activity logs
 * @access  Public
 */
router.post('/events/clear', (req, res) => {
  taskEventEmitter.clearEventLogs();
  res.json({
    status: 'success',
    message: 'Event logs cleared successfully'
  });
});

/**
 * @route   POST /tasks/events/test-error
 * @desc    Trigger error event to demonstrate non-crashing safe background error handler
 * @access  Public
 */
router.post('/events/test-error', (req, res) => {
  const errorMessage = req.body.message || 'Simulated background notification service connection timeout';
  taskEventEmitter.emit(EVENTS.ERROR, new Error(errorMessage), {
    source: 'POST /tasks/events/test-error',
    triggeredAt: new Date().toISOString()
  });

  res.json({
    status: 'success',
    message: 'Error event dispatched successfully. EventEmitter caught it safely without crashing the server.',
    simulatedError: errorMessage
  });
});

/**
 * @route   GET /tasks/cache/stats
 * @desc    Debug endpoint exposing cache performance metrics (hits, misses, ratio)
 * @access  Public
 */
router.get('/cache/stats', (req, res) => {
  res.json({
    status: 'success',
    data: getStats()
  });
});

/**
 * @route   POST /tasks/cache/reset
 * @desc    Debug endpoint to flush cache and reset performance counters
 * @access  Public
 */
router.post('/cache/reset', (req, res) => {
  resetStats();
  res.json({
    status: 'success',
    message: 'Cache flushed and statistics reset successfully',
    data: getStats()
  });
});

/**
 * @route   GET /tasks
 * @desc    Get all tasks with server-side in-memory caching (stdTTL: 60s)
 * @access  Public
 */
router.get('/', async (req, res) => {
  const startTime = process.hrtime();
  const cacheKey = 'all_tasks';
  const forceNoCache = req.query.nocache === 'true';

  try {
    // 1. Check in-memory cache if cache bypass is not requested
    if (!forceNoCache) {
      const cachedTasks = cache.get(cacheKey);
      if (cachedTasks) {
        recordHit();
        const duration = measureTime(startTime);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Response-Time', `${duration}ms`);
        return res.json({
          source: 'cache',
          cacheStatus: 'HIT',
          responseTimeMs: parseFloat(duration),
          count: cachedTasks.length,
          data: cachedTasks
        });
      }
    }

    // 2. Cache miss or forced bypass -> Query MongoDB database
    recordMiss();
    const tasks = await Task.find().sort({ createdAt: -1 }).lean();

    // 3. Store in cache if not bypass
    if (!forceNoCache) {
      cache.set(cacheKey, tasks);
    }

    const duration = measureTime(startTime);
    res.setHeader('X-Cache', forceNoCache ? 'BYPASS' : 'MISS');
    res.setHeader('X-Response-Time', `${duration}ms`);

    return res.json({
      source: 'database',
      cacheStatus: forceNoCache ? 'BYPASS' : 'MISS',
      responseTimeMs: parseFloat(duration),
      count: tasks.length,
      data: tasks
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks', details: error.message });
  }
});

/**
 * @route   GET /tasks/:id
 * @desc    Get single task by ID with individual key caching (Supplementary Problem)
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  const startTime = process.hrtime();
  const taskId = req.params.id;
  const cacheKey = `task_${taskId}`;
  const forceNoCache = req.query.nocache === 'true';

  try {
    if (!forceNoCache) {
      const cachedTask = cache.get(cacheKey);
      if (cachedTask) {
        recordHit();
        const duration = measureTime(startTime);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Response-Time', `${duration}ms`);
        return res.json({
          source: 'cache',
          cacheStatus: 'HIT',
          responseTimeMs: parseFloat(duration),
          data: cachedTask
        });
      }
    }

    recordMiss();
    const task = await Task.findById(taskId).lean();
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!forceNoCache) {
      cache.set(cacheKey, task);
    }

    const duration = measureTime(startTime);
    res.setHeader('X-Cache', forceNoCache ? 'BYPASS' : 'MISS');
    res.setHeader('X-Response-Time', `${duration}ms`);

    return res.json({
      source: 'database',
      cacheStatus: forceNoCache ? 'BYPASS' : 'MISS',
      responseTimeMs: parseFloat(duration),
      data: task
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch task', details: error.message });
  }
});

/**
 * @route   POST /tasks
 * @desc    Create a new task, invalidate cache, and emit decoupled 'task:created' event
 * @access  Public
 */
router.post('/', async (req, res) => {
  const startTime = process.hrtime();
  try {
    const { title, description, status, priority, dueDate } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const newTask = await Task.create({
      title,
      description: description || '',
      status: status || 'pending',
      priority: priority || 'medium',
      dueDate: dueDate || null
    });

    // Invalidate 'all_tasks' cache key to guarantee data correctness
    const deletedCount = cache.del('all_tasks');
    recordInvalidation(deletedCount || 1);

    const duration = measureTime(startTime);
    const dispatchedAt = new Date().toISOString();

    // Emit decoupled custom event 'task:created' for asynchronous background notification
    taskEventEmitter.emit(EVENTS.TASK_CREATED, newTask, {
      dispatchedAt,
      apiResponseSentAt: new Date().toISOString()
    });

    // Response is returned immediately to client before background worker finishes
    res.status(201).json({
      message: 'Task created successfully',
      responseTimeMs: parseFloat(duration),
      backgroundProcessing: {
        event: EVENTS.TASK_CREATED,
        decoupled: true,
        status: 'dispatched',
        message: 'Notification processing executing asynchronously in background'
      },
      invalidatedCacheKeys: ['all_tasks'],
      data: newTask
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task', details: error.message });
  }
});

/**
 * @route   PUT /tasks/:id
 * @desc    Update task and invalidate both 'all_tasks' and single task cache keys
 * @access  Public
 */
router.put('/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const updatedTask = await Task.findByIdAndUpdate(taskId, req.body, {
      new: true,
      runValidators: true
    });

    if (!updatedTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Invalidate both the list cache and specific single-task cache
    const keysToInvalidate = ['all_tasks', `task_${taskId}`];
    const deletedCount = cache.del(keysToInvalidate);
    recordInvalidation(deletedCount || keysToInvalidate.length);

    res.json({
      message: 'Task updated successfully',
      invalidatedCacheKeys: keysToInvalidate,
      data: updatedTask
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task', details: error.message });
  }
});

/**
 * @route   DELETE /tasks/:id
 * @desc    Delete task, invalidate cache, and emit decoupled 'task:deleted' event
 * @access  Public
 */
router.delete('/:id', async (req, res) => {
  const startTime = process.hrtime();
  try {
    const taskId = req.params.id;
    const deletedTask = await Task.findByIdAndDelete(taskId);

    if (!deletedTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Invalidate list cache and specific single-task cache
    const keysToInvalidate = ['all_tasks', `task_${taskId}`];
    const deletedCount = cache.del(keysToInvalidate);
    recordInvalidation(deletedCount || keysToInvalidate.length);

    const duration = measureTime(startTime);
    const dispatchedAt = new Date().toISOString();

    // Emit decoupled custom event 'task:deleted' for asynchronous background audit/cleanup
    taskEventEmitter.emit(EVENTS.TASK_DELETED, { id: taskId, title: deletedTask.title }, {
      dispatchedAt,
      apiResponseSentAt: new Date().toISOString()
    });

    res.json({
      message: 'Task deleted successfully',
      responseTimeMs: parseFloat(duration),
      backgroundProcessing: {
        event: EVENTS.TASK_DELETED,
        decoupled: true,
        status: 'dispatched',
        message: 'Task cleanup & audit logging processing in background'
      },
      invalidatedCacheKeys: keysToInvalidate,
      deletedTaskId: taskId
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task', details: error.message });
  }
});

module.exports = router;
