const { EventEmitter } = require('events');

// Event name constants
const EVENTS = {
  TASK_CREATED: 'task:created',
  TASK_DELETED: 'task:deleted',
  ERROR: 'error'
};

// In-memory event activity and audit log for inspection & verification
const eventLogs = [];

class TaskEventEmitter extends EventEmitter {
  constructor() {
    super();
    // Increase max listeners if needed
    this.setMaxListeners(20);
    this.registerDefaultListeners();
  }

  /**
   * Register default decoupled background listeners
   */
  registerDefaultListeners() {
    // 1. Background Listener: task:created
    this.on(EVENTS.TASK_CREATED, async (task, meta = {}) => {
      const eventId = `evt_create_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const startTime = Date.now();

      const logEntry = {
        eventId,
        event: EVENTS.TASK_CREATED,
        taskId: task._id || task.id,
        taskTitle: task.title,
        status: 'processing',
        dispatchedAt: meta.dispatchedAt || new Date().toISOString(),
        apiResponseSentAt: meta.apiResponseSentAt || new Date().toISOString(),
        completedAt: null,
        durationMs: null,
        details: 'Simulating decoupled email/push notification delivery'
      };
      eventLogs.unshift(logEntry);

      console.log(`\n🔔 [EventEmitter: ${EVENTS.TASK_CREATED}] Event received for task "${task.title}" (ID: ${task._id})`);
      console.log(`   └─ Status: API response already sent! Background notification worker starting...`);

      // Asynchronous background simulation (1500ms delay, non-blocking)
      setTimeout(() => {
        const completedAt = new Date().toISOString();
        const durationMs = Date.now() - startTime;

        logEntry.status = 'completed';
        logEntry.completedAt = completedAt;
        logEntry.durationMs = durationMs;
        logEntry.notificationResult = {
          channel: 'Email / Webhook',
          recipient: 'team-lead@company.org',
          subject: `New Task Assigned: ${task.title}`,
          delivered: true
        };

        console.log(`✅ [EventEmitter: ${EVENTS.TASK_CREATED}] Background notification finished for task "${task.title}"!`);
        console.log(`   └─ Duration: ${durationMs}ms (Completed AFTER API response was sent)\n`);
      }, 1500);
    });

    // 2. Background Listener: task:deleted
    this.on(EVENTS.TASK_DELETED, async (taskInfo, meta = {}) => {
      const eventId = `evt_del_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const startTime = Date.now();

      const logEntry = {
        eventId,
        event: EVENTS.TASK_DELETED,
        taskId: taskInfo.id || taskInfo._id,
        taskTitle: taskInfo.title || 'Untitled Task',
        status: 'processing',
        dispatchedAt: meta.dispatchedAt || new Date().toISOString(),
        apiResponseSentAt: meta.apiResponseSentAt || new Date().toISOString(),
        completedAt: null,
        durationMs: null,
        details: 'Simulating task cleanup & deletion audit notification'
      };
      eventLogs.unshift(logEntry);

      console.log(`\n🗑️ [EventEmitter: ${EVENTS.TASK_DELETED}] Event received for deleted task "${taskInfo.title}"`);
      console.log(`   └─ Status: API response sent! Background audit log starting...`);

      setTimeout(() => {
        const durationMs = Date.now() - startTime;
        logEntry.status = 'completed';
        logEntry.completedAt = new Date().toISOString();
        logEntry.durationMs = durationMs;
        logEntry.auditResult = {
          archived: true,
          auditLoggedBy: 'AuditLogWorkerService',
          retainedUntil: new Date(Date.now() + 30 * 86400000).toISOString()
        };

        console.log(`✅ [EventEmitter: ${EVENTS.TASK_DELETED}] Background audit cleanup completed for "${taskInfo.title}" (${durationMs}ms)!\n`);
      }, 1000);
    });

    // 3. Error Event Listener (Prevents process crash on unhandled error)
    this.on(EVENTS.ERROR, (err, context = {}) => {
      const eventId = `evt_err_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const errorEntry = {
        eventId,
        event: EVENTS.ERROR,
        status: 'handled',
        timestamp: new Date().toISOString(),
        errorMessage: err.message,
        stack: err.stack,
        context: context.source || 'General Background Processing'
      };
      eventLogs.unshift(errorEntry);

      console.error(`\n⚠️ [EventEmitter: ERROR] Handled background error safely (prevented server crash):`);
      console.error(`   └─ Message: ${err.message}`);
      console.error(`   └─ Context: ${context.source || 'Unknown'}\n`);
    });
  }

  /**
   * Helper to retrieve all recorded event activity logs
   */
  getEventLogs(limit = 20) {
    return eventLogs.slice(0, limit);
  }

  /**
   * Helper to clear event logs
   */
  clearEventLogs() {
    eventLogs.length = 0;
  }
}

// Export singleton instance
const taskEventEmitter = new TaskEventEmitter();

module.exports = {
  taskEventEmitter,
  EVENTS
};
