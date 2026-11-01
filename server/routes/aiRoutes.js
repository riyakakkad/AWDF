const express = require('express');
const router = express.Router();
const { generateTaskDescription } = require('../services/aiService');

/**
 * @route   GET /api/ai/status
 * @desc    Healthcheck and configuration diagnostic endpoint for AI integration
 * @access  Public
 */
router.get('/status', (req, res) => {
  const hasKey = Boolean(process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('demo_'));
  res.json({
    status: 'online',
    feature: 'AI-Powered Task Assistant (Practical 13)',
    provider: 'OpenAI GPT-4o-mini',
    apiKeyConfigured: hasKey,
    gracefulDegradationEnabled: true,
    supportedEndpoints: {
      generateDescription: 'POST /api/ai/generate-description',
      suggestTask: 'POST /api/ai/suggest-task',
      status: 'GET /api/ai/status'
    }
  });
});

/**
 * @route   POST /api/ai/generate-description
 * @desc    Generate AI task description with graceful degradation (Lab Step 3)
 * @access  Public
 */
router.post('/generate-description', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({
        error: 'Task title is required to generate description',
        fallback: false
      });
    }

    const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const result = await generateTaskDescription(title, clientIp);

    // Return status 200 even on fallback (graceful degradation guarantee)
    res.status(200).json({
      status: 'success',
      description: result.description,
      suggestedPriority: result.suggestedPriority,
      suggestedDueDate: result.suggestedDueDate,
      fallback: result.fallback,
      source: result.source,
      disclaimer: result.disclaimer,
      message: result.message || 'Description generated successfully'
    });
  } catch (err) {
    // Top-level safety catch ensuring server never crashes
    console.error('[AI Route Error]:', err.message);
    res.status(200).json({
      status: 'fallback',
      description: `Task: ${req.body.title || 'Untitled'}. Please add implementation details.`,
      suggestedPriority: 'medium',
      fallback: true,
      source: 'emergency-fallback',
      disclaimer: 'Generated via emergency fallback due to unexpected error.',
      message: err.message
    });
  }
});

/**
 * @route   POST /api/ai/suggest-task
 * @desc    Generate full task suggestion (title, description, priority, deadline)
 * @access  Public
 */
router.post('/suggest-task', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const clientIp = req.ip || '127.0.0.1';
    const result = await generateTaskDescription(title, clientIp);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch {
    res.status(200).json({
      success: true,
      data: {
        description: `Action plan for ${req.body.title}: Implement features and verify with tests.`,
        suggestedPriority: 'medium',
        fallback: true
      }
    });
  }
});

module.exports = router;
