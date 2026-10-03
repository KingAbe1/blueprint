import { AIProviderConfig, AISettings } from '../types/ai';
import { DomainEntity, FrameworkRecommendation } from '../types/project';
import { 
  extractDomainFromObjective, 
  expandDescriptionLocally, 
  cleanRawDescription,
  formatSpecificationTemplate 
} from './domainExtractor';


/**
 * Generic model normalization heuristics.
 * Avoids rigid hardcoding: if a user types numeric shorthand like '4o-mini' or '4o' for OpenAI,
 * we prefix 'gpt-' automatically without enumerating every model release.
 */
export function normalizeModelName(provider: string, rawModel?: string): string {
  const model = (rawModel || '').trim();
  if (!model) return model;

  if (provider === 'openai') {
    if (/^[0-9]/.test(model) && !model.startsWith('gpt-')) {
      return `gpt-${model}`;
    }
  }
  return model;
}

/**
 * Dynamically queries the provider's live models endpoint using user credentials.
 * Works scalably for OpenAI, OpenRouter, Ollama, Gemini, and Custom OpenAI-compatible endpoints.
 */
export async function fetchProviderModels(config: AIProviderConfig): Promise<string[]> {
  const { provider, apiKey, baseUrl } = config;

  if (provider !== 'ollama' && !apiKey?.trim()) {
    throw new Error(`Please enter your ${config.name} API key first.`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    // 1. OpenAI or Custom OpenAI-compatible endpoints (Groq, Together, vLLM, LMStudio, etc.)
    if (provider === 'openai' || provider === 'custom') {
      let host = (baseUrl || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
      host = host.replace(/\/chat\/completions\/?$/i, '').replace(/\/models\/?$/i, '');
      const url = `${host}/models`;

      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`
        }
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || `Failed to fetch models: HTTP ${res.status}`);
      }

      const data = await res.json();
      const list: string[] = (data.data || []).map((m: any) => m.id);

      if (provider === 'openai') {
        // Filter out non-chat / audio / embedding models and sort chat models nicely
        const chatModels = list.filter(id => 
          (id.startsWith('gpt-') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('chatgpt-')) &&
          !id.includes('realtime') && !id.includes('audio') && !id.includes('transcription') && !id.includes('embedding')
        );

        // Sort prioritizing popular everyday models
        chatModels.sort((a, b) => {
          const score = (name: string) => {
            if (name === 'gpt-4o-mini') return 1;
            if (name === 'gpt-4o') return 2;
            if (name.startsWith('o3-mini')) return 3;
            if (name.startsWith('o1-mini')) return 4;
            if (name.startsWith('o1')) return 5;
            if (name.startsWith('gpt-4')) return 6;
            return 20;
          };
          const diff = score(a) - score(b);
          return diff !== 0 ? diff : a.localeCompare(b);
        });

        return chatModels.length > 0 ? chatModels : list;
      }

      return list;
    }

    // 2. OpenRouter (Unified multi-provider catalog)
    if (provider === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`
        }
      });

      if (!res.ok) {
        throw new Error(`OpenRouter returned HTTP ${res.status}`);
      }

      const data = await res.json();
      return (data.data || []).map((m: any) => m.id);
    }

    // 3. Ollama (Local LLM server)
    if (provider === 'ollama') {
      let host = (baseUrl || 'http://localhost:11434').trim().replace(/\/+$/, '');
      host = host.replace(/\/api\/tags\/?$/i, '').replace(/\/api\/?$/i, '');
      const res = await fetch(`${host}/api/tags`, {
        method: 'GET',
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error(`Ollama server returned HTTP ${res.status}. Is Ollama running on ${host}?`);
      }

      const data = await res.json();
      return (data.models || []).map((m: any) => m.name);
    }

    // 4. Google Gemini
    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`;
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || `Google API returned HTTP ${res.status}`);
      }

      const data = await res.json();
      return (data.models || [])
        .map((m: any) => (m.name || '').replace(/^models\//, ''))
        .filter((id: string) => id.includes('gemini') && !id.includes('embedding') && !id.includes('aqa'));
    }

    // 5. Anthropic
    if (provider === 'anthropic') {
      return [
        'claude-3-7-sonnet-20250219',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229'
      ];
    }

    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Normalizes provider URLs, formats request bodies, and extracts informative error messages
 */
export async function callAIModel(
  config: AIProviderConfig,
  prompt: string,
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const { provider, apiKey, baseUrl } = config;
  const model = normalizeModelName(provider, config.model);
  const temperature = options.temperature ?? 0.3;
  const maxTokens = options.maxTokens ?? 1500;

  if (provider !== 'ollama' && !apiKey?.trim()) {
    throw new Error(`API key is missing for ${config.name}. Please configure it in AI Settings.`);
  }

  try {
    // 1. OpenAI, OpenRouter, Custom OpenAI-Compatible
    if (provider === 'openai' || provider === 'openrouter' || provider === 'custom') {
      let host = (baseUrl || (provider === 'openai' ? 'https://api.openai.com/v1' : 'https://openrouter.ai/api/v1')).trim().replace(/\/+$/, '');
      host = host.replace(/\/chat\/completions\/?$/i, '');
      const url = `${host}/chat/completions`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const isReasoningModel = (model || '').startsWith('o1') || (model || '').startsWith('o3');
      const bodyPayload: any = {
        model: model || 'gpt-4o',
        messages: [{ role: 'user', content: prompt }]
      };

      if (isReasoningModel) {
        bodyPayload.max_completion_tokens = maxTokens;
      } else {
        bodyPayload.temperature = temperature;
        bodyPayload.max_tokens = maxTokens;
      }

      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
          ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://blueprint.studio', 'X-Title': 'Blueprint' } : {})
        },
        body: JSON.stringify(bodyPayload)
      }).finally(() => clearTimeout(timeoutId));

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const detail = errJson?.error?.message || errJson?.message || (typeof errJson?.error === 'string' ? errJson.error : `HTTP ${res.status}`);
        throw new Error(`${config.name} (${model}): ${detail}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    }

    // 2. Anthropic Claude (Non-thinking, fast execution)
    if (provider === 'anthropic') {
      let host = (baseUrl || 'https://api.anthropic.com/v1').trim().replace(/\/+$/, '');
      host = host.replace(/\/messages\/?$/i, '');
      const url = `${host}/messages`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: model || 'claude-3-5-sonnet-20241022',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature
        })
      }).finally(() => clearTimeout(timeoutId));

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const detail = errJson?.error?.message || errJson?.message || `HTTP ${res.status}`;
        throw new Error(`Anthropic (${model}): ${detail}`);
      }

      const data = await res.json();
      return data.content?.[0]?.text || '';
    }

    // 3. Google Gemini (Flash, high-speed execution)
    if (provider === 'gemini') {
      const cleanModel = (model || 'gemini-2.0-flash').trim().replace(/^models\//i, '');
      let host = (baseUrl || 'https://generativelanguage.googleapis.com/v1beta').trim().replace(/\/+$/, '');
      host = host.replace(/\/models\/?$/i, '');
      const url = `${host}/models/${cleanModel}:generateContent?key=${apiKey.trim()}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens
          }
        })
      }).finally(() => clearTimeout(timeoutId));

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const detail = errJson?.error?.message || errJson?.message || `HTTP ${res.status}`;
        throw new Error(`Google Gemini (${cleanModel}): ${detail}`);
      }

      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    // 4. Ollama (Local)
    if (provider === 'ollama') {
      let host = (baseUrl || 'http://localhost:11434').trim().replace(/\/+$/, '');
      host = host.replace(/\/api\/generate\/?$/i, '').replace(/\/api\/?$/i, '');
      const url = `${host}/api/generate`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || 'llama3.2',
          prompt,
          stream: false,
          options: { temperature }
        })
      }).finally(() => clearTimeout(timeoutId));

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const detail = errJson?.error || errJson?.message || `HTTP ${res.status}. Is the model '${model}' downloaded?`;
        throw new Error(`Ollama (${model}): ${detail}`);
      }

      const data = await res.json();
      return data.response || '';
    }

    throw new Error(`Unsupported provider: ${provider}`);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Request to ${config.name} (${model}) timed out after 20s. Please check your network or server.`);
    }
    throw err;
  }
}

export interface TestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  modelUsed?: string;
}

export async function testAIConnection(config: AIProviderConfig): Promise<TestResult> {
  const { provider, apiKey, baseUrl } = config;
  const model = normalizeModelName(provider, config.model);

  if (provider !== 'ollama' && !apiKey?.trim()) {
    return { success: false, message: 'Please enter an API key.' };
  }

  const startTime = performance.now();

  try {
    if (provider === 'ollama') {
      let host = (baseUrl || 'http://localhost:11434').trim().replace(/\/+$/, '');
      host = host.replace(/\/api\/tags\/?$/i, '').replace(/\/api\/?$/i, '');
      const res = await fetch(`${host}/api/tags`);
      const latencyMs = Math.round(performance.now() - startTime);
      if (!res.ok) {
        return { 
          success: false, 
          message: `Ollama server responded with HTTP ${res.status}. Is Ollama running?`,
          latencyMs,
          modelUsed: model
        };
      }
      return { 
        success: true, 
        message: `Connected to local Ollama server at ${host}!`,
        latencyMs,
        modelUsed: model
      };
    }

    const reply = await callAIModel(config, 'Say "hello" in one word.', { maxTokens: 5, temperature: 0.1 });
    const latencyMs = Math.round(performance.now() - startTime);
    return { 
      success: true, 
      message: `Verified connection to ${config.name} (${model})`,
      latencyMs,
      modelUsed: model
    };
  } catch (error: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { 
      success: false, 
      message: error?.message || 'Network error connecting to provider.',
      latencyMs,
      modelUsed: model
    };
  }
}

export async function generateEntitiesWithAI(
  projectName: string,
  description: string,
  settings: AISettings
): Promise<{ entities: DomainEntity[]; source: 'ai' | 'local'; providerName?: string }> {
  const activeConfig = settings.providers[settings.activeProvider];
  const hasKey = activeConfig && (activeConfig.provider === 'ollama' || Boolean(activeConfig.apiKey?.trim()));

  if (!hasKey) {
    const localResult = extractDomainFromObjective(projectName, description);
    return { entities: localResult.entities, source: 'local' };
  }

  const prompt = `You are a software architect assisting in designing a project called "${projectName}".
The user describes what they are building as follows:
"""
${description || projectName}
"""

Please identify 3 to 6 essential "Key Items & People" (the core records, items, entities, or user types) needed for this system.
Respond ONLY with a valid JSON array of objects in this exact structure:
[
  {
    "name": "Customer",
    "description": "Stores user profile, email address, and billing information."
  }
]
Do not include any text outside the JSON array.`;

  try {
    const rawText = await callAIModel(activeConfig, prompt, { temperature: 0.2, maxTokens: 1024 });

    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const entities: DomainEntity[] = parsed.map((item: any, idx: number) => ({
          id: 'ent_' + Date.now() + '_' + idx,
          name: String(item.name || 'Item').trim(),
          description: String(item.description || '').trim()
        }));
        return {
          entities,
          source: 'ai',
          providerName: activeConfig.name
        };
      }
    }

    const local = extractDomainFromObjective(projectName, description);
    return { entities: local.entities, source: 'local' };
  } catch (err) {
    console.warn('AI extraction failed, using local domain extractor:', err);
    const local = extractDomainFromObjective(projectName, description);
    return { entities: local.entities, source: 'local' };
  }
}

export async function expandAndPolishDescription(
  projectName: string,
  currentDescription: string,
  settings: AISettings
): Promise<{ text: string; source: 'ai' | 'local'; providerName?: string; error?: string }> {
  const activeConfig = settings.providers[settings.activeProvider];
  const hasKey = activeConfig && (activeConfig.provider === 'ollama' || Boolean(activeConfig.apiKey?.trim()));

  const coreInput = cleanRawDescription(currentDescription) || (projectName || '').trim();

  if (coreInput.length < 2) {
    return {
      text: currentDescription,
      source: 'local',
      error: 'Please enter a project name or brief idea before expanding.'
    };
  }

  // If no AI key configured, use intelligent local expansion instantly
  if (!hasKey) {
    const localText = expandDescriptionLocally(projectName, coreInput);
    return {
      text: localText,
      source: 'local'
    };
  }

  const prompt = `You are an expert software architect.
A developer is building a project called "${projectName || 'Unnamed Project'}".
Here is their core product idea:
"""
${coreInput}
"""

Instructions:
- Expand and polish this into a clear, professional product specification tailored specifically to their idea.
- Structure your response into 3 clean sections without using markdown hash tags (do NOT use ### or ####) and without bold asterisks (do NOT use ** or ****):
1. What It Does & Core Value Proposition:
(Concise 2-3 sentence overview describing core purpose and value)

2. Target Users & Primary Workflows:
• (Workflow step 1)
• (Workflow step 2)
• (Workflow step 3)

3. Key Data & Reliability Expectations:
• (Data rule / constraint 1)
• (Data rule / constraint 2)
• (Data rule / constraint 3)

- Base your expansion strictly on the domain and purpose mentioned above.
- Return ONLY the clean specification text without preamble, introductions, quotes, or markdown code blocks.`;

  try {
    const rawText = await callAIModel(activeConfig, prompt, { temperature: 0.3, maxTokens: 1200 });

    if (rawText && rawText.trim().length > 15) {
      const formatted = formatSpecificationTemplate(rawText);
      return {
        text: formatted,
        source: 'ai',
        providerName: activeConfig.name
      };
    }

    // Fallback to local
    const localText = expandDescriptionLocally(projectName, coreInput);
    return {
      text: localText,
      source: 'local'
    };
  } catch (err: any) {
    console.warn('AI polish failed, using local blueprint fallback:', err);
    const localText = expandDescriptionLocally(projectName, coreInput);
    return {
      text: localText,
      source: 'local',
      error: `AI request failed (${err?.message || 'network error'}). Applied local architectural expansion.`
    };
  }
}

export async function analyzeFrameworksWithAI(
  projectName: string,
  description: string,
  settings: AISettings
): Promise<{ recommendations: FrameworkRecommendation[]; source: 'ai' | 'local'; providerName?: string }> {
  const activeConfig = settings.providers[settings.activeProvider];
  const hasKey = activeConfig && (activeConfig.provider === 'ollama' || Boolean(activeConfig.apiKey?.trim()));

  if (!hasKey) {
    const { recommendFrameworkFromText } = await import('./frameworkRecommender');
    return {
      recommendations: recommendFrameworkFromText(projectName, description),
      source: 'local'
    };
  }

  const prompt = `You are a senior software architect advising on the best tech stack for a new project.
Project Name: "${projectName}"
Project Description:
"""
${description.trim() || projectName}
"""

Please recommend the TOP 2 or 3 ideal frameworks/tech stacks to build this exact project.
For each framework, provide:
- id: lowercase identifier (e.g. "nextjs", "react-vite", "tauri", "fastapi", "expo", "node-hono", "django", "sveltekit")
- name: full display name (e.g. "Next.js 15 (React / TypeScript)", "FastAPI (Python) + PostgreSQL", "Tauri 2.0 (Rust + React)", "Expo (React Native)")
- category: one of ["Full-Stack Web", "Frontend SPA", "Desktop App", "Backend API", "Mobile App"]
- description: a concise 1-sentence description of the stack.
- whyReasons: an array of 3 specific, concrete reasons why this framework specifically excels for the user's described project requirements (e.g. mention specific needs like payments, auth, offline access, websockets, or AI pipelines).
- bestFor: a short phrase describing the ideal use case for this stack.

Respond ONLY with a valid JSON array of objects with the fields above.
Example format:
[
  {
    "id": "nextjs",
    "name": "Next.js 15 (React / TypeScript)",
    "category": "Full-Stack Web",
    "description": "Production full-stack framework with built-in server actions and API routes.",
    "whyReasons": [
      "Built-in server routes handle private API keys and database transactions securely.",
      "Server-side rendering ensures fast page speeds and high search engine discoverability.",
      "Seamless integration with Tailwind CSS and modern authentication providers."
    ],
    "bestFor": "SaaS applications and customer web portals"
  }
]`;

  try {
    const rawText = await callAIModel(activeConfig, prompt, { temperature: 0.2, maxTokens: 1500 });

    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const recommendations = parsed.map((item: any, idx: number) => ({
          id: String(item.id || 'fw_' + idx).toLowerCase(),
          name: String(item.name || 'Framework'),
          category: item.category || 'Full-Stack Web',
          description: String(item.description || ''),
          whyReasons: Array.isArray(item.whyReasons) ? item.whyReasons : ['Optimized for this project architecture.'],
          bestFor: String(item.bestFor || 'Modern applications'),
          isRecommended: idx === 0
        }));

        return {
          recommendations,
          source: 'ai',
          providerName: activeConfig.name
        };
      }
    }

    const { recommendFrameworkFromText } = await import('./frameworkRecommender');
    return {
      recommendations: recommendFrameworkFromText(projectName, description),
      source: 'local'
    };
  } catch (err) {
    console.warn('AI framework recommendation failed, using local recommender:', err);
    const { recommendFrameworkFromText } = await import('./frameworkRecommender');
    return {
      recommendations: recommendFrameworkFromText(projectName, description),
      source: 'local'
    };
  }
}

