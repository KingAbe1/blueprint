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
