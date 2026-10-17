/**
 * Strips previous markdown headers, asterisks, bullet points, and repeated system templates from user descriptions.
 */
export function cleanRawDescription(text: string): string {
  if (!text) return '';
  let cleaned = text;

  cleaned = cleaned.replace(/#{1,6}\s*\d*\.?\s*[^\n]+/gi, ' ');
  cleaned = cleaned.replace(/\b\d+\.\s*(?:What It Does|Target Users|Primary Workflows|Key Data|Reliability Expectations)[^\n:]*:?/gi, ' ');
  cleaned = cleaned.replace(/\*{1,4}/g, ' ');
  cleaned = cleaned.replace(/^[\s*•\-+]+/gm, ' ');
  cleaned = cleaned.replace(/is a dedicated platform designed for/gi, ' ');
  cleaned = cleaned.replace(/is designed to provide a reliable, streamlined solution for/gi, ' ');
  cleaned = cleaned.replace(/The system coordinates core data entities[^\n.]*\./gi, ' ');
  cleaned = cleaned.replace(/What it does & core value proposition/gi, ' ');
  cleaned = cleaned.replace(/Target users & primary workflows/gi, ' ');
  cleaned = cleaned.replace(/Key data & reliability expectations/gi, ' ');

  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes AI-generated product text for display in the spec editor.
 */
export function formatSpecificationTemplate(rawText: string): string {
  if (!rawText || !rawText.trim()) return '';

  let text = rawText.trim();

  text = text.replace(/^```[a-z]*\s*\n?/i, '').replace(/\n?```$/i, '').trim();
  text = text.replace(/\*{2,4}([^*]+)\*{2,4}/g, '$1');
  text = text.replace(/(^|[^\*])\*([^*\n]+)\*([^\*]|$)/g, '$1$2$3');
  text = text.replace(/^#{1,6}\s*(?:1\.?)?\s*(?:What It Does|Overview|Product Overview|Core Value Proposition)[^\n]*/gim, '');
  text = text.replace(/^#{1,6}\s*(?:2\.?)?\s*(?:Target Users|Workflows|Primary Workflows|Key Workflows)[^\n]*/gim, '');
  text = text.replace(/^#{1,6}\s*(?:3\.?)?\s*(?:Key Data|Reliability|Data & Reliability|Rules & Constraints|Reliability Expectations)[^\n]*/gim, '');
  text = text.replace(/^#{1,6}\s*([^\n]+)/gm, '$1');
  text = text.replace(/^[\s]*[-*+]\s+/gm, '• ');
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

const POLISH_PREFACE_PATTERN = /^(?:(?:here(?:'s| is)|below is|certainly|sure)[^\n]*\n+|(?:i(?:'ve| have)) (?:expanded|polished|rewritten)[^\n]*\n+)/i;

const SECTION_LABELS = [
  'Summary',
  'Who it\'s for',
  'What it does (first release)',
  'What it does',
  'Out of scope (for now)',
  'Out of scope',
] as const;

/** Formats AI-polished product copy for the blueprint textarea and downstream interview. */
export function formatPolishedProductDescription(rawText: string): string {
  let text = formatSpecificationTemplate(rawText);
  text = text.replace(POLISH_PREFACE_PATTERN, '').trim();
  text = text.replace(/^["'](.*)["']$/s, '$1').trim();

  for (const label of SECTION_LABELS) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`^${escaped}\\s*:`, 'gim'), `${label}\n`);
    text = text.replace(new RegExp(`^${escaped}[ \\t]+$`, 'gim'), `${label}\n`);
  }

  text = text.split('\n').map(line => line.replace(/[ \t]+$/g, '')).join('\n');
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

export type ProductBriefSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets: string[];
};

const BRIEF_SECTION_HEADERS: Array<{ id: string; title: string; pattern: RegExp; inlinePattern: RegExp }> = [
  {
    id: 'summary',
    title: 'Summary',
    pattern: /^Summary\s*$/i,
    inlinePattern: /^Summary\s*:\s*(.+)$/i,
  },
  {
    id: 'audience',
    title: "Who it's for",
    pattern: /^Who it's for\s*$/i,
    inlinePattern: /^Who it's for\s*:\s*(.+)$/i,
  },
  {
    id: 'capabilities',
    title: 'First release',
    pattern: /^What it does(?:\s*\(first release\))?\s*$/i,
    inlinePattern: /^What it does(?:\s*\(first release\))?\s*:\s*(.+)$/i,
  },
  {
    id: 'out_of_scope',
    title: 'Out of scope',
    pattern: /^Out of scope(?:\s*\(for now\))?\s*$/i,
    inlinePattern: /^Out of scope(?:\s*\(for now\))?\s*:\s*(.+)$/i,
  },
];

/** Parses polished brief text into labeled sections; falls back to one overview block. */
export function parseProductBriefSections(text: string): ProductBriefSection[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const sections: ProductBriefSection[] = [];
  let current: ProductBriefSection | null = null;

  const flush = () => {
    if (current && (current.paragraphs.length > 0 || current.bullets.length > 0)) {
      sections.push(current);
    }
    current = null;
  };

  for (const rawLine of trimmed.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const header = BRIEF_SECTION_HEADERS.find(item => item.pattern.test(line));
    if (header) {
      flush();
      current = { id: header.id, title: header.title, paragraphs: [], bullets: [] };
      continue;
    }

    const inlineHeader = BRIEF_SECTION_HEADERS.map(item => {
      const match = line.match(item.inlinePattern);
      return match ? { item, remainder: match[1].trim() } : null;
    }).find(Boolean);

    if (inlineHeader) {
      flush();
      current = {
        id: inlineHeader.item.id,
        title: inlineHeader.item.title,
        paragraphs: [],
        bullets: [],
      };
      if (inlineHeader.remainder) {
        if (/^[•\-*– - ]\s+/.test(inlineHeader.remainder)) {
          current.bullets.push(inlineHeader.remainder.replace(/^[•\-*– - ]\s*/, '').trim());
        } else {
          current.paragraphs.push(inlineHeader.remainder);
        }
      }
      continue;
    }

    if (!current) {
      current = { id: 'overview', title: 'Overview', paragraphs: [], bullets: [] };
    }

    if (/^[•\-*– - ]\s+/.test(line) || (/^[•\-*– - ]/.test(line) && line.length > 1)) {
      current.bullets.push(line.replace(/^[•\-*– - ]\s*/, '').trim());
    } else {
      current.paragraphs.push(line);
    }
  }

  flush();

  if (sections.length === 0) {
    return [{ id: 'overview', title: 'Overview', paragraphs: [trimmed], bullets: [] }];
  }

  return sections;
}

export const BRIEF_SECTION_SERIALIZE_LABEL: Record<string, string> = {
  summary: 'Summary',
  audience: "Who it's for",
  capabilities: 'What it does (first release)',
  out_of_scope: 'Out of scope (for now)',
};

/** Writes parsed brief sections back to the plain-text format used in spec.description. */
export function serializeProductBriefSections(sections: ProductBriefSection[]): string {
  if (sections.length === 0) return '';

  if (sections.length === 1 && sections[0].id === 'overview') {
    const overview = sections[0];
    const parts = [...overview.paragraphs.map(p => p.trim()).filter(Boolean)];
    overview.bullets.forEach(bullet => {
      const trimmed = bullet.trim();
      if (trimmed) parts.push(`• ${trimmed}`);
    });
    return parts.join('\n').trim();
  }

  return sections
    .map(section => {
      const header = BRIEF_SECTION_SERIALIZE_LABEL[section.id] ?? section.title;
      const lines: string[] = [header];
      section.paragraphs.forEach(paragraph => {
        const trimmed = paragraph.trim();
        if (trimmed) lines.push(trimmed);
      });
      section.bullets.forEach(bullet => {
        const trimmed = bullet.trim();
        if (trimmed) lines.push(`• ${trimmed}`);
      });
      return lines.join('\n');
    })
    .join('\n\n')
    .trim();
}
