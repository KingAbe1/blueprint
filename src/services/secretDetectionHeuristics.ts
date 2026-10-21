/**
 * Shared heuristics for hard-coded secret findings.
 * Prefer high-confidence matches; skip placeholders, env lookups, and test fixtures.
 *
 * Note: avoid writing `//` inside `/.../` regex literals — Vite's oxc parser
 * can treat that as end-of-line comment and break the module.
 */

const SKIP_PATH =
  /(?:^|\/)(?:__tests__|tests?|e2e|fixtures?|mocks?|stories|__mocks__|testdata|sample|examples?)(?:\/|$)|(?:\.env(?:\.[^/]+)?(?:\.example|\.sample|\.template)?$)|(?:example|sample|fixture|mock|spec|test|storybook)[^/]*\.(?:[cm]?[jt]sx?|json|md)$/i;

const ENV_LOOKUP =
  /\b(?:process\.env|import\.meta\.env|Deno\.env|Bun\.env|os\.environ|getenv|config\(|secrets\.|SecretManager|fromEnv)\b/i;

const PLACEHOLDER_VALUE =
  /^(?:x+|y+|z+|\*+|•+|#+|changeme|change.?me|replace.?me|todo|fillme|your[_-]?.+|my[_-]?secret|secret|password|passwd|pass|admin|test|testing|dummy|fake|sample|example|placeholder|null|undefined|n\/?a|not[_-]?set|none|empty|xxx+|abc123|password123|secret123|12345678+|asdf+|qwerty)$/i;

/** Known provider secret prefixes (high confidence). */
const PROVIDER_SECRET_LITERAL =
  /['"`](sk-(?:live|test)[_-][A-Za-z0-9]{16,}|sk-ant-api03-[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|sk-or-v1-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})['"`]/;

/**
 * Assignment of credential-like names to a quoted literal.
 * Requires a longer payload than the old 8-char rule to cut noise.
 */
const CREDENTIAL_ASSIGNMENT =
  /\b(?:password|passwd|secret|api[_-]?key|private[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|auth[_-]?token)\b\s*[:=]\s*(['"`])([^'"`\r\n]{16,})\1/i;

const URL_OR_PATH_VALUE = /^(?:https?:\/{2}|\/|\.\/|\.\.\/)/i;
const TEMPLATE_LEFTOVER = /\$\{|<%|\{\{/;
const PLACEHOLDER_PHRASE =
  /changeme|replace.?me|fillme|your[_-]?|dummy|fake|sample|placeholder|example|not[_-]?a[_-]?secret|test[_-]?key|test[_-]?secret/i;
const PLACEHOLDER_LINE =
  /example|placeholder|your[_ -].*(?:key|token|secret)|changeme|dummy|fake|sample|todo|fillme/i;
const COMMENT_LINE_PREFIX = /^\s*(?:\/{2}|#|\*|\/\*)/;
const SECRETISH_WORD = /secret|password|api.?key|token/i;

export function isSecretScanSkippedPath(path: string): boolean {
  return SKIP_PATH.test(path.replace(/\\/g, '/'));
}

export function looksLikePlaceholderSecret(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 16) return true;
  if (PLACEHOLDER_VALUE.test(trimmed)) return true;
  if (PLACEHOLDER_PHRASE.test(trimmed)) return true;
  // All one character / trivial repeats
  if (/^(.)\1{7,}$/.test(trimmed)) return true;
  // Mostly digits with low entropy (e.g. 1234567890123456)
  if (/^\d+$/.test(trimmed) && new Set(trimmed).size <= 4) return true;
  // URL / path / relative import — not a secret
  if (URL_OR_PATH_VALUE.test(trimmed)) return true;
  // Template / interpolation leftovers
  if (TEMPLATE_LEFTOVER.test(trimmed)) return true;
  // Readable kebab/snake phrases without digit+symbol mix (e.g. development-mode-secret)
  if (/^[a-z]+(?:[_-][a-z]+){1,6}$/i.test(trimmed) && !/\d/.test(trimmed)) return true;
  return false;
}

export function lineSuggestsEnvOrPlaceholder(line: string): boolean {
  if (ENV_LOOKUP.test(line)) return true;
  if (PLACEHOLDER_LINE.test(line)) return true;
  // Comments documenting env vars
  if (COMMENT_LINE_PREFIX.test(line) && SECRETISH_WORD.test(line)) return true;
  return false;
}

export function findHardcodedSecretInLine(line: string): { kind: 'provider' | 'assignment'; value: string } | null {
  if (lineSuggestsEnvOrPlaceholder(line)) return null;

  const provider = line.match(PROVIDER_SECRET_LITERAL);
  if (provider?.[1] && !looksLikePlaceholderSecret(provider[1])) {
    return { kind: 'provider', value: provider[1] };
  }

  CREDENTIAL_ASSIGNMENT.lastIndex = 0;
  const assignment = CREDENTIAL_ASSIGNMENT.exec(line);
  if (assignment?.[2] && !looksLikePlaceholderSecret(assignment[2])) {
    // Require mixed charset for generic assignments (avoid "password = 'development-mode'")
    const value = assignment[2];
    const hasLetter = /[A-Za-z]/.test(value);
    const hasDigit = /\d/.test(value);
    const hasSymbol = /[^A-Za-z0-9]/.test(value);
    const entropyScore = [hasLetter, hasDigit, hasSymbol].filter(Boolean).length;
    if (entropyScore < 2 && value.length < 24) return null;
    return { kind: 'assignment', value };
  }

  return null;
}

/** True when file content has at least one high-confidence hard-coded secret line. */
export function contentHasHardcodedSecret(path: string, content: string): boolean {
  if (isSecretScanSkippedPath(path) || !content) return false;
  for (const line of content.split(/\r\n|\n|\r/)) {
    if (findHardcodedSecretInLine(line)) return true;
  }
  return false;
}

/** First hard-coded credential match for baseline quality findings (index into content). */
export function findFirstHardcodedCredentialMatch(
  content: string,
): { index: number; lineText: string } | null {
  let offset = 0;
  for (const line of content.split(/\r\n|\n|\r/)) {
    if (findHardcodedSecretInLine(line)) {
      return { index: offset, lineText: line };
    }
    offset += line.length + 1;
  }
  return null;
}
