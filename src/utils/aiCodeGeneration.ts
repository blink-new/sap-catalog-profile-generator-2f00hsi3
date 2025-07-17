// AI-powered component code generation with multiple model support
import { blink } from '../blink/client';
import { ComponentCodeTrainingData, AIModelPerformance } from '../types';
import { COMPONENT_CODE_TRAINING_DATA } from './componentCodeTrainingData';
import { addAIModelPerformance } from './dataStorage';
import { notifications } from './notifications';
import Fuse from 'fuse.js';

// Available AI models for code generation (ONLY FREE MODELS)
// Reordered to prioritize more reliable models with better rate limits
export const AI_MODELS = [
  { name: 'Google Gemini 2.0 Flash', id: 'google/gemini-2.0-flash-exp:free', primary: true, rateLimitPerMin: 30 },
  { name: 'DeepSeek R1', id: 'deepseek/deepseek-r1:free', fallback: true, rateLimitPerMin: 25 },
  { name: 'Llama 3.3 70B', id: 'meta-llama/llama-3.3-70b-instruct:free', fallback: true, rateLimitPerMin: 25 },
  { name: 'Phi-4', id: 'microsoft/phi-4:free', fallback: true, rateLimitPerMin: 20 },
  { name: 'Qwen 2.5 72B', id: 'qwen/qwen-2.5-72b-instruct:free', fallback: true, rateLimitPerMin: 20 },
  { name: 'Tencent Hunyuan A13B', id: 'tencent/hunyuan-a13b-instruct:free', fallback: true, rateLimitPerMin: 10 } // Moved to last due to rate limit issues
];

// Enhanced rate limiting tracking with circuit breaker
const modelUsageTracker = new Map<string, { 
  lastUsed: number; 
  requestCount: number; 
  resetTime: number;
  consecutiveFailures: number;
  circuitBreakerUntil: number;
}>();

// Request queue for handling rate limits gracefully
interface QueuedRequest {
  modelId: string;
  prompt: string;
  componentName: string;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

const requestQueue: QueuedRequest[] = [];

// Helper function to check if we can use a model (rate limiting + circuit breaker)
const canUseModel = (modelId: string, rateLimitPerMin: number): boolean => {
  const now = Date.now();
  const tracker = modelUsageTracker.get(modelId);
  
  if (!tracker) {
    modelUsageTracker.set(modelId, { 
      lastUsed: now, 
      requestCount: 0, // Start at 0, will increment when actually used
      resetTime: now + 60000,
      consecutiveFailures: 0,
      circuitBreakerUntil: 0
    });
    return true;
  }
  
  // Check circuit breaker first
  if (tracker.circuitBreakerUntil > now) {
    console.log(`🚫 Circuit breaker active for ${modelId} until ${new Date(tracker.circuitBreakerUntil).toLocaleTimeString()}`);
    return false;
  }
  
  // Reset counter if a minute has passed
  if (now >= tracker.resetTime) {
    tracker.requestCount = 0;
    tracker.resetTime = now + 60000;
    tracker.lastUsed = now;
    return true;
  }
  
  // Check if we're under the rate limit (less conservative approach)
  const safeLimit = Math.max(1, Math.floor(rateLimitPerMin * 0.9)); // Use 90% of limit for better utilization
  if (tracker.requestCount < safeLimit) {
    return true;
  }
  
  console.log(`⏱️ Rate limit reached for ${modelId}: ${tracker.requestCount}/${safeLimit} requests used`);
  return false;
};

// Mark model as used (increment counter)
const markModelUsed = (modelId: string): void => {
  const tracker = modelUsageTracker.get(modelId);
  if (tracker) {
    tracker.requestCount++;
    tracker.lastUsed = Date.now();
  }
};

// Mark model as failed (for circuit breaker)
const markModelFailed = (modelId: string, isRateLimit: boolean = false): void => {
  const tracker = modelUsageTracker.get(modelId);
  if (tracker) {
    tracker.consecutiveFailures++;
    
    // If it's a rate limit error, activate circuit breaker for shorter time
    if (isRateLimit) {
      tracker.circuitBreakerUntil = Date.now() + (2 * 60 * 1000); // 2 minutes instead of 5
      console.log(`🚫 Circuit breaker activated for ${modelId} due to rate limit (2 min)`);
    } else if (tracker.consecutiveFailures >= 5) { // Increased threshold from 3 to 5
      tracker.circuitBreakerUntil = Date.now() + (1 * 60 * 1000); // 1 minute instead of 2
      console.log(`🚫 Circuit breaker activated for ${modelId} due to ${tracker.consecutiveFailures} failures (1 min)`);
    }
  }
};

// Mark model as successful (reset failure counter)
const markModelSuccess = (modelId: string): void => {
  const tracker = modelUsageTracker.get(modelId);
  if (tracker) {
    tracker.consecutiveFailures = 0;
    tracker.circuitBreakerUntil = 0;
  }
};

// Helper function to get wait time until we can use a model again
const getWaitTimeForModel = (modelId: string): number => {
  const tracker = modelUsageTracker.get(modelId);
  if (!tracker) return 0;
  
  const now = Date.now();
  
  // Check circuit breaker first
  if (tracker.circuitBreakerUntil > now) {
    return tracker.circuitBreakerUntil - now;
  }
  
  // Check rate limit reset
  return Math.max(0, tracker.resetTime - now);
};

// Fuzzy search for similar component names
const fuse = new Fuse(COMPONENT_CODE_TRAINING_DATA, {
  keys: ['componentName', 'variations'],
  threshold: 0.4,
  includeScore: true
});

// Generate component code using AI with fallback models
export const generateComponentCode = async (
  componentName: string,
  existingCodes: string[] = []
): Promise<{
  code: string;
  modelUsed: string;
  responseTime: number;
  confidence: number;
}> => {
  const startTime = Date.now();
  
  // First, check if we have exact or similar matches in training data
  const exactMatch = COMPONENT_CODE_TRAINING_DATA.find(
    item => item.componentName.toLowerCase() === componentName.toLowerCase() ||
            item.variations.some(v => v.toLowerCase() === componentName.toLowerCase())
  );
  
  if (exactMatch) {
    return {
      code: exactMatch.objectPartCode,
      modelUsed: 'Training Data (Exact Match)',
      responseTime: Date.now() - startTime,
      confidence: 1.0
    };
  }
  
  // Check for fuzzy matches with more lenient threshold
  const fuzzyMatches = fuse.search(componentName);
  if (fuzzyMatches.length > 0 && fuzzyMatches[0].score! < 0.7) { // Increased from 0.6 to 0.7 for even better coverage
    console.log(`🎯 Found fuzzy match for "${componentName}": "${fuzzyMatches[0].item.componentName}" (score: ${fuzzyMatches[0].score})`);
    return {
      code: fuzzyMatches[0].item.objectPartCode,
      modelUsed: 'Training Data (Fuzzy Match)',
      responseTime: Date.now() - startTime,
      confidence: 1 - fuzzyMatches[0].score!
    };
  }
  
  // Generate using AI models with intelligent rate limiting
  const prompt = createCodeGenerationPrompt(componentName, existingCodes);
  
  // First, try models that are available (not rate limited)
  const availableModels = AI_MODELS.filter(model => canUseModel(model.id, model.rateLimitPerMin));
  const rateLimitedModels = AI_MODELS.filter(model => !canUseModel(model.id, model.rateLimitPerMin));
  
  console.log(`🔍 Available models: ${availableModels.length}, Rate limited: ${rateLimitedModels.length}`);
  
  // Log model status for debugging
  AI_MODELS.forEach(model => {
    const tracker = modelUsageTracker.get(model.id);
    if (tracker) {
      const now = Date.now();
      const isCircuitBroken = tracker.circuitBreakerUntil > now;
      const isRateLimited = tracker.requestCount >= Math.floor(model.rateLimitPerMin * 0.8);
      const waitTime = getWaitTimeForModel(model.id);
      
      console.log(`📊 ${model.name}: requests=${tracker.requestCount}/${Math.floor(model.rateLimitPerMin * 0.8)}, failures=${tracker.consecutiveFailures}, circuit=${isCircuitBroken}, wait=${Math.round(waitTime/1000)}s`);
    }
  });
  
  // Try available models first
  for (const model of availableModels) {
    try {
      console.log(`🚀 Trying available model ${model.name} for component: ${componentName}`);
      markModelUsed(model.id); // Mark as used before calling
      const result = await callAIModelWithRetry(model.id, prompt, componentName, model.rateLimitPerMin);
      const code = extractCodeFromResponse(result, componentName);
      
      if (code && code.length === 4 && !existingCodes.includes(code)) {
        markModelSuccess(model.id); // Mark as successful
        
        // Log performance
        const performance: AIModelPerformance = {
          id: `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          modelName: model.name,
          componentName,
          generatedCode: code,
          responseTimeMs: Date.now() - startTime,
          createdAt: new Date().toISOString()
        };
        addAIModelPerformance(performance);
        
        console.log(`✅ Model ${model.name} generated code: ${code}`);
        notifications.codeGenerated(componentName, code, model.name);
        return {
          code,
          modelUsed: model.name,
          responseTime: Date.now() - startTime,
          confidence: 0.8
        };
      } else {
        markModelFailed(model.id, false); // Mark as failed (invalid response)
        console.warn(`⚠️ Model ${model.name} generated invalid or duplicate code: ${code} (length: ${code?.length})`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isRateLimit = errorMessage.includes('Rate limit') || errorMessage.includes('429');
      
      markModelFailed(model.id, isRateLimit); // Mark as failed with rate limit info
      console.warn(`❌ Model ${model.name} failed:`, errorMessage);
      
      if (isRateLimit) {
        console.log(`⏱️ Model ${model.name} hit rate limit, will try others`);
        const waitTime = getWaitTimeForModel(model.id);
        notifications.rateLimitWarning(model.name, waitTime);
      } else {
        notifications.modelFailure(model.name, errorMessage);
      }
      continue;
    }
  }
  
  // If no available models worked, try rate-limited models with delays
  if (rateLimitedModels.length > 0) {
    console.log(`⏳ All available models failed, trying rate-limited models with delays...`);
    
    for (const model of rateLimitedModels) {
      const waitTime = getWaitTimeForModel(model.id);
      if (waitTime > 15000) { // Don't wait more than 15 seconds for better UX
        console.log(`⏭️ Skipping ${model.name} - wait time too long: ${Math.round(waitTime/1000)}s`);
        continue;
      }
      
      if (waitTime > 0) {
        console.log(`⏱️ Waiting ${Math.round(waitTime/1000)}s for ${model.name} rate limit reset...`);
        await new Promise(resolve => setTimeout(resolve, waitTime + 1000)); // Add 1s buffer
      }
      
      try {
        console.log(`🔄 Trying rate-limited model ${model.name} for component: ${componentName}`);
        markModelUsed(model.id); // Mark as used before calling
        const result = await callAIModelWithRetry(model.id, prompt, componentName, model.rateLimitPerMin);
        const code = extractCodeFromResponse(result, componentName);
        
        if (code && code.length === 4 && !existingCodes.includes(code)) {
          markModelSuccess(model.id); // Mark as successful
          
          // Log performance
          const performance: AIModelPerformance = {
            id: `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            modelName: model.name,
            componentName,
            generatedCode: code,
            responseTimeMs: Date.now() - startTime,
            createdAt: new Date().toISOString()
          };
          addAIModelPerformance(performance);
          
          console.log(`✅ Model ${model.name} generated code after wait: ${code}`);
          return {
            code,
            modelUsed: model.name,
            responseTime: Date.now() - startTime,
            confidence: 0.8
          };
        } else {
          markModelFailed(model.id, false); // Mark as failed (invalid response)
          console.warn(`⚠️ Model ${model.name} generated invalid or duplicate code: ${code} (length: ${code?.length})`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isRateLimit = errorMessage.includes('Rate limit') || errorMessage.includes('429');
        
        markModelFailed(model.id, isRateLimit); // Mark as failed with rate limit info
        console.warn(`❌ Model ${model.name} failed even after waiting:`, errorMessage);
        continue;
      }
    }
  }
  
  // Fallback: Generate based on component name rules
  console.log(`🔄 All AI models failed, using fallback algorithm for: ${componentName}`);
  notifications.fallbackMode(componentName);
  const fallbackCode = generateFallbackCode(componentName, existingCodes);
  console.log(`🛠️ Fallback generated code: ${fallbackCode}`);
  
  return {
    code: fallbackCode,
    modelUsed: 'Fallback Algorithm',
    responseTime: Date.now() - startTime,
    confidence: 0.6
  };
};

// Create optimized prompt for code generation
const createCodeGenerationPrompt = (componentName: string, existingCodes: string[]): string => {
  // Use fewer examples to keep prompt short
  const examples = COMPONENT_CODE_TRAINING_DATA.slice(0, 8)
    .map(item => `${item.componentName} -> ${item.objectPartCode}`)
    .join('\\n');
  
  const avoidCodes = existingCodes.length > 0 ? `\\nAvoid: ${existingCodes.slice(0, 8).join(', ')}` : '';
  
  return `Generate a 4-character SAP component code.

Rules:
- Exactly 4 characters (letters preferred)
- Use meaningful abbreviations
- 3-char names get "0" suffix (ARM -> ARM0)${avoidCodes}

Examples:
${examples}

Component: ${componentName}
Code:`;
};

// Call AI model with retry logic and exponential backoff
const callAIModelWithRetry = async (
  modelId: string, 
  prompt: string, 
  componentName?: string, 
  rateLimitPerMin: number = 20,
  maxRetries: number = 3
): Promise<string> => {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await callAIModel(modelId, prompt, componentName);
      console.log(`✅ Successfully called ${modelId} on attempt ${attempt}`);
      return result;
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message;
      
      // Handle rate limiting with exponential backoff
      if (errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
        const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Max 30s
        console.log(`⏱️ Rate limit error on attempt ${attempt}/${maxRetries}, backing off ${backoffTime/1000}s`);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          continue;
        }
      }
      
      // For other errors, don't retry
      if (!errorMessage.includes('Rate limit') && !errorMessage.includes('429')) {
        console.log(`❌ Non-rate-limit error for ${modelId}, not retrying: ${errorMessage}`);
        throw lastError;
      }
      
      // If we've exhausted retries
      if (attempt === maxRetries) {
        console.log(`❌ Max retries (${maxRetries}) reached for ${modelId}`);
        throw lastError;
      }
    }
  }
  
  throw lastError || new Error(`Failed to call ${modelId} after ${maxRetries} attempts`);
};

// Call AI model via OpenRouter or Blink SDK
const callAIModel = async (modelId: string, prompt: string, componentName?: string): Promise<string> => {
  try {
    // For now, use OpenRouter API for all models since Blink SDK might have issues
    console.log(`🔄 Calling OpenRouter API for model: ${modelId}`);
    console.log(`📝 Prompt length: ${prompt.length} characters`);
    
    // Use Blink's secure data.fetch for OpenRouter API calls
    const response = await blink.data.fetch({
      url: 'https://openrouter.ai/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer {{OPENROUTER_API_KEY}}',
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'SAP Catalog Profile Generator'
      },
      body: {
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150, // Increased from 50 to allow completion
        temperature: 0.1, // Lower temperature for more consistent results
        stream: false,
        stop: ["\\n", ".", ":", ";"] // Stop tokens to prevent rambling
      }
    });
    
    console.log(`📡 OpenRouter API Response:`, {
      status: response.status,
      durationMs: response.durationMs,
      model: modelId
    });
    
    // Handle different error status codes with specific messages
    if (response.status === 401) {
      console.error(`🔑 Authentication failed for model ${modelId}:`, response.body);
      throw new Error(`Authentication failed: Invalid or expired API key. Please check your OpenRouter API key.`);
    }
    
    if (response.status === 403) {
      console.error(`🚫 Access forbidden for model ${modelId}:`, response.body);
      throw new Error(`Access forbidden: You don't have permission to use model ${modelId}. Check your API key permissions.`);
    }
    
    if (response.status === 429) {
      console.error(`⏱️ Rate limit exceeded for model ${modelId}:`, response.body);
      throw new Error(`Rate limit exceeded: Too many requests. Please try again later.`);
    }
    
    if (response.status === 400) {
      console.error(`❌ Bad request for model ${modelId}:`, response.body);
      const errorMsg = response.body?.error?.message || 'Invalid request parameters';
      throw new Error(`Bad request: ${errorMsg}`);
    }
    
    if (response.status >= 500) {
      console.error(`🔥 Server error for model ${modelId}:`, response.body);
      throw new Error(`OpenRouter server error (${response.status}): Please try again later.`);
    }
    
    if (response.status !== 200) {
      const errorMessage = response.body?.error?.message || response.body?.message || `HTTP ${response.status}`;
      console.error(`❌ OpenRouter API Error:`, {
        status: response.status,
        error: response.body,
        model: modelId
      });
      throw new Error(`OpenRouter API error: ${response.status} - ${errorMessage}`);
    }
    
    const data = response.body;
    console.log(`📦 Response data structure:`, {
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length,
      hasUsage: !!data.usage,
      model: data.model,
      finishReason: data.choices?.[0]?.finish_reason
    });
    
    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    const reasoning = choice?.message?.reasoning;
    const finishReason = choice?.finish_reason;
    
    // Enhanced handling for empty content with reasoning (common with DeepSeek R1)
    if (!content || content.trim() === '') {
      console.warn(`⚠️ Empty content from model ${modelId}, checking reasoning...`);
      
      if (reasoning && reasoning.trim()) {
        console.log(`🔍 Extracting from reasoning for ${modelId}: "${reasoning.substring(0, 100)}..."`);
        // Use the passed componentName or extract from prompt as fallback
        const contextComponentName = componentName || (() => {
          const promptContext = prompt || '';
          const componentNameMatch = promptContext.match(/Component:\s*(.+?)(?:\n|$)/i);
          return componentNameMatch ? componentNameMatch[1].trim() : 'Unknown';
        })();
        
        const extractedCode = extractCodeFromResponse(reasoning, contextComponentName);
        if (extractedCode && extractedCode.length === 4) {
          console.log(`✅ Successfully extracted code from reasoning: ${extractedCode}`);
          return extractedCode;
        } else {
          console.warn(`❌ Failed to extract valid code from reasoning: "${extractedCode}"`);
        }
      }
      
      // If no reasoning or extraction failed, throw error to try next model
      const errorDetails = {
        content: content || 'empty',
        reasoning: reasoning ? reasoning.substring(0, 200) + '...' : 'empty',
        finishReason,
        modelId
      };
      console.error(`❌ No valid content or reasoning from ${modelId}:`, errorDetails);
      throw new Error(`Empty response from model ${modelId}. Details: ${JSON.stringify(errorDetails)}`);
    }
    
    // Handle different finish reasons for non-empty content
    if (finishReason === 'length') {
      console.warn(`⚠️ Model ${modelId} hit token limit, trying to extract from partial content`);
      
      const contextComponentName = componentName || 'Unknown';
      const extractedCode = extractCodeFromResponse(content, contextComponentName);
      if (extractedCode && extractedCode.length === 4) {
        console.log(`✅ Successfully extracted code from partial content: ${extractedCode}`);
        return extractedCode;
      } else {
        throw new Error(`Model ${modelId} hit token limit and couldn't extract valid code from partial response`);
      }
    }
    
    console.log(`✅ Successfully got response from ${modelId}: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`);
    return content;
  } catch (error) {
    console.error(`❌ Error calling model ${modelId}:`, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};

// Extract code from AI response with enhanced pattern matching
const extractCodeFromResponse = (response: string, componentName: string): string => {
  if (!response || response.trim() === '') {
    console.log(`🔄 Empty response, using fallback for: ${componentName}`);
    return generateFallbackCode(componentName, []);
  }
  
  // Clean the response and handle both original and uppercase versions
  const original = response.trim();
  const cleaned = original.toUpperCase();
  
  console.log(`🔍 Extracting code from response: "${original.substring(0, 100)}${original.length > 100 ? '...' : ''}"`);
  
  // Enhanced patterns to match 4-character codes with better validation
  const patterns = [
    // Exact 4-character patterns with word boundaries
    { regex: /\b([A-Z]{4})\b/, description: '4 letters' },
    { regex: /\b([A-Z]{3}[0-9])\b/, description: '3 letters + 1 number' },
    { regex: /\b([A-Z]{2}[0-9]{2})\b/, description: '2 letters + 2 numbers' },
    { regex: /\b([A-Z][0-9]{3})\b/, description: '1 letter + 3 numbers' },
    { regex: /\b([A-Z0-9]{4})\b/, description: 'any 4 alphanumeric' }
  ];
  
  // Try each pattern on cleaned text
  for (const { regex, description } of patterns) {
    const matches = cleaned.match(regex);
    if (matches) {
      const code = matches[1] || matches[0];
      // Enhanced validation - exclude common words and ensure it looks like a code
      const invalidCodes = ['WORD', 'CODE', 'CHAR', 'TEXT', 'NAME', 'THIS', 'THAT', 'WITH', 'FROM', 'WILL', 'HAVE', 'BEEN', 'THEY', 'THEM', 'WHAT', 'WHEN', 'WHERE', 'WHICH', 'WOULD', 'COULD', 'SHOULD'];
      if (!invalidCodes.includes(code) && isValidComponentCode(code, componentName)) {
        console.log(`🎯 Extracted code "${code}" using pattern: ${description}`);
        return code;
      }
    }
  }
  
  // Look for codes in quotes or after specific keywords with enhanced patterns
  const keywordPatterns = [
    { regex: /(?:code|result|answer|output|generate[sd]?)[\s:]*["']?([A-Z0-9]{4})["']?/i, description: 'after keywords' },
    { regex: /^([A-Z0-9]{4})$/m, description: 'standalone on line' },
    { regex: /->[\s]*([A-Z0-9]{4})/, description: 'after arrow' },
    { regex: /is[\s]+([A-Z0-9]{4})/i, description: 'after "is"' },
    { regex: /:[\s]*([A-Z0-9]{4})/, description: 'after colon' },
    { regex: /"([A-Z0-9]{4})"/, description: 'in quotes' },
    { regex: /\b([A-Z0-9]{4})\b(?=\s*$)/m, description: 'end of line' }
  ];
  
  for (const { regex, description } of keywordPatterns) {
    const match = cleaned.match(regex);
    if (match && match[1]) {
      const code = match[1];
      if (isValidComponentCode(code, componentName)) {
        console.log(`🎯 Extracted code "${code}" using keyword pattern: ${description}`);
        return code;
      }
    }
  }
  
  // Try to find any 4-character sequence that looks like a component code
  const allFourCharMatches = cleaned.match(/[A-Z0-9]{4}/g);
  if (allFourCharMatches) {
    for (const code of allFourCharMatches) {
      if (isValidComponentCode(code, componentName)) {
        console.log(`🎯 Extracted code "${code}" from all matches`);
        return code;
      }
    }
  }
  
  // Special handling for reasoning text - look for component-related codes
  if (original.toLowerCase().includes('generating') || original.toLowerCase().includes('component')) {
    const reasoningMatch = cleaned.match(/(?:COMPONENT|GENERATING|FOR)[\s\S]*?([A-Z0-9]{4})/i);
    if (reasoningMatch && reasoningMatch[1] && isValidComponentCode(reasoningMatch[1], componentName)) {
      console.log(`🎯 Extracted code "${reasoningMatch[1]}" from reasoning context`);
      return reasoningMatch[1];
    }
  }
  
  // Fallback to generating from component name
  console.log(`🔄 No valid code found in response, using fallback for: ${componentName}`);
  console.log(`📝 Response was: "${original}"`);
  return generateFallbackCode(componentName, []);
};

// Validate if a code looks reasonable for a component
const isValidComponentCode = (code: string, componentName: string): boolean => {
  // Must be exactly 4 characters
  if (code.length !== 4) return false;
  
  // Should contain at least one letter
  if (!/[A-Z]/.test(code)) return false;
  
  // Avoid codes that are just numbers or obviously invalid
  if (/^[0-9]{4}$/.test(code)) return false;
  
  // Check if it has some relation to the component name (first letters match)
  const componentUpper = componentName.toUpperCase().replace(/[^A-Z]/g, '');
  if (componentUpper.length >= 2) {
    const firstTwoFromComponent = componentUpper.substring(0, 2);
    const firstTwoFromCode = code.substring(0, 2);
    // If they share at least one character in first two positions, it's probably valid
    if (firstTwoFromComponent[0] === firstTwoFromCode[0] || 
        firstTwoFromComponent[1] === firstTwoFromCode[1] ||
        firstTwoFromComponent.includes(firstTwoFromCode[0])) {
      return true;
    }
  }
  
  // If no relation found, still accept if it looks like a reasonable code
  // (mix of letters and numbers, not all same character, etc.)
  const uniqueChars = new Set(code.split(''));
  return uniqueChars.size >= 2; // At least 2 different characters
};

// Enhanced fallback code generation algorithm
const generateFallbackCode = (componentName: string, existingCodes: string[]): string => {
  const name = componentName.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  // For 3-character names, add 0
  if (name.length === 3) {
    const code = name + '0';
    return existingCodes.includes(code) ? generateVariation(code, existingCodes) : code;
  }
  
  // Extract meaningful characters with improved logic
  let code = '';
  const words = componentName.split(/[\s\-()]/);
  
  if (words.length === 1) {
    // Single word - take first 4 characters or abbreviate intelligently
    if (name.length >= 4) {
      // Remove vowels if needed to get 4 chars
      const consonants = name.replace(/[AEIOU]/g, '');
      code = consonants.length >= 4 ? consonants.substring(0, 4) : name.substring(0, 4);
    } else {
      code = name.padEnd(4, '0');
    }
  } else {
    // Multiple words - take first letters, prioritizing longer words
    const sortedWords = words
      .filter(word => word.length > 0)
      .sort((a, b) => b.length - a.length); // Sort by length descending
    
    for (const word of sortedWords) {
      if (code.length < 4) {
        code += word[0].toUpperCase();
      }
    }
    
    // If still not 4 chars, add more letters from longest words
    if (code.length < 4) {
      for (const word of sortedWords) {
        for (let i = 1; i < word.length && code.length < 4; i++) {
          const char = word[i].toUpperCase();
          if (/[A-Z]/.test(char)) {
            code += char;
          }
        }
      }
    }
    
    code = code.substring(0, 4).padEnd(4, '0');
  }
  
  // Ensure uniqueness
  return existingCodes.includes(code) ? generateVariation(code, existingCodes) : code;
};

// Generate code variation when duplicate exists
const generateVariation = (baseCode: string, existingCodes: string[]): string => {
  for (let i = 1; i <= 9; i++) {
    const variation = baseCode.substring(0, 3) + i;
    if (!existingCodes.includes(variation)) {
      return variation;
    }
  }
  
  // If numbers exhausted, use letters
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i); // A-Z
    const variation = baseCode.substring(0, 2) + letter + baseCode[3];
    if (!existingCodes.includes(variation)) {
      return variation;
    }
  }
  
  return baseCode; // Last resort
};

// Test API connection with enhanced diagnostics
export const testAPIConnection = async (): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  try {
    console.log('🔍 Testing OpenRouter API connection...');
    console.log('🔑 Checking API key availability...');
    
    // First, test if we can make a basic request to check API key validity
    try {
      const testResponse = await blink.data.fetch({
        url: 'https://openrouter.ai/api/v1/models',
        method: 'GET',
        headers: {
          'Authorization': 'Bearer {{OPENROUTER_API_KEY}}',
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'SAP Catalog Profile Generator'
        }
      });
      
      console.log('📡 Models endpoint response:', {
        status: testResponse.status,
        hasData: !!testResponse.body?.data
      });
      
      if (testResponse.status === 401) {
        return {
          success: false,
          message: 'API key is invalid or expired. Please update your OpenRouter API key in the secrets.',
          details: {
            error: 'Authentication failed',
            troubleshooting: 'Go to https://openrouter.ai/keys to get a new API key, then update it in the app secrets.',
            statusCode: 401
          }
        };
      }
      
      if (testResponse.status !== 200) {
        return {
          success: false,
          message: `OpenRouter API returned status ${testResponse.status}. Please check your API key and try again.`,
          details: {
            statusCode: testResponse.status,
            response: testResponse.body
          }
        };
      }
      
      console.log('✅ API key validation successful');
    } catch (keyError) {
      console.error('❌ API key validation failed:', keyError);
      return {
        success: false,
        message: 'Failed to validate API key. Please check that OPENROUTER_API_KEY is properly set in secrets.',
        details: {
          error: keyError instanceof Error ? keyError.message : keyError,
          troubleshooting: 'Make sure the OPENROUTER_API_KEY secret is set and starts with "sk-or-v1-"'
        }
      };
    }
    
    // Test with the most reliable free model first (matching AI_MODELS order)
    const testModels = AI_MODELS.map(model => model.id);
    
    let lastError: Error | null = null;
    
    for (const model of AI_MODELS) {
      // Skip rate-limited models during testing
      if (!canUseModel(model.id, model.rateLimitPerMin)) {
        const waitTime = getWaitTimeForModel(model.id);
        console.log(`⏭️ Skipping ${model.name} - rate limited (${Math.round(waitTime/1000)}s remaining)`);
        continue;
      }
      
      try {
        console.log(`🧪 Testing model: ${model.name}`);
        const testResult = await callAIModelWithRetry(
          model.id, 
          'Generate a 4-character code for "Motor". Return only the code, nothing else.', 
          'Motor',
          model.rateLimitPerMin,
          2 // Fewer retries for testing
        );
        
        if (testResult && testResult.trim().length > 0) {
          console.log(`✅ API connection successful with model: ${model.name}`);
          return {
            success: true,
            message: `OpenRouter API connection successful using ${model.name}`,
            details: { 
              model: model.id,
              modelName: model.name,
              response: testResult.trim(),
              testedModels: AI_MODELS.indexOf(model) + 1
            }
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ Model ${model.name} failed:`, errorMessage);
        
        // If it's a rate limit error, continue to next model
        if (errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
          console.log(`⏱️ Rate limit hit for ${model.name}, trying next model...`);
        } else if (errorMessage.includes('500')) {
          console.log(`🔄 Server error (500) with ${model.name}, trying next model...`);
        }
        
        lastError = error instanceof Error ? error : new Error(String(error));
        continue; // Try next model
      }
    }
    
    // If all models failed
    throw lastError || new Error('All test models failed');
    
  } catch (error) {
    console.error('❌ API connection failed:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Unknown error';
    let troubleshooting = '';
    
    if (error instanceof Error) {
      if (error.message.includes('Authentication failed') || error.message.includes('401')) {
        errorMessage = 'Authentication failed - API key is invalid or expired';
        troubleshooting = 'Please update your OpenRouter API key in the app secrets. Get a new key from https://openrouter.ai/keys';
      } else if (error.message.includes('Access forbidden') || error.message.includes('403')) {
        errorMessage = 'Access forbidden - insufficient permissions';
        troubleshooting = 'Your API key may not have permission to access free models. Check your OpenRouter account limits.';
      } else if (error.message.includes('Rate limit') || error.message.includes('429')) {
        errorMessage = 'Rate limit exceeded';
        troubleshooting = 'You have exceeded the rate limit for free models. Please wait a few minutes and try again.';
      } else if (error.message.includes('server error') || error.message.includes('500')) {
        errorMessage = 'OpenRouter server error';
        troubleshooting = 'This is a temporary server issue. Please try again in a few minutes.';
      } else {
        errorMessage = error.message;
        troubleshooting = 'Check the console for detailed error information.';
      }
    }
    
    return {
      success: false,
      message: `${errorMessage}. ${troubleshooting}`,
      details: {
        error: error instanceof Error ? error.message : error,
        troubleshooting,
        testedModels: AI_MODELS.map(m => m.name)
      }
    };
  }
};

// Test all models and return performance comparison
export const testAllModels = async (
  componentNames: string[]
): Promise<Array<{
  modelName: string;
  averageResponseTime: number;
  successRate: number;
  accuracy: number;
}>> => {
  const results: Array<{
    modelName: string;
    averageResponseTime: number;
    successRate: number;
    accuracy: number;
  }> = [];
  
  for (const model of AI_MODELS) {
    let totalTime = 0;
    let successes = 0;
    let accurateResults = 0;
    
    console.log(`🧪 Testing model: ${model.name}`);
    
    for (const componentName of componentNames.slice(0, 5)) { // Test with fewer components to avoid rate limits
      // Skip if rate limited
      if (!canUseModel(model.id, model.rateLimitPerMin)) {
        console.log(`⏭️ Skipping ${componentName} for ${model.name} - rate limited`);
        continue;
      }
      
      try {
        const startTime = Date.now();
        const result = await callAIModelWithRetry(
          model.id, 
          createCodeGenerationPrompt(componentName, []), 
          componentName,
          model.rateLimitPerMin,
          1 // Single retry for testing
        );
        const responseTime = Date.now() - startTime;
        
        totalTime += responseTime;
        successes++;
        
        // Check accuracy against training data
        const expectedCode = COMPONENT_CODE_TRAINING_DATA.find(
          item => item.componentName === componentName
        )?.objectPartCode;
        
        const generatedCode = extractCodeFromResponse(result, componentName);
        if (expectedCode && generatedCode === expectedCode) {
          accurateResults++;
        }
        
        // Add small delay between requests to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.warn(`Model ${model.name} failed for ${componentName}:`, error);
      }
    }
    
    results.push({
      modelName: model.name,
      averageResponseTime: successes > 0 ? totalTime / successes : 0,
      successRate: successes / Math.min(componentNames.length, 5), // Updated to match the slice(0, 5)
      accuracy: successes > 0 ? accurateResults / successes : 0
    });
  }
  
  return results;
};

// Get current status of all AI models for debugging/monitoring
export const getModelStatus = (): Array<{
  name: string;
  id: string;
  available: boolean;
  requestCount: number;
  maxRequests: number;
  consecutiveFailures: number;
  circuitBreakerActive: boolean;
  waitTimeMs: number;
}> => {
  return AI_MODELS.map(model => {
    const tracker = modelUsageTracker.get(model.id);
    const now = Date.now();
    const safeLimit = Math.max(1, Math.floor(model.rateLimitPerMin * 0.9));
    
    if (!tracker) {
      return {
        name: model.name,
        id: model.id,
        available: true,
        requestCount: 0,
        maxRequests: safeLimit,
        consecutiveFailures: 0,
        circuitBreakerActive: false,
        waitTimeMs: 0
      };
    }
    
    const circuitBreakerActive = tracker.circuitBreakerUntil > now;
    const waitTimeMs = getWaitTimeForModel(model.id);
    const available = canUseModel(model.id, model.rateLimitPerMin);
    
    return {
      name: model.name,
      id: model.id,
      available,
      requestCount: tracker.requestCount,
      maxRequests: safeLimit,
      consecutiveFailures: tracker.consecutiveFailures,
      circuitBreakerActive,
      waitTimeMs
    };
  });
};