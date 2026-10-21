/** Brownfield repos matching these profiles get deep parse, rules, and specialization UI. */
export const SUPPORTED_DEEP_ANALYSIS_PROFILES = [
  'Next.js (JavaScript / TypeScript)',
  'Remix (JavaScript / TypeScript)',
] as const;

export function supportedDeepProfilesSummary(): string {
  return SUPPORTED_DEEP_ANALYSIS_PROFILES.join(', ');
}

export function deepProfileNotMatchedMessage(): string {
  return `Deep source-level checks run when the repo matches a supported language or framework profile. Supported today: ${supportedDeepProfilesSummary()}. Additional profiles are planned.`;
}

export function deepProfileRulesUnsupportedMessage(): string {
  return `Risk-pattern review runs for supported language/framework profiles only (${supportedDeepProfilesSummary()} today).`;
}
