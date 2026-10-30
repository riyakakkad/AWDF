const request = require('supertest');
const { app } = require('../server');
const OpenAI = require('openai');

jest.mock('openai');

describe('Practical 13: External AI API Integration Test Suite', () => {
  const originalEnv = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'mock_valid_test_key_sk_12345';
  });

  afterAll(() => {
    process.env.OPENAI_API_KEY = originalEnv;
  });

  // Test 1: AI Health and Status Diagnostic Endpoint
  test('GET /api/ai/status returns status online with configuration metadata', async () => {
    const res = await request(app).get('/api/ai/status');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('online');
    expect(res.body.feature).toContain('AI-Powered Task Assistant');
    expect(res.body.gracefulDegradationEnabled).toBe(true);
  });

  // Test 2: Input Validation (Responsible AI)
  test('POST /api/ai/generate-description returns 400 when title is missing or empty', async () => {
    const res = await request(app)
      .post('/api/ai/generate-description')
      .send({ title: '   ' });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('Task title is required');
  });

  // Test 3: Successful OpenAI Generation Path
  test('POST /api/ai/generate-description returns AI-generated description when API succeeds', async () => {
    const mockCompletion = {
      choices: [
        {
          message: {
            content: 'Configure JWT authentication with secure HTTP-only cookies and bcrypt password hashing.'
          }
        }
      ]
    };

    OpenAI.prototype.chat = {
      completions: {
        create: jest.fn().mockResolvedValue(mockCompletion)
      }
    };

    const res = await request(app)
      .post('/api/ai/generate-description')
      .send({ title: 'Implement User Authentication' });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.fallback).toBe(false);
    expect(res.body.source).toBe('openai-gpt-4o-mini');
    expect(res.body.description).toContain('Configure JWT authentication');
    expect(res.body).toHaveProperty('disclaimer');
  });

  // Test 4: Graceful Degradation on OpenAI API Failure (e.g. 401 Unauthorized / Network Timeout)
  test('POST /api/ai/generate-description gracefully returns fallback when external AI API fails', async () => {
    OpenAI.prototype.chat = {
      completions: {
        create: jest.fn().mockRejectedValue(new Error('401 Incorrect API key provided'))
      }
    };

    const res = await request(app)
      .post('/api/ai/generate-description')
      .send({ title: 'Fix Database Connection Timeout Bug' });

    expect(res.statusCode).toBe(200);
    expect(res.body.fallback).toBe(true);
    expect(res.body.source).toBe('rule-based-fallback');
    expect(res.body.suggestedPriority).toBe('high'); // Inferred from 'Bug' keyword
    expect(res.body.description).toContain('Action plan for "Fix Database Connection Timeout Bug"');
    expect(res.body.message).toContain('External AI service temporarily unavailable');
  });

  // Test 5: Fallback Path when API Key is Placeholder or Demo Mode
  test('POST /api/ai/generate-description provides sensible fallback when demo key is configured', async () => {
    process.env.OPENAI_API_KEY = 'demo_lab_key_sk_test_placeholder';

    const res = await request(app)
      .post('/api/ai/generate-description')
      .send({ title: 'Read Research Papers on Transformers' });

    expect(res.statusCode).toBe(200);
    expect(res.body.fallback).toBe(true);
    expect(res.body.suggestedPriority).toBe('low'); // Inferred from 'Read' keyword
    expect(res.body.description).toContain('Read Research Papers on Transformers');
  });

  // Test 6: POST /api/ai/suggest-task returns complete structured suggestion
  test('POST /api/ai/suggest-task returns structured task object with deadline', async () => {
    process.env.OPENAI_API_KEY = 'demo_lab_key_sk_test_placeholder';

    const res = await request(app)
      .post('/api/ai/suggest-task')
      .send({ title: 'Deploy Container to Kubernetes' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('description');
    expect(res.body.data).toHaveProperty('suggestedDueDate');
    expect(res.body.data).toHaveProperty('suggestedPriority');
  });
});
