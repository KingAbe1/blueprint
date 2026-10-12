import { AIProviderConfig, AISettings } from '../types/ai';
import { ArchitectureFact, ArchitectureQuestion, ArchitectureTopology, FrameworkRecommendation } from '../types/project';
import {
  cleanRawDescription,
  formatPolishedProductDescription,
} from './domainExtractor';
import { providerIsConfigured, resolveActiveProvider } from './aiSettingsStorage';


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
  options: { temperature?: number; maxTokens?: number; timeoutMs?: number } = {}
): Promise<string> {
  const { provider, apiKey, baseUrl } = config;
  const model = normalizeModelName(provider, config.model);
  const temperature = options.temperature ?? 0.3;
  const maxTokens = options.maxTokens ?? 1500;
  // Structured architecture responses take longer than short polishing requests.
  // Scale the timeout with the requested output while keeping a sensible ceiling.
  const timeoutMs = options.timeoutMs ?? Math.min(90000, Math.max(30000, 15000 + (maxTokens * 18)));

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
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const isReasoningModel = /^(o1|o3|o4|gpt-5|gpt-6)/i.test(model || '');
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
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
      throw new Error(`Request to ${config.name} (${model}) timed out after ${Math.round(timeoutMs / 1000)}s. The provider connected, but did not finish the response in time.`);
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

export async function expandAndPolishDescription(
  projectName: string,
  currentDescription: string,
  settings: AISettings
): Promise<{ text: string; providerName: string }> {
  const providerId = resolveActiveProvider(settings);
  const activeConfig = settings.providers[providerId];
  const hasKey = activeConfig && providerIsConfigured(activeConfig);

  const draft = currentDescription.trim();
  const coreInput = cleanRawDescription(draft) || (projectName || '').trim();

  if (coreInput.length < 2) {
    throw new Error('Please enter a project name or brief idea before expanding.');
  }

  if (!hasKey) {
    throw new Error(`API key is required for ${activeConfig?.name || 'AI'}. Please click 'Configure AI Key' to connect.`);
  }

  const wordCount = draft.split(/\s+/).filter(Boolean).length;
  const draftBulletCount = (draft.match(/^[ \t]*[•\-*–—]\s+/gm) || []).length;
  const mode: 'expand' | 'polish' | 'tighten' =
    wordCount < 18 ? 'expand' : wordCount > 140 ? 'tighten' : 'polish';

  const modeInstruction =
    mode === 'expand'
      ? 'The input is short. Add reasonable detail, but do not invent features that are not implied.'
      : mode === 'tighten'
        ? 'The input is long. Clarify and deduplicate wording only—keep every distinct feature, role, and constraint from the draft; do not drop bullets to save space.'
        : 'Keep roughly the same length. Improve clarity, specificity, and flow without removing content the draft already states.';

  const preserveBulletsNote =
    draftBulletCount > 0
      ? `\nThe draft already lists ${draftBulletCount} bullet item(s). Under "What it does (first release)", include at least ${draftBulletCount} bullets—one per distinct capability from the draft (merge duplicates, but do not omit any capability the draft mentions).\n`
      : '';

  const prompt = `You are a senior product writer helping a developer describe software before architecture planning.
Project name: "${projectName || 'Unnamed project'}"

Draft idea:
"""
${draft || coreInput}
"""

${modeInstruction}
${preserveBulletsNote}

Write a product brief in plain text using EXACTLY this structure (keep labels as written, no markdown # headers, no **bold**, no code fences):

Summary
[2–3 sentences: problem, who it helps, what the product does at a high level. Mention "${projectName}" naturally once if it fits.]

Who it's for
• [primary user or role]
• [secondary user or role, if any]

What it does (first release)
• [one bullet per capability—include every feature the draft mentions, including newly added lines]
• [each bullet is one clear outcome, not technical jargon]

Out of scope (for now)
• [one or two things explicitly deferred, or "Not specified" if nothing obvious]

Rules:
- Cumulative merge: the draft is the source of truth. Never remove a feature, user role, or constraint that appears in the draft unless the draft explicitly deletes it. New sentences in the draft must appear in the output (usually as new or updated bullets).
- Write like internal product notes, not marketing copy or a pitch deck.
- Keep every specific number, domain term, and constraint from the draft (e.g. fleet size, vehicle types, regions).
- Summary: max 2 sentences, max 55 words. Say what the product is and who uses it—no filler.
- Never use these phrases (or close variants): "addresses the challenges", "enhance efficiency", "cut costs", "improve service delivery", "real-time insights", "organizations managing", "comprehensive solution", "streamline operations".
- Bullets: start with a verb; max 12 words each; describe what a user can do or see, not abstract benefits.
- Plain language; no architecture acronyms or stack unless the draft names them.
- Do not add login, payments, admin dashboards, or analytics unless the draft implies them.
- Out of scope: only defer things that would be tempting given the draft—not generic "integrations" unless relevant.
- No preamble ("Here is…"). Output only the brief.

Example of a bad Summary (do not write like this):
"The Fleet Management System addresses the challenges of overseeing a large fleet... enhance efficiency, cut costs..."

Example of a good Summary:
"Fleet managers need one place to see vehicle location, maintenance due dates, and fuel spend across 500+ vehicles. This product is that operations hub—built for dispatch and maintenance teams, not executives reading slide decks."`;

  const rawText = await callAIModel(activeConfig, prompt, { temperature: 0.25, maxTokens: 900 });

  if (rawText && rawText.trim().length > 15) {
    const formatted = formatPolishedProductDescription(rawText);
    if (formatted.length < 20) {
      throw new Error(`Received empty or invalid response from ${activeConfig.name}.`);
    }
    return {
      text: formatted,
      providerName: activeConfig.name,
    };
  }

  throw new Error(`Received empty or invalid response from ${activeConfig.name}.`);
}

export async function generateArchitectureInterview(
  projectName: string,
  description: string,
  settings: AISettings
): Promise<{ questions: ArchitectureQuestion[]; inferredFacts: ArchitectureFact[]; providerName: string }> {
  const providerId = resolveActiveProvider(settings);
  const activeConfig = settings.providers[providerId];
  const hasKey = activeConfig && providerIsConfigured(activeConfig);

  if (!hasKey) {
    throw new Error(`API key is required for ${activeConfig?.name || 'AI'} to generate build questions.`);
  }

  const prompt = `You are a principal software architect interviewing a product builder before implementation.
Project name: "${projectName || 'Unnamed project'}"
Project description:
"""
${description.trim()}
"""

First extract concrete architectural decisions that are already explicit in the description. Then create an interview containing ONLY the decisions that still matter for this specific project—nothing else.

Requirements:
- Fully dynamic scope: do NOT walk a fixed checklist. Choose 6–18 questions based on what this product actually needs. A small internal tool may need ~6; a regulated multi-tenant product may need ~18.
- Order questions the way a builder should answer them for this product (scope and users before hosting, etc.).
- Skip entire topics that do not apply (no payment-compliance questions without payments; no app-store questions for a CLI-only tool).
- Put only genuinely explicit, decision-ready choices from the description into "inferredFacts". A named technology, platform, standard, provider, or unambiguous requirement can be a fact.
- Generic aspirations such as "user-friendly interface", "robust backend", "secure", "scalable", "fast", "uses APIs", or "reliable performance" are NOT decisions and must never be inferred as answers.
- Do not ask anything already fully settled by an inferredFact. You may ask a different question in the same broad area when it resolves another material decision.
- Example: if the description says "mobile app", record platform and do not ask where it should run.
- Example: if it names React Native, record frontend facts and do not ask the user to choose those again.
- Do not infer a hard decision from weak clues. When a choice is genuinely ambiguous, ask a clarifying question.
- Each question must have a unique "id" (snake_case, descriptive, e.g. "fleet_map_freshness").
- "category" is a UI grouping tag only—pick the closest: product, users, platform, approach, ui, access, frontend, topology, backend, api, data, realtime, integrations, security, compliance, scale, reliability, deployment, delivery, testing, observability, operations, budget. Multiple questions may share a category.
- Tailoring is mandatory: every question and option must reference this project (roles, features, data, workflows from the description)—never generic checklist wording.
- Ask one decision per question. Questions must yield actionable constraints for an AI coding agent (scope, access, data accuracy, integrations, recovery, release process, monitoring, ownership, cost).
- Ask about outcomes and tradeoffs, not implementation jargon (no "REST vs GraphQL"; no database or framework names unless the description named them).
- Assume the user may be a non-technical "vibe coder". Use everyday language, short sentences, and concrete examples. Never use an acronym such as SSO, API, CI/CD, RTO, RPO, SLO, PCI, or SOC 2 without immediately explaining it in plain language.
- When a technical choice does not require user knowledge, make "Let Blueprint decide" the recommended option and derive the technology later from the user's outcome-based answers.
- Each question must have 3 to 5 concise answer options.
- Include a short description for every option explaining its practical tradeoff.
- Mark exactly one option per question as recommended when there is a clear default.
- Always include an AI-decides or no-preference option when a technical choice may be unfamiliar.
- Keep every question answerable by a product builder with no software architecture background.

Respond ONLY with a valid JSON object in this shape:
{
  "inferredFacts": [
    {
      "category": "platform",
      "value": "iOS and Android mobile application",
      "evidence": "The description explicitly calls this a mobile app."
    }
  ],
  "questions": [
    {
      "id": "fleet_map_freshness",
      "category": "realtime",
      "question": "How fresh should vehicle locations be for dispatchers on the live map?",
      "context": "Fresher GPS updates cost more to ingest and store for a large fleet.",
      "allowCustom": true,
      "options": [
        {
          "id": "managed_cloud",
          "label": "As little as possible",
          "description": "Use managed services so the team can focus on the product.",
          "recommended": true
        }
      ]
    }
  ]
}`;

  const rawText = await callAIModel(activeConfig, prompt, {
    temperature: 0.25,
    maxTokens: 6500,
    timeoutMs: 90000,
  });
  const cleanedResponse = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error(`${activeConfig.name} connected successfully, but returned an unexpected question format. Please try again.`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error(`${activeConfig.name} connected successfully, but its response was incomplete. Please try again.`);
  }
  if (!parsed || !Array.isArray(parsed.questions)) {
    throw new Error(`${activeConfig.name} connected successfully, but returned invalid build questions. Please try again.`);
  }

  const validCategories = new Set([
    'product', 'users', 'platform', 'approach', 'ui', 'access', 'frontend', 'topology', 'backend', 'api', 'data',
    'realtime', 'integrations', 'security', 'compliance', 'scale', 'reliability', 'deployment', 'delivery',
    'testing', 'observability', 'operations', 'budget',
  ]);
  const detectedFacts = inferArchitectureFactsFromDescription(description);
  const aiFacts: ArchitectureFact[] = (Array.isArray(parsed.inferredFacts) ? parsed.inferredFacts : [])
    .map((item: any) => {
      const rawCategory = String(item.category || '').toLowerCase();
      const value = String(item.value || '').trim();
      const evidence = item.evidence ? String(item.evidence).trim() : undefined;
      if (!validCategories.has(rawCategory) || !value || !isConcreteArchitectureFact(value, evidence)) return null;
      return {
        category: rawCategory as ArchitectureQuestion['category'],
        value,
        evidence,
        source: 'ai' as const,
      };
    })
    .filter(Boolean) as ArchitectureFact[];

  // Deterministic description matches win over model inference. This makes the
  // no-repeat guarantee reliable even when a model overlooks an explicit phrase.
  const inferredFacts = [...detectedFacts];
  aiFacts.forEach(fact => {
    if (!inferredFacts.some(existing => existing.category === fact.category)) inferredFacts.push(fact);
  });
  const seenQuestionIds = new Set<string>();

  let questions: ArchitectureQuestion[] = parsed.questions.map((item: any, questionIndex: number) => {
    const rawCategory = String(item.category || item.id || 'operations').toLowerCase();
    const category = validCategories.has(rawCategory) ? rawCategory : 'operations';
    const options = Array.isArray(item.options) ? item.options : [];
    const normalizedOptions = options.slice(0, 5).map((option: any, optionIndex: number) => ({
      id: String(option.id || `option_${optionIndex}`).toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
      label: String(option.label || `Option ${optionIndex + 1}`).trim(),
      description: option.description ? String(option.description).trim() : undefined,
      recommended: Boolean(option.recommended),
    }));
    const recommendedIndex = normalizedOptions.findIndex((option: ArchitectureQuestion['options'][number]) => option.recommended);
    const fallbackRecommendedIndex = normalizedOptions.findIndex((option: ArchitectureQuestion['options'][number]) =>
      /let blueprint decide|no preference/i.test(option.label)
    );
    normalizedOptions.forEach((option: ArchitectureQuestion['options'][number], index: number) => {
      option.recommended = index === (recommendedIndex >= 0 ? recommendedIndex : fallbackRecommendedIndex);
    });

    return {
      id: String(item.id || `${category}_${questionIndex}`).toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
      category: category as ArchitectureQuestion['category'],
      question: String(item.question || 'Which approach should Blueprint use?').trim(),
      context: item.context ? String(item.context).trim() : undefined,
      allowCustom: item.allowCustom !== false,
      options: normalizedOptions,
    };
  }).filter((question: ArchitectureQuestion) => {
    if (!question.question || question.options.length < 2) return false;
    if (isImplementationJargonQuestion(question)) return false;
    if (seenQuestionIds.has(question.id)) return false;
    seenQuestionIds.add(question.id);
    return true;
  });

  if (questions.length < 5) {
    throw new Error(`${activeConfig.name} returned too few tailored questions for this project. Please try again.`);
  }

  return { questions, inferredFacts, providerName: activeConfig.name };
}

function isConcreteArchitectureFact(value: string, evidence?: string): boolean {
  const candidate = `${value} ${evidence || ''}`.toLowerCase();
  const vagueOnly = /\b(user[- ]friendly|intuitive(?: layout| interface)?|robust backend|robust system|fast and reliable|reliable performance|high performance|scalable architecture|secure transactions?|modern interface|uses? apis?|apis? for)\b/;
  return !vagueOnly.test(candidate);
}

function questionTextBlob(question: ArchitectureQuestion): string {
  return [
    question.question,
    question.context || '',
    ...question.options.map(option => `${option.label} ${option.description || ''}`),
  ].join(' ').toLowerCase();
}

function isImplementationJargonQuestion(question: ArchitectureQuestion): boolean {
  const blob = questionTextBlob(question);
  return /\b(restful?\s+api|graphql|grpc|postgresql|postgres|mongodb|mysql|redis|kafka|rabbitmq|kubernetes|k8s|docker\s+compose|terraform|lambda|serverless\s+functions?|vercel|next\.?js|nestjs|fastapi|django|react\s+native|flutter|swiftui|microservices?|modular\s+monolith|ci\/cd|oauth|openid|jwt|websocket|websockets|rpo|rto|slo|pci\s+dss|soc\s+2)\b/i.test(blob);
}

export function inferArchitectureFactsFromDescription(description: string): ArchitectureFact[] {
  const text = description.toLowerCase();
  const facts: ArchitectureFact[] = [];
  const addFact = (category: ArchitectureQuestion['category'], value: string, evidence: string) => {
    if (!facts.some(fact => fact.category === category)) {
      facts.push({ category, value, evidence, source: 'description' });
    }
  };

  const mentionsMobile = /\b(mobile app|ios app|android app|iphone app|ipad app|for ios|for android)\b/i.test(description);
  const mentionsDesktop = /\b(desktop app|desktop application|desktop software|macos app|windows app|linux app|native desktop|tauri|electron app)\b/i.test(description);
  const mentionsWeb = /\b(web app|web application|website|browser-based|runs? in (?:the )?browser)\b/i.test(description);
  const mentionsCli = /\b(cli|command[- ]line|terminal tool)\b/i.test(description);

  if (mentionsMobile && mentionsWeb) addFact('platform', 'Web and mobile applications', 'The description explicitly targets both browser and mobile experiences.');
  else if (mentionsMobile) addFact('platform', 'iOS and Android mobile application', 'The description explicitly identifies the product as a mobile app.');
  else if (mentionsDesktop) addFact('platform', 'Desktop application', 'The description explicitly identifies the product as a desktop app.');
  else if (mentionsWeb) addFact('platform', 'Web application', 'The description explicitly identifies a browser or web application.');
  else if (mentionsCli) addFact('platform', 'Command-line application', 'The description explicitly identifies a CLI or terminal tool.');

  if (/\bmodular monolith\b/i.test(description)) {
    addFact('topology', 'Modular monolith', 'The description explicitly requests a modular monolith.');
  } else if (/\bmicroservices?\b/i.test(description)) {
    addFact('topology', 'Independent microservices', 'The description explicitly requests microservices.');
  } else if (/\bevent[- ]driven(?: architecture| system)?\b/i.test(description)) {
    addFact('topology', 'Event-driven system', 'The description explicitly requests an event-driven system.');
  } else if (/\bserverless(?: architecture| functions?)?\b/i.test(description)) {
    addFact('topology', 'Managed serverless functions', 'The description explicitly requests a serverless architecture.');
  } else if (/\bhybrid architecture\b/i.test(description)) {
    addFact('topology', 'Hybrid core and services', 'The description explicitly requests a hybrid architecture.');
  }

  if (/\breact native\b|\bexpo\b/i.test(description)) {
    addFact('ui', 'Cross-platform native interface', 'The description explicitly names React Native or Expo.');
    addFact('frontend', /\bexpo\b/i.test(description) ? 'Expo / React Native' : 'React Native', 'The frontend technology is explicitly named.');
  } else if (/\bswiftui\b|\bswift\b/i.test(description)) {
    addFact('ui', 'Native Apple interface', 'The description explicitly names Swift or SwiftUI.');
    addFact('frontend', 'Swift / SwiftUI', 'The frontend technology is explicitly named.');
  } else if (/\bflutter\b/i.test(description)) {
    addFact('ui', 'Cross-platform native interface', 'The description explicitly names Flutter.');
    addFact('frontend', 'Flutter / Dart', 'The frontend technology is explicitly named.');
  } else if (/\bnext\.?js\b/i.test(description)) {
    addFact('frontend', 'Next.js', 'The frontend framework is explicitly named.');
  } else if (/\bvue\b|\bnuxt\b/i.test(description)) {
    addFact('frontend', /\bnuxt\b/i.test(description) ? 'Nuxt' : 'Vue', 'The frontend framework is explicitly named.');
  }

  if (/\bfastapi\b/i.test(description)) addFact('backend', 'Python / FastAPI', 'The backend framework is explicitly named.');
  else if (/\bdjango\b/i.test(description)) addFact('backend', 'Python / Django', 'The backend framework is explicitly named.');
  else if (/\bnode\.?js\b|\bexpress\b|\bnestjs\b/i.test(description)) addFact('backend', 'TypeScript / Node.js', 'The backend ecosystem is explicitly named.');
  else if (/\bsupabase\b/i.test(description)) addFact('backend', 'Supabase managed backend', 'The managed backend is explicitly named.');

  if (/\bpostgres(?:ql)?\b/i.test(description)) addFact('data', 'PostgreSQL', 'The database is explicitly named.');
  else if (/\bsqlite\b/i.test(description)) addFact('data', 'SQLite', 'The database is explicitly named.');
  else if (/\bmongodb\b/i.test(description)) addFact('data', 'MongoDB', 'The database is explicitly named.');
  else if (/\bfirebase\b/i.test(description)) addFact('data', 'Firebase', 'The data platform is explicitly named.');

  if (!facts.some(fact => fact.category === 'data') && /\boffline[- ]first\b|\bworks? offline\b/i.test(text)) {
    addFact('data', 'Offline-first synchronization', 'Offline operation is an explicit requirement.');
  }

  return facts;
}

export async function analyzeFrameworksWithAI(
  projectName: string,
  description: string,
  settings: AISettings,
  options?: {
    architecturePreference?: string;
    stylingPreference?: string;
    backendPreference?: string;
    targetPlatforms?: string[];
    nfrPreferences?: string[];
    customRequirements?: string;
  }
): Promise<{ recommendations: FrameworkRecommendation[]; providerName: string }> {
  const activeConfig = settings.providers[settings.activeProvider];
  const hasKey = activeConfig && (activeConfig.provider === 'ollama' || Boolean(activeConfig.apiKey?.trim()));

  if (!hasKey) {
    throw new Error(`API key is required for ${activeConfig?.name || 'AI'}. Please click 'Configure AI Key' to connect.`);
  }

  // Construct dynamic architectural constraints based on user criteria without rigid if/else locks
  const dynamicConstraints: string[] = [];

  if (options?.architecturePreference && options.architecturePreference.trim() && options.architecturePreference !== 'auto') {
    dynamicConstraints.push(`- Architecture Topology Preference: ${options.architecturePreference.trim()}`);
  }
  if (options?.targetPlatforms && options.targetPlatforms.length > 0) {
    dynamicConstraints.push(`- Target Deployment Platforms: ${options.targetPlatforms.join(', ')}`);
  }
  if (options?.nfrPreferences && options.nfrPreferences.length > 0) {
    dynamicConstraints.push(`- Critical Non-Functional Invariants & Requirements: ${options.nfrPreferences.join('; ')}`);
  }
  if (options?.stylingPreference && options.stylingPreference.trim() && options.stylingPreference !== 'auto') {
    dynamicConstraints.push(`- UI & Styling Preference: ${options.stylingPreference.trim()}`);
  }
  if (options?.backendPreference && options.backendPreference.trim() && options.backendPreference !== 'auto') {
    dynamicConstraints.push(`- Language / Backend & Database Ecosystem: ${options.backendPreference.trim()}`);
  }
  if (options?.customRequirements && options.customRequirements.trim()) {
    dynamicConstraints.push(`- Custom Architectural Directives: ${options.customRequirements.trim()}`);
  }

  const desktopProduct = /\b(desktop app|desktop application|native desktop|macos app|windows app|linux app|tauri|electron|installed (?:app|application)|local-first app)\b/i.test(description)
    || /\btarget platform\b[\s\S]{0,80}\bdesktop\b/i.test(options?.customRequirements || '');
  if (desktopProduct) {
    dynamicConstraints.push('- Product delivery: Native desktop application (installable on macOS, Windows, and/or Linux)—not a browser-hosted website as the primary product.');
  }

  const constraintSection = dynamicConstraints.length > 0
    ? `User Technical Preferences & Architectural Directives:\n${dynamicConstraints.join('\n')}\n`
    : `User Technical Preferences:\n- Architecture: Analyze the domain requirements to pick the optimal production architecture.\n- Technologies: Select the best-in-class programming languages and ecosystems for this specific domain.\n`;

  const prompt = `You are a Principal Enterprise Software Architect advising on designing a production-grade, scalable software project.
Project Name: "${projectName}"
Project Description:
"""
${description.trim() || projectName}
"""

${constraintSection}
Architectural Guidelines:
- Evaluate the domain, data scale, concurrency, security, and developer ergonomics.
- You are free to recommend ANY modern production-grade programming languages (e.g. TypeScript, Python, Go, Rust, C#/.NET 9, Elixir, Kotlin, Java, Swift, PHP, etc.), frameworks, and database architectures that best serve this specific product.
- Produce exactly ONE final, production-ready architecture that honors the interview decisions. The interview is the selection process; do not present alternatives or reopen choices the user already made.
- Honor the system-shape answer. Default to a modular monolith for one small product team unless the interview explicitly justifies independently deployed services, serverless functions, an event-driven system, or a hybrid.
- A modular monolith must still have clear product-domain modules. Microservices must be justified by independent ownership, release, scaling, or failure-isolation needs—not by the desire to appear scalable.
- Treat "No preference" and "Let Blueprint decide" as permission to make the safest evidence-based choice, not as an architectural constraint.
- For commerce systems with products, inventory, orders, and payments, prefer a transactional relational system of record unless the interview explicitly requires another model. Do not choose a document database merely because realtime updates are needed.
- Never claim that a framework, cloud provider, or database makes the application compliant. Technology can support controls or reduce compliance scope, but compliance still requires correct implementation, policies, evidence, and review.
- When payments use Stripe, Apple Pay, or a similar provider, keep raw card data out of the application and describe this as reducing payment-compliance scope—not guaranteeing compliance.
- Use only real, correctly named products and libraries. Do not invent an ORM, hosting product, or integration that the provider does not offer.
- For a mobile product, deploymentTarget must include app signing/builds and distribution through Apple App Store and Google Play as well as the backend hosting target.
- For a desktop product, category must be "Desktop Software" (or equivalent), architecture must be "Desktop Native" (or hybrid with a local shell), deploymentTarget must describe native installers or app bundles—not Vercel or a public URL as the main way users run the product. Prefer stacks such as Tauri, Electron, or platform-native UI when the brief or interview says desktop.
- Do not recommend "Full-Stack Web" or a hosted SPA as the primary architecture when the user is building desktop software unless they explicitly chose a web client.
- If recommending Supabase, describe its data layer as PostgreSQL with Row Level Security and its normal client/query tooling; never call it "Supabase ORM" or "Supabase Hosting".

For the final architecture, provide one object with:
- id: lowercase slug identifier (e.g. "nextjs-postgres", "react-fastapi", "vue-go-fiber", "tauri-rust", "elixir-phoenix", "expo-supabase", "dotnet-react")
- name: full display title including core languages & frameworks (e.g. "Next.js 15 (TypeScript + React 19)", "React (Vite) + FastAPI (Python 3.12)", "Go (Fiber) + Vue 3 SPA", "Tauri 2.0 (Rust + TypeScript)")
- category: descriptive architectural category (e.g. "Full-Stack Web", "Decoupled SPA + API", "Mobile App", "Desktop Software", "Distributed Microservices")
- architecture: architectural pattern (e.g. "Integrated Full-Stack", "Separate (Frontend + Backend)", "Mobile Native", "Desktop Native", "Event-Driven System")
- frontendStack: exact frontend language, framework & tooling (e.g. "React 19 + TypeScript + Vite", "Next.js 15 App Router", "Flutter (Dart)", "Expo / React Native")
- backendStack: exact backend language, framework & runtime (e.g. "FastAPI (Python 3.12) + asyncpg", "Integrated Server Actions & Route Handlers", "Go (Fiber v3) + pgx", "Node.js (Hono / TypeScript)", "Elixir (Phoenix LiveView)")
- stylingStack: styling system & component kit (e.g. "Tailwind CSS v4 + shadcn/ui", "Vanilla CSS Modules", "Mantine UI", "NativeWind")
- databaseStack: database engine, ORM, and caching (e.g. "PostgreSQL + Prisma ORM + Redis", "PostgreSQL + SQLAlchemy 2.0", "SQLite + Drizzle ORM", "Supabase PostgreSQL")
- deploymentTarget: optimal production deployment target (e.g. "Vercel + Supabase", "Docker + AWS ECS / Fly.io", "Cloudflare Workers / Edge", "Native Installers (macOS / Windows)")
- topology: exactly one of "modular_monolith", "microservices", "serverless", "event_driven", or "hybrid"
- topologyRationale: one plain-language sentence explaining why that system shape fits the interview decisions
- systemModules: an array of 4 to 8 concise product-domain module or service names specific to this project (for example Accounts, Catalog, Orders, Payments, Notifications)
- description: concise 1-2 sentence overview of this system architecture.
- whyReasons: an array of 3 specific, concrete production-grade justifications why this stack excels for the user's described workflows (mention data safety, concurrency, developer velocity, auth, or ecosystem advantages).
- bestFor: short phrase summarizing ideal team / project fit (e.g. "High-velocity SaaS apps with real-time requirements").

Respond ONLY with a valid JSON array containing exactly one object with the exact fields above.
Do NOT include markdown formatting outside the JSON array.`;

  const rawText = await callAIModel(activeConfig, prompt, {
    temperature: 0.2,
    maxTokens: 1800,
    timeoutMs: 60000,
  });

  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const recommendations: FrameworkRecommendation[] = parsed.slice(0, 1).map((item: any, idx: number) =>
        normalizeFrameworkRecommendation(item, idx)
      );

      return {
        recommendations,
        providerName: activeConfig.name
      };
    }
  }

  throw new Error(`Could not parse tech stack recommendations from ${activeConfig.name}.`);
}

function sanitizeArchitectureClaim(claim: string): string {
  if (/\b(ensures?|guarantees?|provides?)\b[^.]{0,120}\b(compliance|compliant)\b/i.test(claim)) {
    return 'Keeps sensitive payment data with the approved payment provider, reducing—but not eliminating—the application’s compliance scope.';
  }
  return claim;
}

function normalizeFrameworkRecommendation(item: any, index: number): FrameworkRecommendation {
  const frontendStack = item.frontendStack ? String(item.frontendStack) : undefined;
  const backendStack = item.backendStack ? String(item.backendStack) : undefined;
  let databaseStack = item.databaseStack ? String(item.databaseStack) : undefined;
  let deploymentTarget = item.deploymentTarget ? String(item.deploymentTarget) : undefined;
  const validTopologies = new Set<ArchitectureTopology>(['modular_monolith', 'microservices', 'serverless', 'event_driven', 'hybrid']);
  const rawTopology = String(item.topology || '').toLowerCase().replace(/[ -]+/g, '_') as ArchitectureTopology;
  const topology = validTopologies.has(rawTopology) ? rawTopology : undefined;

  if (databaseStack && /supabase\s+orm/i.test(databaseStack)) {
    databaseStack = 'Supabase PostgreSQL + Row Level Security';
  }
  if (frontendStack && /\bexpo\b/i.test(frontendStack)) {
    const backendTarget = deploymentTarget?.replace(/supabase hosting/ig, 'Supabase managed backend').trim();
    if (!backendTarget || !/app store|google play/i.test(backendTarget)) {
      deploymentTarget = `Expo EAS Build & Submit + Apple App Store / Google Play${backendTarget ? `; ${backendTarget}` : ''}`;
    }
  }

  return {
    id: String(item.id || `stack_${index}`).toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
    name: String(item.name || 'Framework Stack'),
    category: String(item.category || item.architecture || 'Full-Stack Web'),
    architecture: String(item.architecture || item.category || 'Integrated Full-Stack'),
    frontendStack,
    backendStack,
    stylingStack: item.stylingStack ? String(item.stylingStack) : undefined,
    databaseStack,
    deploymentTarget,
    topology,
    topologyRationale: item.topologyRationale ? String(item.topologyRationale) : undefined,
    systemModules: Array.isArray(item.systemModules)
      ? item.systemModules.map((module: any) => String(module).trim()).filter(Boolean).slice(0, 8)
      : undefined,
    description: String(item.description || ''),
    whyReasons: Array.isArray(item.whyReasons) && item.whyReasons.length > 0
      ? item.whyReasons.map((reason: any) => sanitizeArchitectureClaim(String(reason)))
      : ['Engineered for production scale and developer ergonomics.'],
    bestFor: String(item.bestFor || 'Production software systems'),
    isRecommended: index === 0,
  };
}
