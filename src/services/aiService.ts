import { AIProviderConfig, AISettings } from '../types/ai';
import { ArchitectureFact, ArchitectureQuestion, ArchitectureTopology, DomainEntity, FrameworkRecommendation } from '../types/project';
import { 
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

export async function generateEntitiesWithAI(
  projectName: string,
  description: string,
  settings: AISettings
): Promise<{ entities: DomainEntity[]; providerName: string }> {
  const activeConfig = settings.providers[settings.activeProvider];
  const hasKey = activeConfig && (activeConfig.provider === 'ollama' || Boolean(activeConfig.apiKey?.trim()));

  if (!hasKey) {
    throw new Error(`API key is required for ${activeConfig?.name || 'AI'}. Please configure it in AI Settings.`);
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
        providerName: activeConfig.name
      };
    }
  }

  throw new Error(`Could not parse domain entities from ${activeConfig.name} response.`);
}

export async function expandAndPolishDescription(
  projectName: string,
  currentDescription: string,
  settings: AISettings
): Promise<{ text: string; providerName: string }> {
  const activeConfig = settings.providers[settings.activeProvider];
  const hasKey = activeConfig && (activeConfig.provider === 'ollama' || Boolean(activeConfig.apiKey?.trim()));

  const coreInput = cleanRawDescription(currentDescription) || (projectName || '').trim();

  if (coreInput.length < 2) {
    throw new Error('Please enter a project name or brief idea before expanding.');
  }

  if (!hasKey) {
    throw new Error(`API key is required for ${activeConfig?.name || 'AI'}. Please click 'Configure AI Key' to connect.`);
  }

  const prompt = `You are an expert software architect and product designer.
A developer is building a project called "${projectName || 'Unnamed Project'}".
Here is their core product idea:
"""
${coreInput}
"""

Instructions:
- Expand and polish this into a clear, compelling, professional product specification focused specifically on "What It Does & Core Value Proposition".
- Describe the core purpose, key user-facing features, business value, technical capabilities, and primary problem solved by this application.
- Write in clean, highly readable paragraphs and bullet points focused strictly on the core product value proposition and what it does.
- Do NOT create separate sections for "Target Users & Primary Workflows" or "Key Data & Reliability Expectations".
- Do NOT use markdown hash tags (### or ####) or bold asterisks (** or ****).
- Return ONLY the clean, polished product description text without preamble, introductions, or code blocks.`;

  const rawText = await callAIModel(activeConfig, prompt, { temperature: 0.3, maxTokens: 1200 });

  if (rawText && rawText.trim().length > 15) {
    const formatted = formatSpecificationTemplate(rawText);
    return {
      text: formatted,
      providerName: activeConfig.name
    };
  }

  throw new Error(`Received empty or invalid response from ${activeConfig.name}.`);
}

export async function generateArchitectureInterview(
  projectName: string,
  description: string,
  settings: AISettings
): Promise<{ questions: ArchitectureQuestion[]; inferredFacts: ArchitectureFact[]; providerName: string }> {
  const activeConfig = settings.providers[settings.activeProvider];
  const hasKey = activeConfig && (activeConfig.provider === 'ollama' || Boolean(activeConfig.apiKey?.trim()));

  if (!hasKey) {
    throw new Error(`API key is required for ${activeConfig?.name || 'AI'} to generate a tailored architecture interview.`);
  }

  const prompt = `You are a principal software architect interviewing a product builder before implementation.
Project name: "${projectName || 'Unnamed project'}"
Project description:
"""
${description.trim()}
"""

First extract concrete architectural decisions that are already explicit in the description. Then create a thorough, start-to-finish system-design interview for every important decision that is still missing or ambiguous. The result must be detailed enough to guide an AI coding agent through implementation, release, and operation—not merely select a frontend and backend framework.

Requirements:
- Cover the full lifecycle in a logical order: product scope and users; target platforms and experience; identity and permissions; frontend technology; system shape and service boundaries; backend technology; API shape; database and data ownership; realtime/offline behavior; third-party integrations; security and privacy; compliance; expected scale and performance; resilience, backups, and disaster recovery; hosting and deployment; environments and CI/CD; testing strategy; observability and alerts; operational ownership; and cost constraints.
- Put only genuinely explicit, decision-ready choices from the description into "inferredFacts". A named technology, platform, standard, provider, or unambiguous requirement can be a fact.
- Generic aspirations such as "user-friendly interface", "robust backend", "secure", "scalable", "fast", "uses APIs", or "reliable performance" are NOT decisions and must never be inferred as answers. Ask a concrete question that turns each relevant aspiration into an actionable constraint.
- Do not repeat the exact decision represented by an inferred fact. You may still ask a different question in the same broad area when it resolves another material decision; for example, knowing Stripe is required does not answer which email, push-notification, or analytics integrations are needed.
- Example: if the description says "mobile app", record platform = "iOS and Android mobile application" and do not ask where it should run.
- Example: if it names React Native, record both the relevant UI/frontend facts and do not ask the user to choose those again.
- Do not infer a hard decision from weak clues. When a choice is genuinely ambiguous, ask a clarifying question.
- Return 16 to 22 focused questions in a logical order. Use fewer only when the description explicitly resolves several decisions; even then, return at least 10 unanswered questions.
- Use these exact category values where appropriate: product, users, platform, approach, ui, access, frontend, topology, backend, api, data, realtime, integrations, security, compliance, scale, reliability, deployment, delivery, testing, observability, operations, budget.
- Tailor every question and option to this particular product. Reference known features and risks such as payments, sensitive data, notifications, collaboration, media, AI workloads, or offline use when present.
- Ask one decision per question. Do not combine database, hosting, security, and deployment into one answer.
- Questions must yield actionable decisions: specific scope boundaries, access models, consistency needs, recovery objectives, deployment environments, release controls, quality gates, monitoring, and ownership.
- Ask about outcomes and tradeoffs, not implementation jargon. For example, ask who needs to connect to the product instead of asking REST versus GraphQL; ask how much data loss is acceptable instead of asking for RPO.
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
      "id": "deployment_hosting",
      "category": "deployment",
      "question": "How much hosting infrastructure does your team want to manage?",
      "context": "Blueprint will translate this into a hosting setup that balances maintenance, control, and cost.",
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
    throw new Error(`${activeConfig.name} connected successfully, but returned an unexpected interview format. Please try generating the questions again.`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error(`${activeConfig.name} connected successfully, but its interview response was incomplete. Please try again.`);
  }
  if (!parsed || !Array.isArray(parsed.questions)) {
    throw new Error(`${activeConfig.name} connected successfully, but returned an invalid architecture interview. Please try again.`);
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
  // These categories represent one primary choice. Other areas can contain
  // several independent decisions (for example multiple integrations), so an
  // existing fact should inform rather than suppress the entire topic.
  const singleDecisionCategories = new Set<ArchitectureQuestion['category']>([
    'platform', 'approach', 'ui', 'frontend', 'topology', 'backend', 'api', 'data', 'access', 'deployment',
  ]);
  const knownCategories = new Set(
    inferredFacts
      .filter(fact => singleDecisionCategories.has(fact.category))
      .map(fact => fact.category),
  );

  let questions: ArchitectureQuestion[] = parsed.questions.slice(0, 20).map((item: any, questionIndex: number) => {
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
  }).filter((question: ArchitectureQuestion) =>
    question.question &&
    question.options.length >= 2 &&
    !knownCategories.has(question.category)
  );

  // Models sometimes fall back to architecture jargon even when instructed
  // otherwise. Replace implementation-choice questions with outcome questions,
  // then fill any lifecycle areas the model skipped.
  const guardedCategories = new Set<ArchitectureQuestion['category']>([
    'product', 'ui', 'frontend', 'topology', 'backend', 'api', 'data', 'realtime', 'integrations', 'security', 'compliance',
    'deployment', 'delivery', 'observability', 'budget',
  ]);
  questions = questions.map(question =>
    guardedCategories.has(question.category)
      ? buildOutcomeQuestion(question.category, description) || question
      : question
  );

  const requiredOrder: ArchitectureQuestion['category'][] = [
    'product', 'users', 'platform', 'ui', 'access', 'frontend', 'topology', 'backend', 'api', 'data', 'realtime',
    'integrations', 'security', 'compliance', 'scale', 'reliability', 'deployment', 'delivery', 'testing',
    'observability', 'operations', 'budget',
  ];
  const byCategory = new Map<ArchitectureQuestion['category'], ArchitectureQuestion>();
  questions.forEach(question => {
    if (!byCategory.has(question.category)) byCategory.set(question.category, question);
  });
  requiredOrder.forEach(category => {
    if (knownCategories.has(category) || byCategory.has(category)) return;
    const fallback = buildOutcomeQuestion(category, description);
    if (fallback) byCategory.set(category, fallback);
  });
  questions = requiredOrder
    .filter(category => !knownCategories.has(category))
    .map(category => byCategory.get(category))
    .filter(Boolean) as ArchitectureQuestion[];

  if (questions.length < 10) {
    throw new Error(`${activeConfig.name} returned too few usable blueprint questions. Please generate the interview again.`);
  }

  return { questions, inferredFacts, providerName: activeConfig.name };
}

function isConcreteArchitectureFact(value: string, evidence?: string): boolean {
  const candidate = `${value} ${evidence || ''}`.toLowerCase();
  const vagueOnly = /\b(user[- ]friendly|intuitive(?: layout| interface)?|robust backend|robust system|fast and reliable|reliable performance|high performance|scalable architecture|secure transactions?|modern interface|uses? apis?|apis? for)\b/;
  return !vagueOnly.test(candidate);
}

function buildOutcomeQuestion(
  category: ArchitectureQuestion['category'],
  description: string,
): ArchitectureQuestion | null {
  const mobile = /\b(mobile|ios|android|phone|tablet)\b/i.test(description);
  const commerce = /\b(store|commerce|checkout|payment|order|inventory|product)\b/i.test(description);
  const option = (id: string, label: string, detail: string, recommended = false) => ({ id, label, description: detail, recommended });
  const question = (
    prompt: string,
    context: string,
    options: ReturnType<typeof option>[],
  ): ArchitectureQuestion => ({
    id: `guided_${category}`,
    category,
    question: prompt,
    context,
    allowCustom: true,
    options,
  });

  switch (category) {
    case 'product':
      return question('What should the first release optimize for?', 'Choose the launch ambition; features can expand after the first complete release.', [
        option('focused', 'A focused first release', 'Ship the smallest complete customer journey and learn quickly.', true),
        option('market_ready', 'A polished public launch', 'Include onboarding, support, analytics, and operational tools.'),
        option('enterprise', 'An enterprise-ready launch', 'Include advanced controls, audit history, and administration from day one.'),
      ]);
    case 'users':
      return question('Who needs their own workspace or controls?', 'This defines roles, permissions, and administrative experiences.', [
        option('users_admins', commerce ? 'Customers and store administrators' : 'Users and administrators', 'Separate the main experience from protected management controls.', true),
        option('one_role', 'One type of user', 'Keep access and navigation simple for the first release.'),
        option('teams', 'Organizations and teams', 'Support owners, managers, and collaborators with different access.'),
      ]);
    case 'platform':
      return question('Where should people use the product?', 'Choose every experience that must be supported at launch.', [
        option('web', 'In a web browser', 'Works through a link without installing an app.', !mobile),
        option('mobile', 'On iPhone and Android', 'A touch-first app delivered through app stores.', mobile),
        option('web_mobile', 'On web and mobile', 'Support both browser and phone experiences.'),
        option('desktop', 'As a desktop app', 'Install it on macOS, Windows, or Linux.'),
      ]);
    case 'ui':
      return question('How should the product feel to people using it?', 'Blueprint will translate the desired experience into interface technology.', [
        option('familiar', 'Familiar, clean, and accessible', 'Use established patterns that are easy to learn.', !mobile),
        option('device_native', 'Natural on each device', 'Follow the behavior people expect on iPhone and Android.', mobile),
        option('consistent', 'Consistent everywhere', 'Keep the experience closely matched across platforms.'),
        option('branded', 'Highly distinctive and branded', 'Prioritize a unique visual identity.'),
      ]);
    case 'access':
      return question('How should people sign in and place an order?', 'This affects checkout friction, account recovery, and protected actions.', [
        option('guest_account', commerce ? 'Guest checkout plus optional accounts' : 'Easy sign-in plus optional guest access', 'Reduce friction while preserving saved history.', true),
        option('account_required', 'Require an account', 'Make every activity traceable to a signed-in user.'),
        option('company_login', 'Use company-managed sign-in', 'Let workplace customers control access.'),
        option('decide', 'Let Blueprint decide', 'Choose the safest low-friction approach from the workflows.'),
      ]);
    case 'frontend':
      return question(mobile ? 'How should iPhone and Android development be balanced?' : 'How should the product screens be built?', 'Choose the team and experience tradeoff, not a framework name.', [
        option('shared', mobile ? 'Share most work across both phones' : 'Use one modern web application', 'Move faster with one main interface codebase.', true),
        option('separate', mobile ? 'Build separately for each phone platform' : 'Use separate experiences where needed', 'Accept more work for deeper platform-specific control.'),
        option('hybrid', 'Share the core and customize key screens', 'Balance development speed with platform-specific polish.'),
        option('decide', 'Let Blueprint decide', 'Select the screen technology from all interview answers.'),
      ]);
    case 'topology':
      return question('How independently should different parts of the product change and operate?', 'Blueprint will translate this into one well-organized application, independent services, managed functions, or a mixed design.', [
        option('one_team', 'Keep it simple for one product team', 'Release one application with clear internal modules. This is usually the safest starting point.', true),
        option('independent_areas', 'Let separate product areas evolve independently', 'Allow different teams to release and scale areas without coordinating every change.'),
        option('uneven_bursts', 'Minimize operations and handle uneven demand', 'Use managed functions that run independently when work arrives.'),
        option('background_work', 'Prioritize resilient background workflows', 'Let longer-running work continue through events without making users wait.'),
        option('mixed', 'Keep a simple core and isolate critical parts', 'Use one main system with only selected high-risk or high-scale capabilities separated.'),
      ]);
    case 'backend':
      return question('How much behind-the-scenes infrastructure should the team manage?', 'This powers business rules, scheduled work, payments, and notifications.', [
        option('managed', 'As little as possible', 'Use managed services and keep maintenance low.', true),
        option('balanced', 'A balanced amount of control', 'Use a conventional application service that remains easy to operate.'),
        option('full_control', 'Full control for unusual needs', 'Accept more complexity for specialized performance or hosting.'),
        option('decide', 'Let Blueprint decide', 'Choose from the workflows, scale, and team capacity.'),
      ]);
    case 'api':
      return question('Who else needs to connect to this product?', 'Blueprint will design the connection method and documentation from this answer.', [
        option('our_apps', 'Only our own app', 'Keep connections private and optimized for first-party screens.', true),
        option('partners', 'A few trusted partners', 'Provide stable access for selected outside systems.'),
        option('public', 'Outside developers', 'Provide public, versioned access with keys and limits.'),
        option('live_systems', 'Many systems with live updates', 'Support frequent two-way updates and background work.'),
      ]);
    case 'data':
      return question('What kind of information must stay most dependable?', 'Blueprint will choose storage that protects accuracy, search, and reporting.', [
        option('connected_records', commerce ? 'Accounts, products, inventory, orders, and payments' : 'Connected business records', 'Prioritize accuracy when related information changes together.', true),
        option('content', 'Flexible content and documents', 'Prioritize changing content shapes and simple publishing.'),
        option('device_data', 'Information stored on each device', 'Keep the product useful without a connection and synchronize later.'),
        option('decide', 'Let Blueprint decide', 'Choose storage from the product workflows.'),
      ]);
    case 'realtime':
      return question('What should happen when the connection is slow or unavailable?', 'This determines what is cached and whether people can continue working.', [
        option('online', 'Require a connection for changes', 'Keep the system simpler and show clear retry states.', true),
        option('read_offline', 'Allow viewing saved information offline', 'Cache useful content but require a connection for changes.'),
        option('full_offline', 'Allow full use offline', 'Save changes on the device and combine them safely later.'),
      ]);
    case 'integrations':
      return question(commerce ? 'Which outside services must work at launch besides payments?' : 'Which outside services must work at launch?', 'Every connection adds setup, testing, and failure handling.', [
        option('essential', commerce ? 'Order messages and analytics' : 'Only the essentials', 'Cover the main customer journey with few dependencies.', true),
        option('full_suite', commerce ? 'Shipping, tax, inventory, messages, and analytics' : 'A complete launch integration set', 'Connect the wider operating workflow from day one.'),
        option('later', 'Add most integrations later', 'Keep the first release smaller and easier to operate.'),
        option('decide', 'Let Blueprint prioritize them', 'Create an integration plan from the product description.'),
      ]);
    case 'security':
      return question('How sensitive is the information and activity in this product?', 'Blueprint will translate the risk into concrete protection and review steps.', [
        option('standard', 'Normal customer and business information', 'Use strong standard protection for accounts and administrative actions.', !commerce),
        option('payments', 'Payments or other sensitive transactions', 'Add stricter access history, monitoring, and provider boundaries.', commerce),
        option('high_risk', 'Highly sensitive or regulated information', 'Use formal security reviews and stronger isolation.'),
      ]);
    case 'compliance':
      return question('Are there legal or industry rules the first release must follow?', 'Choose the situation; specialists can confirm the exact obligations later.', [
        option('privacy', 'General consumer privacy rules', 'Support consent, data export, deletion, and privacy-safe defaults.', !commerce),
        option('payments', 'Payment-industry rules', 'Keep card data with approved payment providers and document responsibilities.', commerce),
        option('regulated', 'Health, finance, government, or enterprise rules', 'Plan for stronger controls and evidence.'),
        option('unknown', 'Not sure yet', 'Use a strong baseline and flag this for review.'),
      ]);
    case 'scale':
      return question('How many people do you expect to use the product at first?', 'A rough estimate is enough to choose a sensible starting size.', [
        option('small', 'Hundreds to a few thousand', 'Keep early costs low and leave a clear path to grow.', true),
        option('medium', 'Tens of thousands', 'Prepare for steady growth and predictable busy periods.'),
        option('large', 'Hundreds of thousands or more', 'Prepare for many people using it at the same time.'),
      ]);
    case 'reliability':
      return question('How disruptive would an outage or lost update be?', 'This determines backups, recovery speed, and additional cost.', [
        option('standard', 'Inconvenient but manageable', 'Use managed reliability and tested daily backups.', true),
        option('critical', 'Lost sales or important work', 'Use frequent backups, health checks, and faster recovery.'),
        option('essential', 'The product must stay available', 'Use redundancy and strict recovery targets.'),
      ]);
    case 'deployment':
      return question('How much hosting infrastructure does the team want to manage?', 'Blueprint will choose hosting that balances maintenance, control, and cost.', [
        option('minimal', 'As little as possible', 'Use managed hosting and databases so the team can focus on the product.', true),
        option('some_control', 'Some control through a major cloud', 'Accept more setup for wider infrastructure choices.'),
        option('portable', 'Keep it easy to move later', 'Package the system so it can run with different providers.'),
        option('self_hosted', 'Manage our own servers', 'Keep full control and accept the maintenance responsibility.'),
      ]);
    case 'delivery':
      return question('How carefully should updates be checked before users receive them?', 'This determines previews, approvals, automatic checks, and rollback.', [
        option('standard', 'A standard safe release process', 'Check changes automatically, test them before launch, and support rollback.', true),
        option('preview', 'A private preview for every change', 'Let the team review each feature separately.'),
        option('simple', 'Simple releases for a small team', 'Use fewer steps for an early, lower-risk product.'),
        option('formal', 'Formal approval before release', 'Require evidence, named approval, and complete history.'),
      ]);
    case 'testing':
      return question('How much checking should happen before each release?', 'Focus effort on the failures that would hurt users or the business most.', [
        option('balanced', 'Balanced automated testing', 'Test small pieces plus the most important complete user journeys.', true),
        option('journeys', 'Test real user journeys heavily', 'Prioritize checkout, sign-in, and outside-service behavior.'),
        option('strict', 'Very strict automated checks', 'Require broad tests, security scanning, and speed checks.'),
        option('human', 'Core automation plus human review', 'Automate repeatable risks and review the rest manually.'),
      ]);
    case 'observability':
      return question('How should the team learn that something is going wrong?', 'Choose the alerting depth; Blueprint will select the monitoring tools.', [
        option('useful', 'Useful alerts and clear dashboards', 'Track errors, speed, system health, and important business events.', true),
        option('essential', 'Only essential alerts', 'Notify the team when the product is down or a critical journey fails.'),
        option('formal', 'Formal reliability targets', 'Measure agreed availability and speed goals over time.'),
      ]);
    case 'operations':
      return question('Who will look after the product after launch?', 'Team capacity should shape maintenance and automation choices.', [
        option('small_team', 'The product team', 'Favor managed services and simple operating instructions.', true),
        option('dedicated', 'A dedicated operations specialist', 'Support deeper infrastructure control.'),
        option('partner', 'An outside partner', 'Design clear access boundaries, handoffs, and support procedures.'),
        option('unknown', 'Not decided yet', 'Use conservative managed defaults.'),
      ]);
    case 'budget':
      return question('What cost approach should guide the system after launch?', 'This concerns ongoing hosting and service costs, not the development budget.', [
        option('lean', 'Keep early running costs low', 'Prefer usage-based services and grow spending with demand.', true),
        option('balanced', 'Balance cost and reliability', 'Pay for dependable safeguards without enterprise overhead.'),
        option('reliability', 'Prioritize reliability over cost', 'Fund redundancy, faster recovery, and deeper monitoring.'),
        option('fixed', 'Work within a specific monthly limit', 'Enter the amount as a custom answer.'),
      ]);
    default:
      return null;
  }
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
  const mentionsDesktop = /\b(desktop app|desktop application|macos app|windows app|linux app|native desktop)\b/i.test(description);
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
