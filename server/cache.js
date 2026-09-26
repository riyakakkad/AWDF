const NodeCache = require('node-cache');

// Initialize NodeCache instance with standard Time-To-Live (stdTTL) of 60 seconds
const cache = new NodeCache({
  stdTTL: 60,
  checkperiod: 120,
  useClones: true
});

// Cache performance metrics tracking
let stats = {
  hits: 0,
  misses: 0,
  invalidations: 0,
  startTime: new Date().toISOString()
};

const recordHit = () => {
  stats.hits += 1;
};

const recordMiss = () => {
  stats.misses += 1;
};

const recordInvalidation = (count = 1) => {
  stats.invalidations += count;
};

const getStats = () => {
  const total = stats.hits + stats.misses;
  const hitRatio = total > 0 ? ((stats.hits / total) * 100).toFixed(2) + '%' : '0.00%';
  const keys = cache.keys();
  const nodeCacheStats = cache.getStats();

  return {
    hits: stats.hits,
    misses: stats.misses,
    totalRequests: total,
    hitRatio: hitRatio,
    invalidations: stats.invalidations,
    cachedKeysCount: keys.length,
    cachedKeys: keys,
    stdTTL: 60,
    nodeCacheInternalStats: nodeCacheStats,
    uptimeSeconds: Math.floor((new Date() - new Date(stats.startTime)) / 1000)
  };
};

const resetStats = () => {
  stats = {
    hits: 0,
    misses: 0,
    invalidations: 0,
    startTime: new Date().toISOString()
  };
  cache.flushAll();
};

module.exports = {
  cache,
  recordHit,
  recordMiss,
  recordInvalidation,
  getStats,
  resetStats
};
