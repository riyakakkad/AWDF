const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const taskRoutes = require('./routes/taskRoutes');

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
    message: 'Task Management API with In-Memory Caching (Practical 9)',
    version: '1.0.0',
    endpoints: {
      getAllTasks: 'GET /tasks',
      getSingleTask: 'GET /tasks/:id',
      createTask: 'POST /tasks',
      updateTask: 'PUT /tasks/:id',
      deleteTask: 'DELETE /tasks/:id',
      cacheStats: 'GET /tasks/cache/stats',
      resetCache: 'POST /tasks/cache/reset'
    }
  });
});

// Mount Task Routes
app.use('/tasks', taskRoutes);

// MongoDB connection logic with automated Memory Server fallback
let serverInstance;

async function startServer() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 2000
    });
    console.log(`Connected to MongoDB database at: ${MONGODB_URI}`);
  } catch (err) {
    console.log('Local MongoDB connection failed/not found. Starting mongodb-memory-server fallback...');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log(`Connected to In-Memory MongoDB at: ${uri}`);
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
