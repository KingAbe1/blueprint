import { AIProviderConfig, AISettings } from '../types/ai';
import { DomainEntity } from '../types/project';
import { extractDomainFromObjective } from './domainExtractor';

interface TestResult {
  success: boolean;
  message: string;
}

export async function testAIConnection(config: AIProviderConfig): Promise<TestResult> {
  const { provider, apiKey, baseUrl, model } = config;

  if (provider !== 'ollama' && !apiKey.trim()) {
    return { success: false, message: 'Please enter an API key.' };
  }

  try {
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Say "hello" in one word.' }],
          max_tokens: 5
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { 
          success: false, 
          message: err.error?.message || `OpenAI error (HTTP ${res.status})` 
        };
      }

      return { success: true, message: `Connected to OpenAI (${model}) successfully!` };
    }

    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: model || 'claude-3-5-haiku-20241022',
          messages: [{ role: 'user', content: 'Say "hello" in one word.' }],
          max_tokens: 5
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { 
          success: false, 
          message: err.error?.message || `Anthropic error (HTTP ${res.status})` 
        };
      }

      return { success: true, message: `Connected to Anthropic (${model}) successfully!` };
    }

    if (provider === 'gemini') {
      const geminiModel = model || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey.trim()}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say hello in one word.' }] }]
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { 
          success: false, 
          message: err.error?.message || `Google Gemini error (HTTP ${res.status})` 
        };
      }

      return { success: true, message: `Connected to Google Gemini (${geminiModel}) successfully!` };
    }

    if (provider === 'ollama') {
      const host = (baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
      const res = await fetch(`${host}/api/tags`);
      if (!res.ok) {
        return { success: false, message: `Ollama server responded with HTTP ${res.status}. Is Ollama running?` };
      }
      return { success: true, message: `Connected to local Ollama server at ${host}!` };
    }

    if (provider === 'openrouter' || provider === 'custom') {
      const host = (baseUrl || (provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1')).replace(/\/+$/, '');
      const res = await fetch(`${host}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
          ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://blueprint.studio', 'X-Title': 'Blueprint' } : {})
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Say "hello" in one word.' }],
          max_tokens: 5
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, message: err.error?.message || `API error (HTTP ${res.status})` };
      }

      return { success: true, message: `Connected to ${config.name} (${model}) successfully!` };
    }

    return { success: false, message: 'Unknown provider.' };
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

  // Fallback to local heuristic extractor if no API key is provided
  if (!hasKey) {
    const localResult = extractDomainFromObjective(projectName, description);
    return {
      entities: localResult.entities,
      source: 'local'
    };
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
Do not wrap in markdown quotes if possible, or return markdown json code block.`;

  try {
    let rawText = '';

    if (activeConfig.provider === 'openai' || activeConfig.provider === 'openrouter' || activeConfig.provider === 'custom') {
      const host = (activeConfig.baseUrl || (activeConfig.provider === 'openai' ? 'https://api.openai.com/v1' : 'https://openrouter.ai/api/v1')).replace(/\/+$/, '');
      const res = await fetch(`${host}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeConfig.apiKey.trim()}`,
          ...(activeConfig.provider === 'openrouter' ? { 'HTTP-Referer': 'https://blueprint.studio', 'X-Title': 'Blueprint' } : {})
        },
        body: JSON.stringify({
          model: activeConfig.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      rawText = data.choices?.[0]?.message?.content || '';
    } else if (activeConfig.provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': activeConfig.apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: activeConfig.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1024,
          temperature: 0.2
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      rawText = data.content?.[0]?.text || '';
    } else if (activeConfig.provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeConfig.model}:generateContent?key=${activeConfig.apiKey.trim()}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (activeConfig.provider === 'ollama') {
      const host = (activeConfig.baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
      const res = await fetch(`${host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: activeConfig.model,
          prompt: prompt,
          stream: false
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      rawText = data.response || '';
    }

    // Extract JSON from raw response
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

    // Fallback if parsing fails
    const local = extractDomainFromObjective(projectName, description);
    return { entities: local.entities, source: 'local' };
  } catch (err) {
    console.warn('AI extraction failed, using local domain extractor:', err);
    const local = extractDomainFromObjective(projectName, description);
    return { entities: local.entities, source: 'local' };
  }
}
