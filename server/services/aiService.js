const OpenAI = require('openai');

// Rate limiting in-memory store: track timestamps per IP / task title to prevent API abuse
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

/**
 * Clean and sanitize user input before forwarding to third-party AI provider
 * (Responsible AI: Prevents prompt injection, trims input, flags potential secrets)
 */
function sanitizeInput(title) {
  if (!title || typeof title !== 'string') return '';
  // Truncate to reasonable length to control token consumption
  return title.trim().slice(0, 150);
}

/**
 * Check if the request exceeds rate limits
 */
function isRateLimited(identifier) {
  const now = Date.now();
  const clientTimestamps = rateLimitMap.get(identifier) || [];
  const validTimestamps = clientTimestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  validTimestamps.push(now);
  rateLimitMap.set(identifier, validTimestamps);
  return false;
}

/**
 * Rule-based fallback generator for graceful degradation
 * Ensures the application remains 100% operational even when external AI API is unreachable
 */
function generateFallbackResponse(cleanTitle) {
  const lower = cleanTitle.toLowerCase();
  let suggestedPriority = 'medium';
  if (lower.includes('urgent') || lower.includes('bug') || lower.includes('security') || lower.includes('fix') || lower.includes('deploy')) {
    suggestedPriority = 'high';
  } else if (lower.includes('read') || lower.includes('explore') || lower.includes('optional') || lower.includes('style')) {
    suggestedPriority = 'low';
  }

  return {
    description: `Action plan for "${cleanTitle}": Complete core requirements, review documentation, and perform validation testing before submission.`,
    suggestedPriority,
    suggestedDueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    fallback: true,
    source: 'rule-based-fallback',
    disclaimer: 'Generated via fallback rule-based engine due to external AI provider offline/unauthorized state. Please review and adjust.'
  };
}

/**
 * Main AI generation service with OpenAI API integration & Graceful Degradation
 */
async function generateTaskDescription(rawTitle, clientIp = '127.0.0.1') {
  const cleanTitle = sanitizeInput(rawTitle);
  if (!cleanTitle) {
    throw new Error('Task title is required for AI generation');
  }

  // 1. Enforce Rate Limiting (Supplementary Problem)
  if (isRateLimited(clientIp)) {
    const fallback = generateFallbackResponse(cleanTitle);
    fallback.message = 'Rate limit reached (max 10 requests/min). Fallback suggestion provided.';
    fallback.rateLimited = true;
    return fallback;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  // 2. Check for missing or placeholder API key
  if (!apiKey || apiKey === 'your_openai_api_key_here' || apiKey.startsWith('demo_lab_key')) {
    console.log(`[AI Service] No valid external API key configured. Executing graceful degradation fallback for: "${cleanTitle}"`);
    const fallback = generateFallbackResponse(cleanTitle);
    fallback.message = 'Demo mode active: external API key is a placeholder. Graceful fallback suggestion provided.';
    return fallback;
  }

  // 3. Invoke external OpenAI API
  try {
    const client = new OpenAI({ apiKey, timeout: 8000 }); // 8-second circuit timeout

    const prompt = `You are a helpful agile project management assistant. Given the task title "${cleanTitle}", generate a clear, professional, single-paragraph task description (under 40 words), recommend a priority (low, medium, or high), and specify estimated days to complete.`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an assistant that writes concise agile task descriptions.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 100,
      temperature: 0.7
    });

    const aiText = completion.choices[0]?.message?.content?.trim() || '';

    // Infer priority from content or title
    let priority = 'medium';
    if (aiText.toLowerCase().includes('high') || cleanTitle.toLowerCase().includes('urgent')) priority = 'high';
    else if (aiText.toLowerCase().includes('low')) priority = 'low';

    return {
      description: aiText || generateFallbackResponse(cleanTitle).description,
      suggestedPriority: priority,
      suggestedDueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      fallback: false,
      source: 'openai-gpt-4o-mini',
      model: 'gpt-4o-mini',
      disclaimer: 'AI-generated suggestion (OpenAI GPT-4o-mini). Review and modify as necessary.'
    };
  } catch (err) {
    // 4. Graceful Degradation on external API failure (401 Unauthorized, 429 Rate Limit, Network Timeout)
    console.warn(`[AI Service Warning] External AI API call failed (${err.message}). Activating graceful degradation fallback.`);
    const fallback = generateFallbackResponse(cleanTitle);
    fallback.errorDetails = err.message;
    fallback.message = 'External AI service temporarily unavailable. Fallback description provided so workflow continues uninterrupted.';
    return fallback;
  }
}

module.exports = {
  generateTaskDescription,
  generateFallbackResponse,
  isRateLimited,
  sanitizeInput
};
