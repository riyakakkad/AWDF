const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const taskRoutes = require('./routes/taskRoutes');
const aiRoutes = require('./routes/aiRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/practical9_tasks';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express route logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const cacheStatus = res.getHeader('X-Cache') || 'N/A';
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms) [Cache: ${cacheStatus}]`);
  });
  next();
});

// Root API Welcome Route
app.get('/', (req, res) => {
  res.json({
    message: 'Task Management API with In-Memory Caching, Event-Driven Architecture & Responsible AI Integration (Practicals 9-13)',
    version: '1.3.0',
    endpoints: {
      getAllTasks: 'GET /tasks',
      getSingleTask: 'GET /tasks/:id',
      createTask: 'POST /tasks',
      updateTask: 'PUT /tasks/:id',
      deleteTask: 'DELETE /tasks/:id',
      cacheStats: 'GET /tasks/cache/stats',
      resetCache: 'POST /tasks/cache/reset',
      eventLogs: 'GET /tasks/events/logs',
      triggerErrorEvent: 'POST /tasks/events/test-error',
      aiGenerateDescription: 'POST /api/ai/generate-description',
      aiSuggestTask: 'POST /api/ai/suggest-task',
      aiStatus: 'GET /api/ai/status'
    }
  });
});

// Mount Routes
app.use('/tasks', taskRoutes);
app.use('/api/ai', aiRoutes);
app.use('/tasks/ai', aiRoutes);

// MongoDB connection logic with automated container retry & fallback
let serverInstance;

async function startServer() {
  const maxRetries = 3;
  let connected = false;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Connecting to MongoDB at ${MONGODB_URI} (Attempt ${attempt}/${maxRetries})...`);
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 3000
      });
      console.log(`Connected to MongoDB database at: ${MONGODB_URI}`);
      connected = true;
      break;
    } catch (err) {
      console.log(`MongoDB connection attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  if (!connected) {
    try {
      console.log('MongoDB container/local connection failed. Starting mongodb-memory-server fallback...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      const uri = mongoServer.getUri();
      await mongoose.connect(uri);
      console.log(`Connected to In-Memory MongoDB at: ${uri}`);
    } catch (memErr) {
      console.error('Fatal: Could not connect to MongoDB or start memory server:', memErr.message);
    }
  }

  serverInstance = app.listen(PORT, () => {
    console.log(`Server running successfully on http://localhost:${PORT}`);
  });

  return serverInstance;
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
