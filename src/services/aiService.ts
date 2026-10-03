import { AIProviderConfig, AISettings } from '../types/ai';
import { DomainEntity, FrameworkRecommendation } from '../types/project';
import { extractDomainFromObjective } from './domainExtractor';

interface TestResult {
  success: boolean;
  message: string;
}

/**
 * Normalizes provider URLs, formats request bodies, and extracts informative error messages
 */
export async function callAIModel(
  config: AIProviderConfig,
  prompt: string,
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const { provider, apiKey, baseUrl, model } = config;
  const temperature = options.temperature ?? 0.3;
  const maxTokens = options.maxTokens ?? 1500;

  if (provider !== 'ollama' && !apiKey?.trim()) {
    throw new Error(`API key is missing for ${config.name}. Please configure it in AI Settings.`);
  }

  // 1. OpenAI, OpenRouter, Custom OpenAI-Compatible
  if (provider === 'openai' || provider === 'openrouter' || provider === 'custom') {
    let host = (baseUrl || (provider === 'openai' ? 'https://api.openai.com/v1' : 'https://openrouter.ai/api/v1')).trim().replace(/\/+$/, '');
    host = host.replace(/\/chat\/completions\/?$/i, '');
    const url = `${host}/chat/completions`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
        ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://blueprint.studio', 'X-Title': 'Blueprint' } : {})
      },
      body: JSON.stringify({
        model: model || 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens
      })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      const detail = errJson?.error?.message || errJson?.message || (typeof errJson?.error === 'string' ? errJson.error : `HTTP ${res.status}`);
      throw new Error(`${config.name} (${model}): ${detail}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // 2. Anthropic Claude
  if (provider === 'anthropic') {
    const url = 'https://api.anthropic.com/v1/messages';
    const res = await fetch(url, {
      method: 'POST',
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
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      const detail = errJson?.error?.message || errJson?.message || `HTTP ${res.status}`;
      throw new Error(`Anthropic (${model}): ${detail}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text || '';
  }

  // 3. Google Gemini
  if (provider === 'gemini') {
    const cleanModel = (model || 'gemini-1.5-flash').trim().replace(/^models\//i, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey.trim()}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens
        }
      })
    });

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

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'llama3.2',
        prompt,
        stream: false,
        options: { temperature }
      })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      const detail = errJson?.error || errJson?.message || `HTTP ${res.status}. Is the model '${model}' downloaded?`;
      throw new Error(`Ollama (${model}): ${detail}`);
    }

    const data = await res.json();
    return data.response || '';
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

export async function testAIConnection(config: AIProviderConfig): Promise<TestResult> {
  const { provider, apiKey, baseUrl, model } = config;

  if (provider !== 'ollama' && !apiKey?.trim()) {
    return { success: false, message: 'Please enter an API key.' };
  }

  try {
    if (provider === 'ollama') {
      let host = (baseUrl || 'http://localhost:11434').trim().replace(/\/+$/, '');
      host = host.replace(/\/api\/tags\/?$/i, '').replace(/\/api\/?$/i, '');
      const res = await fetch(`${host}/api/tags`);
      if (!res.ok) {
        return { success: false, message: `Ollama server responded with HTTP ${res.status}. Is Ollama running?` };
      }
      return { success: true, message: `Connected to local Ollama server at ${host}!` };
    }

    const reply = await callAIModel(config, 'Say "hello" in one word.', { maxTokens: 5, temperature: 0.1 });
    return { success: true, message: `Connected to ${config.name} (${model}) successfully! (Response: ${reply.trim() || 'OK'})` };
  } catch (error: any) {
    return { success: false, message: error?.message || 'Network error connecting to provider.' };
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

  const trimmedDesc = (currentDescription || '').trim();
  const trimmedName = (projectName || '').trim();

  if (trimmedDesc.length < 10 && trimmedName.length < 4) {
    return {
      text: currentDescription,
      source: 'local',
      error: 'Please provide at least a short phrase or sentence describing what the app does before expanding.'
    };
  }

  if (!hasKey) {
    return {
      text: currentDescription,
      source: 'local',
      error: 'Connect an AI key (OpenAI, Gemini, Claude, Ollama) in settings to expand and polish with AI.'
    };
  }

  const prompt = `You are an expert product architect.
A developer is building a project called "${projectName || 'Unnamed Project'}".
Here is their initial description:
"""
${trimmedDesc || trimmedName}
"""

Instructions:
- Expand and polish this into a clear, structured product specification tailored specifically to their idea.
- Structure your response into 3 concise sections:
  1. What it does & core value proposition
  2. Target users & primary workflows
  3. Key data & reliability expectations
- Base your expansion strictly on the domain and purpose mentioned in their description.
- Return ONLY the polished specification text without preamble, introductions, or quotes.`;

  try {
    const rawText = await callAIModel(activeConfig, prompt, { temperature: 0.4, maxTokens: 1500 });

    if (rawText && rawText.trim().length > 10) {
      return {
        text: rawText.trim(),
        source: 'ai',
        providerName: activeConfig.name
      };
    }

    return {
      text: currentDescription,
      source: 'local',
      error: 'AI returned an empty response. Please try again with a little more detail.'
    };
  } catch (err: any) {
    console.warn('AI polish failed:', err);
    return {
      text: currentDescription,
      source: 'local',
      error: `AI request failed: ${err?.message || 'Check your AI API key/settings.'}`
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

