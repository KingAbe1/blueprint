import {
  NodeJsArchitecturalImprovement,
  NodeJsConfigAudit,
  NodeJsDataModelAudit,
  NodeJsMiddlewareAudit,
  NodeJsOrmStyle,
  NodeJsResilienceAudit,
  NodeJsRouteAudit,
  NodeJsRouteFileAudit,
  NodeJsRuntimeStyle,
  NodeJsSecurityAudit,
} from '../../../types/framework';

export const AUTH_SIGNAL =
  /\b(?:auth(?:enticate|orization)?|requireAuth|ensureAuth|isAuthenticated|passport\.|jwt\.verify|verifyToken|checkSession|getSession|req\.user|request\.user|guards?\b|@UseGuards)\b/i;

export const VALIDATION_SIGNAL =
  /\b(?:z\.|zod|valibot|yup|joi|celebrate|express-validator|class-validator|safeParse|schema\.parse|validate(?:Request|Body|Query)?|@Body\s*\(\s*(?:new\s+)?ValidationPipe)\b/i;

const HELMET_OR_HEADERS =
  /\bhelmet\b|Content-Security-Policy|X-Frame-Options|Strict-Transport-Security|X-Content-Type-Options|Permissions-Policy/i;

const CORS_SIGNAL = /\bcors\s*\(|@fastify\/cors|fastify-cors|koa-cors|koa2-cors|\.use\s*\(\s*cors\b|origin\s*:/i;

const RATE_LIMIT_SIGNAL =
  /\brateLimit|rate-limit|express-rate-limit|@fastify\/rate-limit|slowDown|Bottleneck\b/i;

const ERROR_MIDDLEWARE_SIGNAL =
  /\b(?:app|router|server)\.use\s*\(\s*(?:async\s*)?\(?\s*(?:err|error)\s*,|\.setErrorHandler\s*\(|ExceptionFilter|@Catch\s*\(|onError\s*[:=]/i;

const ROUTE_METHOD_SIGNAL =
  /\.(?:get|post|put|patch|delete|all|use|route)\s*\(|@(?:Get|Post|Put|Patch|Delete|All|Options|Head)\s*\(|\.(?:route)\s*\(\s*\{/i;

const DANGEROUS_PATTERN =
  /\beval\s*\(|new\s+Function\s*\(|child_process\.(?:exec|execSync|spawn)\s*\([^)]*(?:req\.|request\.|body\.|query\.|params\.)|\$\{[^}]*(?:req\.|request\.|body\.|query\.|params\.)[^}]*\}.*(?:query|execute|sql)/i;

const OPEN_REDIRECT =
  /\b(?:res\.redirect|reply\.redirect|ctx\.redirect|c\.redirect|Response\.redirect)\s*\(\s*(?:[^)]*(?:req\.|request\.|query\.|body\.|params\.|headers\.|url\.search))/i;

const HARDCODED_SECRET =
  /(?:(?:api[_-]?key|secret|password|token|private[_-]?key)\s*[:=]\s*['"][^'"]{12,}['"])|(?:['"]sk-(?:live|test)[_-][A-Za-z0-9]{16,}['"])/i;

const SYNC_FS_IN_HANDLER =
  /\bfs\.(?:readFileSync|writeFileSync|readdirSync|statSync|existsSync)\s*\(/;

const TRUST_PROXY_SIGNAL =
  /\btrust\s*proxy\b|trustProxy\s*:\s*true|app\.set\s*\(\s*['"]trust proxy['"]/i;

const PROXY_USAGE_SIGNAL =
  /\bX-Forwarded-|x-forwarded-|req\.ip\b|request\.ip\b|express-rate-limit|rateLimit|secure\s*:\s*true/i;

const SESSION_COOKIE_SIGNAL =
  /\b(?:express-session|cookie-session|cookie-parser|@fastify\/session|fastify-cookie|cookies?\s*\()\b|session\s*\(\s*\{/i;

const WEAK_COOKIE_CONFIG =
  /(?:express-session|cookie-session|session)\s*\(\s*\{[\s\S]{0,800}?\}/;

const MULTER_SIGNAL = /\bmulter\s*\(|from\s*['"]multer['"]|require\s*\(\s*['"]multer['"]/i;

const ERROR_LEAK_SIGNAL =
  /\b(?:res|reply|ctx|c)\.(?:json|send|end)\s*\(\s*\{[^}]*(?:err(?:or)?\.stack|stack\s*:\s*err)|JSON\.stringify\s*\(\s*err(?:or)?\s*\)|\.json\s*\(\s*err(?:or)?\s*\)/i;

/** Request-controlled values interpolated into SQL / ORM raw queries. */
const SQL_INJECTION_SIGNAL =
  /(?:\$queryRaw(?:Unsafe)?|\$executeRaw(?:Unsafe)?|\.query\s*\(|\.execute\s*\(|\.raw\s*\(|knex\.raw\s*\(|sql\s*`|\b(?:SELECT|INSERT|UPDATE|DELETE|WHERE)\b[^;`'"]{0,120})[\s\S]{0,80}(?:\$\{[^}]*(?:req\.|request\.|body\.|query\.|params\.)|['"`]\s*\+\s*(?:req\.|request\.|body\.|query\.|params\.))/i;

const PATH_TRAVERSAL_SIGNAL =
  /\b(?:path\.(?:join|resolve)|createReadStream|createWriteStream|readFile(?:Sync)?|writeFile(?:Sync)?|sendFile|res\.download)\s*\([^)]*(?:req\.|request\.|params\.|query\.|body\.)/i;

const PATH_SAFE_SIGNAL =
  /\b(?:path\.normalize|path\.resolve\s*\([^)]*ROOT|startsWith\s*\(\s*(?:uploadsRoot|UPLOAD|safeRoot|BASE_DIR)|sanitize(?:Path|Filename)?)\b/i;

const WEBHOOK_ROUTE_SIGNAL =
  /\b(?:stripe|github|shopify|svix|clerk|resend|webhook)\b/i;

const WEBHOOK_VERIFY_SIGNAL =
  /\b(?:constructEvent|webhooks\.constructEvent|verify(?:Webhook|Signature)|createHmac|timingSafeEqual|stripe-signature|x-hub-signature|svix-signature)\b/i;

const JWT_VERIFY_SIGNAL = /\bjwt\.verify\s*\(|jsonwebtoken|\bjose\b|\bjwks-rsa\b/i;

const WEAK_JWT_SIGNAL =
  /\bjwt\.verify\s*\(\s*[^,]+,\s*(?:['"][^'"]{0,8}['"]|process\.env\.\w+)\s*\)|jwt\.verify\s*\([^)]*\)(?![\s\S]{0,200}algorithms\s*:)|algorithms\s*:\s*\[\s*['"]none['"]\s*\]|jwt\.sign\s*\([^)]*['"]secret['"]|secret\s*:\s*['"]secret['"]/i;

const FOOTGUN_DEPENDENCIES = ['request', 'node-uuid', 'uuidv4', 'har-validator'] as const;

const DEPRECATED_CRYPTO_SIGNAL = /\bcrypto\.createCipher\s*\(|\.createCipher\s*\(/;

/** Node majors at or below this are treated as EOL for engines.node warnings. */
const EOL_NODE_MAJOR_MAX = 18;

function parseEnginesNodeMajor(enginesNode: string | undefined): number | undefined {
  if (!enginesNode) return undefined;
  const match = enginesNode.match(/(\d{1,2})/);
  if (!match) return undefined;
  const major = Number(match[1]);
  return Number.isFinite(major) ? major : undefined;
}

function fileName(path: string): string {
  return path.split('/').pop() || path;
}

function isSourceFile(path: string): boolean {
  return /\.(?:js|jsx|ts|tsx|mjs|cjs)$/i.test(path) && !/\.(?:test|spec|d)\.[^/]+$/i.test(path);
}

function looksPublicRoute(path: string, content: string): boolean {
  const hay = `${path} ${content}`.toLowerCase();
  return /(?:^|\/)(?:health|ready|ping|status|public|webhook|login|signin|sign-up|signup|register|auth|csrf)(?:\/|$|\.|_)/i.test(
    hay,
  );
}

export function detectNodeRuntimeStyle(
  manifests: Record<string, string>,
  sourceContents: Record<string, string>,
): NodeJsRuntimeStyle {
  const depBlob = Object.entries(manifests)
    .filter(([path]) => /(^|\/)package\.json$/i.test(path.replace(/\\/g, '/')))
    .map(([, content]) => content)
    .join('\n');

  const hits: NodeJsRuntimeStyle[] = [];
  if (/"@nestjs\/core"\s*:/.test(depBlob) || /\bNestFactory\b/.test(Object.values(sourceContents).join('\n'))) {
    hits.push('nestjs');
  }
  if (/"express"\s*:/.test(depBlob) || /\bfrom\s*['"]express['"]|\brequire\s*\(\s*['"]express['"]/.test(Object.values(sourceContents).join('\n'))) {
    hits.push('express');
  }
  if (/"fastify"\s*:/.test(depBlob) || /\bfrom\s*['"]fastify['"]|\brequire\s*\(\s*['"]fastify['"]/.test(Object.values(sourceContents).join('\n'))) {
    hits.push('fastify');
  }
  if (/"koa"\s*:/.test(depBlob) || /\bfrom\s*['"]koa['"]|\brequire\s*\(\s*['"]koa['"]/.test(Object.values(sourceContents).join('\n'))) {
    hits.push('koa');
  }
  if (/"hono"\s*:/.test(depBlob) || /\bfrom\s*['"]hono['"]|\bnew\s+Hono\s*\(/.test(Object.values(sourceContents).join('\n'))) {
    hits.push('hono');
  }

  if (hits.length > 1) return 'mixed';
  if (hits.length === 1) return hits[0];

  const hasHttp =
    /\b(?:http|https|node:http|node:https)\b/.test(depBlob) ||
    Object.values(sourceContents).some(c => /\bcreateServer\s*\(|\.listen\s*\(/.test(c));
  return hasHttp ? 'node-http' : 'not-identified';
}

export function collectNodeEntryFiles(normalizedPaths: string[], sourceContents: Record<string, string>): string[] {
  const preferred = normalizedPaths.filter(path =>
    /(^|\/)(?:src\/)?(?:index|main|server|app|bootstrap)\.(?:jsx?|tsx?|mjs|cjs)$/i.test(path),
  );
  const listenFiles = normalizedPaths.filter(path => {
    if (!isSourceFile(path)) return false;
    const content = sourceContents[path] || '';
    return /\.listen\s*\(|NestFactory\.create|createServer\s*\(/.test(content);
  });
  return [...new Set([...preferred, ...listenFiles])].slice(0, 12);
}

export function auditNodeRoutes(
  normalizedPaths: string[],
  sourceContents: Record<string, string>,
  improvements: NodeJsArchitecturalImprovement[],
): NodeJsRouteAudit {
  const files: NodeJsRouteFileAudit[] = [];
  let totalHandlers = 0;
  let unvalidated = 0;
  let unprotected = 0;

  for (const path of normalizedPaths) {
    if (!isSourceFile(path)) continue;
    // Skip obvious frontend / build artifacts
    if (/(^|\/)(?:node_modules|dist|build|coverage|\.next|\.remix)\//i.test(path)) continue;
    if (/\.(?:test|spec)\./i.test(path)) continue;

    const content = sourceContents[path] || '';
    if (!content || !ROUTE_METHOD_SIGNAL.test(content)) continue;

    const methodMatches = content.match(ROUTE_METHOD_SIGNAL) || [];
    // Count approximate handler registrations
    const methodCount = Math.max(
      1,
      (content.match(/\.(?:get|post|put|patch|delete)\s*\(/gi) || []).length +
        (content.match(/@(?:Get|Post|Put|Patch|Delete)\s*\(/g) || []).length,
    );
    if (methodCount === 0 && methodMatches.length === 0) continue;

    totalHandlers += methodCount;
    const lines = content.split(/\r\n|\n|\r/).length;
    const hasValidation = VALIDATION_SIGNAL.test(content);
    const hasAuth = AUTH_SIGNAL.test(content);
    const publicish = looksPublicRoute(path, content);
    const mutates =
      /\.(?:post|put|patch|delete)\s*\(|@(?:Post|Put|Patch|Delete)\s*\(/.test(content) ||
      /\b(?:req|request)\.body\b/.test(content);

    files.push({ path, methodCount, lineCount: lines, hasValidation, hasAuth });

    if (mutates && !hasValidation && !publicish && lines > 40) {
      unvalidated += 1;
      improvements.push({
        id: `route-unvalidated-${path}`,
        category: 'route-hygiene',
        severity: 'warning',
        title: `Unvalidated Request Inputs in ${fileName(path)}`,
        impact: `${path} registers write-oriented routes or reads request bodies without an obvious schema validator (Zod/Joi/class-validator/express-validator).`,
        remediation: 'Validate body/query/params with a schema library before business logic runs, and reject invalid input early.',
        file: path,
      });
    }

    if (!hasAuth && !publicish && mutates && lines > 50) {
      unprotected += 1;
      improvements.push({
        id: `route-unprotected-${path}`,
        category: 'route-hygiene',
        severity: 'warning',
        title: `Missing Auth Signal on Routes in ${fileName(path)}`,
        impact: `${path} exposes mutation routes without an obvious auth/guard check. Unauthenticated writes are a common Node API failure mode.`,
        remediation: 'Add authentication middleware, Nest guards, or explicit session/JWT checks on non-public write routes.',
        file: path,
      });
    }
  }

  return {
    totalHandlers,
    filesCount: files.length,
    unvalidatedFilesCount: unvalidated,
    unprotectedFilesCount: unprotected,
    files: files.slice(0, 80),
  };
}

export function auditNodeMiddleware(
  normalizedPaths: string[],
  sourceContents: Record<string, string>,
  entryFiles: string[],
  improvements: NodeJsArchitecturalImprovement[],
): NodeJsMiddlewareAudit {
  const blob = Object.values(sourceContents).join('\n');
  const helmetOrHeadersPresent = HELMET_OR_HEADERS.test(blob);
  const corsPresent = CORS_SIGNAL.test(blob);
  const rateLimitPresent = RATE_LIMIT_SIGNAL.test(blob);
  const errorMiddlewarePresent = ERROR_MIDDLEWARE_SIGNAL.test(blob);

  let issueCount = 0;

  if (!helmetOrHeadersPresent && entryFiles.length > 0) {
    issueCount += 1;
    improvements.push({
      id: 'middleware-missing-helmet',
      category: 'middleware',
      severity: 'warning',
      title: 'No Security Headers Middleware Detected',
      impact: 'The scanned Node entrypoints do not reference helmet (or equivalent CSP/HSTS header setup). APIs and SSR apps often ship without baseline browser hardening.',
      remediation: 'Add helmet (Express), @fastify/helmet, or set Content-Security-Policy / X-Frame-Options / HSTS at the reverse proxy.',
      file: entryFiles[0],
    });
  }

  if (!errorMiddlewarePresent && entryFiles.length > 0) {
    issueCount += 1;
    improvements.push({
      id: 'middleware-missing-error-handler',
      category: 'error-handling',
      severity: 'warning',
      title: 'No Central Error Middleware Detected',
      impact: 'Without a centralized error handler, uncaught errors can leak stack traces or return inconsistent responses.',
      remediation: 'Register a four-argument Express error middleware, Fastify setErrorHandler, Nest exception filter, or Hono onError handler.',
      file: entryFiles[0],
    });
  }

  if (!rateLimitPresent && entryFiles.length > 0) {
    issueCount += 1;
    improvements.push({
      id: 'middleware-missing-rate-limit',
      category: 'middleware',
      severity: 'optimization',
      title: 'No Rate Limiting Signal Detected',
      impact: 'Public Node APIs without rate limiting are easier to brute-force or abuse.',
      remediation: 'Add express-rate-limit, @fastify/rate-limit, or edge/CDN rate limits for auth and write endpoints.',
      file: entryFiles[0],
    });
  }

  const looksProxied = PROXY_USAGE_SIGNAL.test(blob) || rateLimitPresent;
  const hasTrustProxy = TRUST_PROXY_SIGNAL.test(blob);
  const missingTrustProxy = Boolean(looksProxied && !hasTrustProxy && entryFiles.length > 0);
  if (missingTrustProxy) {
    issueCount += 1;
    improvements.push({
      id: 'middleware-missing-trust-proxy',
      category: 'middleware',
      severity: 'warning',
      title: 'Missing trust proxy Configuration',
      impact:
        'The app appears to sit behind a reverse proxy (rate limits, forwarded headers, or secure cookies) but does not set trust proxy. Client IPs and secure cookie behavior can be wrong.',
      remediation:
        'Set `app.set("trust proxy", 1)` (Express), `trustProxy: true` (Fastify), or the equivalent for your runtime so `req.ip` and secure cookies respect `X-Forwarded-*`.',
      file: entryFiles[0],
    });
  }

  void normalizedPaths;
  void corsPresent;

  return {
    helmetOrHeadersPresent,
    corsPresent,
    rateLimitPresent,
    errorMiddlewarePresent,
    missingTrustProxy,
    issueCount,
  };
}

export function auditNodeResilience(
  normalizedPaths: string[],
  sourceContents: Record<string, string>,
  entryFiles: string[],
  improvements: NodeJsArchitecturalImprovement[],
): NodeJsResilienceAudit {
  const blob = entryFiles.map(p => sourceContents[p] || '').join('\n') || Object.values(sourceContents).join('\n');
  const hasUncaughtExceptionHandler = /process\.on\s*\(\s*['"]uncaughtException['"]/.test(blob);
  const hasUnhandledRejectionHandler = /process\.on\s*\(\s*['"]unhandledRejection['"]/.test(blob);
  const hasGracefulShutdownSignal =
    /process\.on\s*\(\s*['"](?:SIGTERM|SIGINT)['"]/.test(blob) || /\bgraceful(?:ly)?(?:Shutdown|Close)\b/i.test(blob);

  let issueCount = 0;

  if (!hasUnhandledRejectionHandler && entryFiles.length > 0) {
    issueCount += 1;
    improvements.push({
      id: 'resilience-unhandled-rejection',
      category: 'error-handling',
      severity: 'warning',
      title: 'No unhandledRejection Handler',
      impact: 'Unhandled promise rejections can crash Node processes or leave requests hanging depending on runtime version and flags.',
      remediation: 'Register process.on("unhandledRejection", …) near the server entry and log/alert before exiting intentionally.',
      file: entryFiles[0],
    });
  }

  if (!hasGracefulShutdownSignal && entryFiles.length > 0) {
    issueCount += 1;
    improvements.push({
      id: 'resilience-graceful-shutdown',
      category: 'error-handling',
      severity: 'optimization',
      title: 'No Graceful Shutdown Signal Handler',
      impact: 'Without SIGTERM/SIGINT handling, deploys may cut in-flight requests and leave connections open.',
      remediation: 'Listen for SIGTERM/SIGINT, stop accepting connections, drain the server, then exit.',
      file: entryFiles[0],
    });
  }

  // Sync fs in server entry request path
  for (const path of [...entryFiles, ...normalizedPaths.filter(p => /(?:routes?|controllers?|handlers?|api)\//i.test(p))]) {
    const content = sourceContents[path];
    if (!content || !SYNC_FS_IN_HANDLER.test(content)) continue;
    if (!ROUTE_METHOD_SIGNAL.test(content) && !entryFiles.includes(path)) continue;
    improvements.push({
      id: `async-sync-fs-${path}`,
      category: 'async-hygiene',
      severity: 'warning',
      title: `Sync fs Usage Near Request Path (${fileName(path)})`,
      impact: `${path} uses synchronous filesystem APIs in a server/route module, which can block the event loop under load.`,
      remediation: 'Prefer fs.promises / async APIs, or move blocking work off the request path.',
      file: path,
    });
    issueCount += 1;
    if (issueCount > 8) break;
  }

  return {
    hasUncaughtExceptionHandler,
    hasUnhandledRejectionHandler,
    hasGracefulShutdownSignal,
    issueCount,
  };
}

export function auditNodeConfig(
  manifests: Record<string, string>,
  normalizedPaths: string[],
  improvements: NodeJsArchitecturalImprovement[],
): NodeJsConfigAudit {
  let hasEnginesField = false;
  let isEsm = false;
  let missingLintScript = false;
  let missingTypecheckSignal = false;
  let eolNodeEngine = false;
  let enginesNodeRaw: string | undefined;

  const rootPkg = manifests['package.json'] || Object.entries(manifests).find(([p]) => /(^|\/)package\.json$/i.test(p.replace(/\\/g, '/')))?.[1];
  if (rootPkg) {
    try {
      const pkg = JSON.parse(rootPkg) as {
        type?: string;
        engines?: Record<string, string>;
        scripts?: Record<string, string>;
      };
      enginesNodeRaw = pkg.engines?.node;
      hasEnginesField = Boolean(enginesNodeRaw);
      isEsm = pkg.type === 'module';
      const scriptBlob = Object.entries(pkg.scripts || {})
        .map(([name, cmd]) => `${name} ${cmd}`)
        .join('\n');
      missingLintScript = !/\b(?:lint|eslint)\b/i.test(scriptBlob);
      missingTypecheckSignal =
        !/\b(?:type-?check|tsc\b)\b/i.test(scriptBlob) &&
        !normalizedPaths.some(path => /(^|\/)tsconfig(?:\.[^/]+)?\.json$/i.test(path));

      const major = parseEnginesNodeMajor(enginesNodeRaw);
      // Flag when the declared range clearly targets an EOL major (e.g. "18", ">=16 <19").
      if (major !== undefined && major <= EOL_NODE_MAJOR_MAX) {
        const allowsModern =
          />\s*=?\s*(?:20|2[1-9]|[3-9]\d)/.test(enginesNodeRaw || '') ||
          /\|\|\s*(?:>=?\s*)?(?:20|2[1-9])/.test(enginesNodeRaw || '');
        eolNodeEngine = !allowsModern;
      }
    } catch {
      // ignore
    }
  }

  const committedEnvFiles = normalizedPaths.filter(path => {
    const base = path.split('/').pop() || path;
    if (/^\.env\.example$/i.test(base) || /^\.env\.sample$/i.test(base) || /^\.env\.template$/i.test(base)) {
      return false;
    }
    return /^\.env(?:\.[A-Za-z0-9_-]+)?$/i.test(base);
  });

  if (!hasEnginesField) {
    improvements.push({
      id: 'config-missing-engines',
      category: 'config-delivery',
      severity: 'optimization',
      title: 'No engines.node Field in package.json',
      impact: 'Without engines.node, contributors and CI may run unsupported Node versions silently.',
      remediation: 'Set "engines": { "node": ">=20" } (or your supported range) and enforce it in CI.',
      file: 'package.json',
    });
  } else if (eolNodeEngine) {
    improvements.push({
      id: 'config-eol-node-engine',
      category: 'modernization',
      severity: 'warning',
      title: `EOL Node Engine Declared (${enginesNodeRaw})`,
      impact: `package.json engines.node is set to "${enginesNodeRaw}", which targets Node ${EOL_NODE_MAJOR_MAX} or older. Those lines are end-of-life and miss security backports.`,
      remediation: 'Raise engines.node to a supported LTS (20+ or current LTS) and verify CI uses the same range.',
      file: 'package.json',
    });
  }

  if (missingLintScript) {
    improvements.push({
      id: 'config-missing-lint-script',
      category: 'config-delivery',
      severity: 'optimization',
      title: 'No Lint Script in package.json',
      impact: 'Without a lint script, contributors and CI lack a standard quality gate for Node services.',
      remediation: 'Add an ESLint (or Biome) lint script and run it in CI.',
      file: 'package.json',
    });
  }

  if (missingTypecheckSignal) {
    improvements.push({
      id: 'config-missing-typecheck',
      category: 'config-delivery',
      severity: 'warning',
      title: 'No Typecheck Signal Detected',
      impact: 'TypeScript Node apps without tsc/typecheck miss route and middleware typing regressions.',
      remediation: 'Add a typecheck script (`tsc --noEmit`) when using TypeScript, and run it in CI.',
      file: 'package.json',
    });
  }

  for (const envPath of committedEnvFiles.slice(0, 6)) {
    improvements.push({
      id: `config-committed-env-${envPath}`,
      category: 'security',
      severity: 'critical',
      title: `Committed Env File (${fileName(envPath)})`,
      impact: `${envPath} looks like a real env file in the scanned tree. Secrets in git history are hard to revoke fully.`,
      remediation: 'Remove the file from the repo, add it to .gitignore, rotate any exposed secrets, and keep only `.env.example` committed.',
      file: envPath,
    });
  }

  return {
    hasEnginesField,
    isEsm,
    missingLintScript,
    missingTypecheckSignal,
    eolNodeEngine,
    committedEnvFiles,
    issueCount: [
      !hasEnginesField,
      eolNodeEngine,
      missingLintScript,
      missingTypecheckSignal,
      committedEnvFiles.length > 0,
    ].filter(Boolean).length,
  };
}

export function auditNodeSecurity(
  normalizedPaths: string[],
  sourceContents: Record<string, string>,
  manifests: Record<string, string>,
  middlewareAudit: NodeJsMiddlewareAudit,
  improvements: NodeJsArchitecturalImprovement[],
): NodeJsSecurityAudit {
  const permissiveCorsFiles: string[] = [];
  const dangerousPatternFiles: string[] = [];
  const openRedirectFiles: string[] = [];
  const hardcodedSecretFiles: string[] = [];
  const weakCookieFiles: string[] = [];
  const unboundedUploadFiles: string[] = [];
  const errorLeakFiles: string[] = [];
  const sqlInjectionFiles: string[] = [];
  const pathTraversalFiles: string[] = [];
  const webhookUnsignedFiles: string[] = [];
  const weakJwtFiles: string[] = [];
  const dependencyFootguns: string[] = [];

  for (const [path, content] of Object.entries(sourceContents)) {
    if (!isSourceFile(path) || !content) continue;
    if (/(^|\/)(?:node_modules|dist|build|coverage)\//i.test(path)) continue;

    if (
      /origin\s*:\s*(?:true|['"]\*['"]|\/\.\*\/)/.test(content) &&
      CORS_SIGNAL.test(content)
    ) {
      permissiveCorsFiles.push(path);
      improvements.push({
        id: `security-permissive-cors-${path}`,
        category: 'security',
        severity: 'warning',
        title: `Permissive CORS in ${fileName(path)}`,
        impact: `${path} configures CORS with a wildcard or fully open origin. Browsers will allow any site to call credentialed/non-credentialed endpoints depending on setup.`,
        remediation: 'Allowlist trusted origins explicitly; avoid origin: true / "*" for APIs that handle private data.',
        file: path,
      });
    }

    if (DANGEROUS_PATTERN.test(content)) {
      dangerousPatternFiles.push(path);
      improvements.push({
        id: `security-dangerous-${path}`,
        category: 'security',
        severity: 'critical',
        title: `Dangerous Dynamic Execution in ${fileName(path)}`,
        impact: `${path} uses eval/Function or shells out / interpolates request data into commands or SQL-like strings.`,
        remediation: 'Remove eval/Function. Use parameterized queries and fixed command allowlists; never pass raw request input to a shell.',
        file: path,
      });
    }

    if (
      SQL_INJECTION_SIGNAL.test(content) &&
      !sqlInjectionFiles.includes(path) &&
      !dangerousPatternFiles.includes(path)
    ) {
      sqlInjectionFiles.push(path);
      improvements.push({
        id: `security-sql-injection-${path}`,
        category: 'security',
        severity: 'critical',
        title: `Possible SQL/Query Injection in ${fileName(path)}`,
        impact: `${path} builds a SQL/ORM raw query with request-controlled values via string concat or template interpolation.`,
        remediation:
          'Use parameterized queries (`$1` / `?` placeholders), Prisma tagged templates without unsanitized `${}`, or an ORM query builder. Never interpolate request input into SQL.',
        file: path,
      });
    }

    if (PATH_TRAVERSAL_SIGNAL.test(content) && !PATH_SAFE_SIGNAL.test(content)) {
      pathTraversalFiles.push(path);
      improvements.push({
        id: `security-path-traversal-${path}`,
        category: 'security',
        severity: 'critical',
        title: `Possible Path Traversal in ${fileName(path)}`,
        impact: `${path} joins or reads filesystem paths using request params/query/body without an obvious root allowlist.`,
        remediation:
          'Resolve under a fixed root directory, then assert the result `startsWith(root + path.sep)` before reading or sending the file.',
        file: path,
      });
    }

    const webhookLikely =
      WEBHOOK_ROUTE_SIGNAL.test(path) ||
      (WEBHOOK_ROUTE_SIGNAL.test(content) && /webhook/i.test(path + content));
    if (webhookLikely && ROUTE_METHOD_SIGNAL.test(content) && !WEBHOOK_VERIFY_SIGNAL.test(content)) {
      webhookUnsignedFiles.push(path);
      improvements.push({
        id: `security-webhook-unsigned-${path}`,
        category: 'security',
        severity: 'warning',
        title: `Webhook Route Without Signature Verify (${fileName(path)})`,
        impact: `${path} looks like a provider webhook handler but has no obvious HMAC/signature verification (constructEvent / createHmac / timingSafeEqual).`,
        remediation:
          'Verify the webhook signature with the provider SDK (e.g. stripe.webhooks.constructEvent) using the raw body before trusting the payload.',
        file: path,
      });
    }

    if (JWT_VERIFY_SIGNAL.test(content) && WEAK_JWT_SIGNAL.test(content)) {
      weakJwtFiles.push(path);
      improvements.push({
        id: `security-weak-jwt-${path}`,
        category: 'security',
        severity: 'warning',
        title: `Weak JWT Verification in ${fileName(path)}`,
        impact: `${path} verifies or signs JWTs with a weak/missing algorithms allowlist or a trivial secret.`,
        remediation:
          'Pass an explicit `algorithms` allowlist to jwt.verify, use a strong secret or asymmetric keys from env, and never allow `none`.',
        file: path,
      });
    }

    if (OPEN_REDIRECT.test(content) && !/\b(?:safeRedirect|allowlist|ALLOWED|startsWith\s*\(\s*['"]\/)/i.test(content)) {
      openRedirectFiles.push(path);
      improvements.push({
        id: `security-open-redirect-${path}`,
        category: 'security',
        severity: 'warning',
        title: `Possible Open Redirect in ${fileName(path)}`,
        impact: `${path} redirects using request-controlled values without an obvious same-origin allowlist.`,
        remediation: 'Validate redirect targets against an allowlist (or relative paths starting with /) before calling redirect().',
        file: path,
      });
    }

    if (HARDCODED_SECRET.test(content) && !/\.env|example|fixture|mock|test/i.test(path)) {
      hardcodedSecretFiles.push(path);
      improvements.push({
        id: `security-hardcoded-secret-${path}`,
        category: 'security',
        severity: 'critical',
        title: `Hardcoded Secret-like Value in ${fileName(path)}`,
        impact: `${path} appears to embed a long secret/token/password literal in source.`,
        remediation: 'Move secrets to environment variables or a secret manager; rotate any value that was committed.',
        file: path,
      });
    }

    // Cookie / session factories without httpOnly / sameSite / secure signals
    if (SESSION_COOKIE_SIGNAL.test(content)) {
      const sessionBlock = content.match(WEAK_COOKIE_CONFIG)?.[0] || content.slice(0, 1200);
      const missingHttpOnly = !/\bhttpOnly\s*:\s*true/.test(sessionBlock);
      const missingSameSite = !/\bsameSite\s*:/.test(sessionBlock);
      const weakSecret =
        /secret\s*:\s*['"][^'"]{0,8}['"]/.test(sessionBlock) ||
        (/session\s*\(/.test(content) && !/\bsecret\s*:/.test(sessionBlock) && /express-session/.test(content));
      if ((missingHttpOnly && missingSameSite) || weakSecret) {
        weakCookieFiles.push(path);
        improvements.push({
          id: `security-cookie-hygiene-${path}`,
          category: 'security',
          severity: 'warning',
          title: `Weak Cookie/Session Config in ${fileName(path)}`,
          impact: `${path} configures sessions/cookies without strong secret and/or httpOnly/sameSite flags.`,
          remediation:
            'Use a long random session secret from env, and set cookie flags: httpOnly: true, sameSite: "lax"|"strict", secure in production.',
          file: path,
        });
      }
    }

    // multer without limits
    if (MULTER_SIGNAL.test(content) && /\bmulter\s*\(/.test(content) && !/\blimits\s*:/.test(content)) {
      unboundedUploadFiles.push(path);
      improvements.push({
        id: `security-upload-limits-${path}`,
        category: 'security',
        severity: 'warning',
        title: `Unbounded File Upload in ${fileName(path)}`,
        impact: `${path} uses multer without an obvious limits config. Large uploads can exhaust disk or memory.`,
        remediation: 'Pass `limits: { fileSize: … }` (and optionally files count) to multer, and reject unexpected MIME types.',
        file: path,
      });
    }

    if (ERROR_LEAK_SIGNAL.test(content)) {
      errorLeakFiles.push(path);
      improvements.push({
        id: `security-error-leak-${path}`,
        category: 'security',
        severity: 'warning',
        title: `Stack/Error Leak in Response (${fileName(path)})`,
        impact: `${path} appears to send err.stack or raw Error objects to clients, which can leak paths and internals.`,
        remediation: 'Log the full error server-side; return a generic message (and request id) to clients in production.',
        file: path,
      });
    }

    if (DEPRECATED_CRYPTO_SIGNAL.test(content)) {
      dependencyFootguns.push(`crypto.createCipher:${path}`);
      improvements.push({
        id: `security-deprecated-cipher-${path}`,
        category: 'modernization',
        severity: 'warning',
        title: `Deprecated crypto.createCipher in ${fileName(path)}`,
        impact: `${path} uses crypto.createCipher, which is deprecated and hard to use safely (no IV).`,
        remediation: 'Switch to crypto.createCipheriv with an explicit algorithm, key, and random IV (or use a vetted lib like libsodium).',
        file: path,
      });
    }
  }

  // Known unsafe / abandoned npm dependencies
  for (const [manifestPath, content] of Object.entries(manifests)) {
    if (!/(^|\/)package\.json$/i.test(manifestPath.replace(/\\/g, '/'))) continue;
    try {
      const pkg = JSON.parse(content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const name of FOOTGUN_DEPENDENCIES) {
        if (!Object.hasOwn(deps, name)) continue;
        // uuidv4 package is a footgun; uuid is fine — already filtered by exact name
        if (dependencyFootguns.includes(name)) continue;
        dependencyFootguns.push(name);
        improvements.push({
          id: `security-dep-footgun-${name}`,
          category: 'modernization',
          severity: name === 'request' ? 'warning' : 'optimization',
          title: `Deprecated Dependency: ${name}`,
          impact: `package.json depends on "${name}", which is unmaintained or superseded and often carries known supply-chain / API hazards.`,
          remediation:
            name === 'request'
              ? 'Replace `request` with fetch, undici, or axios.'
              : name === 'node-uuid' || name === 'uuidv4'
                ? 'Replace with the maintained `uuid` package.'
                : `Remove or replace "${name}" with a maintained alternative.`,
          file: manifestPath === 'package.json' ? 'package.json' : manifestPath,
        });
      }
    } catch {
      // ignore
    }
  }

  void normalizedPaths;

  return {
    missingHelmetOrHeaders: !middlewareAudit.helmetOrHeadersPresent,
    permissiveCorsFiles,
    dangerousPatternFiles,
    openRedirectFiles,
    hardcodedSecretFiles,
    weakCookieFiles,
    unboundedUploadFiles,
    errorLeakFiles,
    sqlInjectionFiles,
    pathTraversalFiles,
    webhookUnsignedFiles,
    weakJwtFiles,
    dependencyFootguns,
    issueCount:
      (middlewareAudit.helmetOrHeadersPresent ? 0 : 1) +
      permissiveCorsFiles.length +
      dangerousPatternFiles.length +
      openRedirectFiles.length +
      hardcodedSecretFiles.length +
      weakCookieFiles.length +
      unboundedUploadFiles.length +
      errorLeakFiles.length +
      sqlInjectionFiles.length +
      pathTraversalFiles.length +
      webhookUnsignedFiles.length +
      weakJwtFiles.length +
      dependencyFootguns.length,
  };
}

const SENSITIVE_FIELD =
  /\b(?:password|passwd|secret|token|apiKey|api_key|accessToken|refreshToken|privateKey)\b/i;

const TIMESTAMP_FIELD = /\b(?:createdAt|updatedAt|created_at|updated_at)\b/;

function extractPrismaModels(content: string): Array<{ name: string; body: string }> {
  const models: Array<{ name: string; body: string }> = [];
  const re = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    models.push({ name: match[1], body: match[2] });
  }
  return models;
}

function extractMongooseModels(content: string): Array<{ name: string; body: string }> {
  const models: Array<{ name: string; body: string }> = [];
  const schemaRe =
    /(?:new\s+Schema\s*\(|mongoose\.model\s*\(\s*['"](\w+)['"])([\s\S]{0,2000}?)(?:\)|;)/g;
  let match: RegExpExecArray | null;
  while ((match = schemaRe.exec(content)) !== null) {
    models.push({ name: match[1] || 'Schema', body: match[0] });
  }
  const named =
    content.match(/(?:const|let|var)\s+(\w+)Schema\s*=\s*new\s+(?:mongoose\.)?Schema/g) || [];
  for (const line of named) {
    const name = line.match(/(\w+)Schema/)?.[1];
    if (name) models.push({ name, body: content.slice(0, 2500) });
  }
  return models;
}

function extractTypeOrmEntities(content: string): Array<{ name: string; body: string }> {
  const models: Array<{ name: string; body: string }> = [];
  const re = /@Entity\s*\([^)]*\)[\s\S]{0,80}(?:export\s+)?class\s+(\w+)([\s\S]{0,2500}?)(?=\n(?:@Entity|export\s+class|class\s+\w+|\/\*\*|$))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    models.push({ name: match[1], body: match[0] });
  }
  return models;
}

function extractDrizzleTables(content: string): Array<{ name: string; body: string }> {
  const models: Array<{ name: string; body: string }> = [];
  const re =
    /(?:export\s+)?const\s+(\w+)\s*=\s*(?:pgTable|mysqlTable|sqliteTable)\s*\(\s*['"][^'"]+['"]\s*,\s*\{([\s\S]*?)\}\s*(?:,|\))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    models.push({ name: match[1], body: match[2] });
  }
  return models;
}

function detectOrmStyle(
  manifests: Record<string, string>,
  normalizedPaths: string[],
): NodeJsOrmStyle {
  const depBlob = Object.entries(manifests)
    .filter(([path]) => /(^|\/)package\.json$/i.test(path.replace(/\\/g, '/')))
    .map(([, c]) => c)
    .join('\n');

  const hits: NodeJsOrmStyle[] = [];
  if (/"@prisma\/client"\s*:|"prisma"\s*:/.test(depBlob) || normalizedPaths.some(p => /schema\.prisma$/i.test(p))) {
    hits.push('prisma');
  }
  if (/"drizzle-orm"\s*:/.test(depBlob)) hits.push('drizzle');
  if (/"typeorm"\s*:/.test(depBlob)) hits.push('typeorm');
  if (/"mongoose"\s*:/.test(depBlob)) hits.push('mongoose');
  if (/"sequelize"\s*:/.test(depBlob)) hits.push('sequelize');
  if (/"knex"\s*:/.test(depBlob)) hits.push('knex');

  if (hits.length > 1) return 'mixed';
  if (hits.length === 1) return hits[0];
  if (normalizedPaths.some(p => /(^|\/)migrations?\/.+\.sql$/i.test(p))) return 'sql-migrations';
  return 'none';
}

/**
 * Reviews database models / schemas (Prisma, Drizzle, TypeORM, Mongoose, SQL migrations)
 * for indexes, sensitive fields, timestamps, and migration hygiene.
 */
export function auditNodeDataModels(
  normalizedPaths: string[],
  sourceContents: Record<string, string>,
  manifests: Record<string, string>,
  improvements: NodeJsArchitecturalImprovement[],
): NodeJsDataModelAudit {
  const ormStyle = detectOrmStyle(manifests, normalizedPaths);
  const schemaFiles: string[] = [];
  const modelsMissingTimestamps: string[] = [];
  const modelsWithSensitiveFields: string[] = [];
  const modelsMissingIndexes: string[] = [];
  let modelCount = 0;

  const migrationFiles = normalizedPaths.filter(
    path =>
      /(^|\/)migrations?\/.+\.(?:sql|ts|js)$/i.test(path) ||
      /(^|\/)prisma\/migrations\//i.test(path) ||
      /(^|\/)drizzle\/.+\.sql$/i.test(path),
  );

  // --- Prisma ---
  for (const path of normalizedPaths.filter(p => /schema\.prisma$/i.test(p))) {
    const content = sourceContents[path] || manifests[path] || '';
    if (!content) continue;
    schemaFiles.push(path);
    const models = extractPrismaModels(content);
    modelCount += models.length;

    for (const model of models) {
      const label = `${model.name}@${fileName(path)}`;
      if (!TIMESTAMP_FIELD.test(model.body)) {
        modelsMissingTimestamps.push(label);
      }

      if (SENSITIVE_FIELD.test(model.body) && /\bString\b/.test(model.body)) {
        // Flag password-like String columns — remind to store hashes only
        const sensitiveLines = model.body
          .split('\n')
          .filter(line => SENSITIVE_FIELD.test(line) && /\bString\b/.test(line));
        if (sensitiveLines.length > 0) {
          modelsWithSensitiveFields.push(label);
          improvements.push({
            id: `data-sensitive-field-${path}-${model.name}`,
            category: 'data-modeling',
            severity: 'warning',
            title: `Sensitive Field on ${model.name}`,
            impact: `Prisma model ${model.name} declares password/secret/token-like String fields. Storing plaintext credentials in the database is a critical risk if anything leaks.`,
            remediation:
              'Store only one-way hashes (bcrypt/argon2). Never persist raw passwords or long-lived secrets in model columns.',
            file: path,
          });
        }
      }

      // FK-looking fields without @@index / @relation index hint
      const fkFields = (model.body.match(/^\s*(\w+Id)\s+\w+/gm) || []).map(l => l.trim().split(/\s+/)[0]);
      const hasModelIndex = /@@index\s*\(/.test(model.body) || /@@unique\s*\(/.test(model.body);
      const indexedInline = fkFields.filter(f => new RegExp(`@relation|[\\[]\\s*${f}\\s*[\\]]`).test(model.body));
      if (fkFields.length >= 2 && !hasModelIndex && indexedInline.length < fkFields.length) {
        modelsMissingIndexes.push(label);
        improvements.push({
          id: `data-missing-index-${path}-${model.name}`,
          category: 'data-modeling',
          severity: 'optimization',
          title: `Missing Indexes on ${model.name} Foreign Keys`,
          impact: `Model ${model.name} has multiple *Id fields but no @@index/@@unique. Unindexed foreign keys slow joins and filters as tables grow.`,
          remediation: 'Add @@index([foreignKeyId]) (or @relation with an indexed field) for columns you filter or join on.',
          file: path,
        });
      }

      if (/onDelete\s*:\s*Cascade/i.test(model.body) && /user|account|payment|order/i.test(model.name + model.body)) {
        improvements.push({
          id: `data-cascade-${path}-${model.name}`,
          category: 'data-modeling',
          severity: 'warning',
          title: `Cascade Delete on ${model.name}`,
          impact: `${model.name} uses onDelete: Cascade near user/account/payment-like data. Accidental parent deletes can wipe related records.`,
          remediation: 'Prefer onDelete: Restrict or SetNull for critical relations, and soft-delete where you need recoverability.',
          file: path,
        });
      }
    }
  }

  // --- Drizzle ---
  for (const [path, content] of Object.entries(sourceContents)) {
    if (!isSourceFile(path) || !content) continue;
    if (!/pgTable|mysqlTable|sqliteTable/.test(content)) continue;
    if (!schemaFiles.includes(path)) schemaFiles.push(path);
    const tables = extractDrizzleTables(content);
    modelCount += tables.length;
    for (const table of tables) {
      const label = `${table.name}@${fileName(path)}`;
      if (!TIMESTAMP_FIELD.test(table.body)) modelsMissingTimestamps.push(label);
      if (SENSITIVE_FIELD.test(table.body)) {
        modelsWithSensitiveFields.push(label);
        improvements.push({
          id: `data-sensitive-drizzle-${path}-${table.name}`,
          category: 'data-modeling',
          severity: 'warning',
          title: `Sensitive Column on ${table.name}`,
          impact: `Drizzle table ${table.name} includes password/secret/token-like columns.`,
          remediation: 'Persist hashes only (argon2/bcrypt); keep raw secrets out of the database.',
          file: path,
        });
      }
      if (/\w+Id\s*:/.test(table.body) && !/\.index\(|uniqueIndex|primaryKey/.test(content.slice(Math.max(0, content.indexOf(table.name) - 50), content.indexOf(table.name) + table.body.length + 200))) {
        // Soft signal — only if no nearby index helpers in file for this table region
        if (!modelsMissingIndexes.includes(label) && (table.body.match(/\w+Id\s*:/g) || []).length >= 2) {
          modelsMissingIndexes.push(label);
          improvements.push({
            id: `data-drizzle-index-${path}-${table.name}`,
            category: 'data-modeling',
            severity: 'optimization',
            title: `Likely Missing Index on ${table.name}`,
            impact: `Table ${table.name} declares multiple *Id columns without an obvious index() nearby.`,
            remediation: 'Add index()/uniqueIndex() on foreign-key columns used in WHERE/JOIN clauses.',
            file: path,
          });
        }
      }
    }
  }

  // --- TypeORM ---
  for (const [path, content] of Object.entries(sourceContents)) {
    if (!isSourceFile(path) || !/@Entity\b/.test(content || '')) continue;
    if (!schemaFiles.includes(path)) schemaFiles.push(path);
    const entities = extractTypeOrmEntities(content);
    modelCount += entities.length || (/@Entity\b/.test(content) ? 1 : 0);
    for (const entity of entities.length ? entities : [{ name: fileName(path), body: content }]) {
      const label = `${entity.name}@${fileName(path)}`;
      if (!TIMESTAMP_FIELD.test(entity.body) && !/@CreateDateColumn|@UpdateDateColumn/.test(entity.body)) {
        modelsMissingTimestamps.push(label);
      }
      if (SENSITIVE_FIELD.test(entity.body) && /@Column/.test(entity.body)) {
        modelsWithSensitiveFields.push(label);
        improvements.push({
          id: `data-sensitive-typeorm-${path}-${entity.name}`,
          category: 'data-modeling',
          severity: 'warning',
          title: `Sensitive Column on ${entity.name}`,
          impact: `TypeORM entity ${entity.name} has password/secret-like columns.`,
          remediation: 'Hash credentials before persist; consider @BeforeInsert hooks for hashing.',
          file: path,
        });
      }
      if (/@ManyToOne|@OneToMany|@JoinColumn/.test(entity.body) && !/@Index\b/.test(entity.body)) {
        modelsMissingIndexes.push(label);
        improvements.push({
          id: `data-typeorm-index-${path}-${entity.name}`,
          category: 'data-modeling',
          severity: 'optimization',
          title: `Relation Without @Index on ${entity.name}`,
          impact: `Entity ${entity.name} declares relations but no @Index. Relation columns are common filter targets.`,
          remediation: 'Add @Index() on foreign-key columns used in queries.',
          file: path,
        });
      }
    }
  }

  // --- Mongoose ---
  for (const [path, content] of Object.entries(sourceContents)) {
    if (!isSourceFile(path) || !content) continue;
    if (!/\b(?:mongoose|new\s+Schema)\b/.test(content)) continue;
    if (!/(?:Schema|model)\s*\(/.test(content)) continue;
    // Skip pure mongoose import in non-model files without schema defs
    if (!/new\s+(?:mongoose\.)?Schema|mongoose\.model/.test(content)) continue;
    if (!schemaFiles.includes(path)) schemaFiles.push(path);
    const models = extractMongooseModels(content);
    modelCount += Math.max(models.length, 1);
    const label = `${models[0]?.name || fileName(path)}@${fileName(path)}`;
    if (!TIMESTAMP_FIELD.test(content) && !/timestamps\s*:\s*true/.test(content)) {
      modelsMissingTimestamps.push(label);
      improvements.push({
        id: `data-mongoose-timestamps-${path}`,
        category: 'data-modeling',
        severity: 'optimization',
        title: `Mongoose Schema Missing Timestamps (${fileName(path)})`,
        impact: `${path} defines a Mongoose schema without timestamps: true or createdAt/updatedAt fields.`,
        remediation: 'Pass `{ timestamps: true }` to Schema options for automatic createdAt/updatedAt.',
        file: path,
      });
    }
    if (SENSITIVE_FIELD.test(content)) {
      modelsWithSensitiveFields.push(label);
      improvements.push({
        id: `data-mongoose-sensitive-${path}`,
        category: 'data-modeling',
        severity: 'warning',
        title: `Sensitive Field in Mongoose Schema (${fileName(path)})`,
        impact: `${path} declares password/secret-like fields. Ensure values are hashed and select: false where appropriate.`,
        remediation: 'Hash with bcrypt/argon2 on save; set `select: false` on password fields so they are omitted from default queries.',
        file: path,
      });
    }
  }

  // --- SQL migrations: CREATE TABLE without PRIMARY KEY ---
  for (const path of migrationFiles.filter(p => /\.sql$/i.test(p))) {
    const content = sourceContents[path] || manifests[path] || '';
    if (!content) continue;
    const createBlocks = content.match(/CREATE\s+TABLE[\s\S]{0,2000}?\;/gi) || [];
    for (const block of createBlocks.slice(0, 8)) {
      const tableName = block.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)/i)?.[1] || 'table';
      modelCount += 1;
      if (!schemaFiles.includes(path)) schemaFiles.push(path);
      if (!/PRIMARY\s+KEY/i.test(block)) {
        improvements.push({
          id: `data-sql-no-pk-${path}-${tableName}`,
          category: 'data-modeling',
          severity: 'warning',
          title: `SQL Table Without Primary Key (${tableName})`,
          impact: `Migration ${path} creates ${tableName} without a PRIMARY KEY, which complicates updates, replication, and ORM mapping.`,
          remediation: 'Add an explicit PRIMARY KEY (id UUID/serial) to every application table.',
          file: path,
        });
      }
    }
  }

  // Migration hygiene when an ORM is present
  if (ormStyle !== 'none' && ormStyle !== 'sql-migrations' && ormStyle !== 'mongoose' && migrationFiles.length === 0) {
    improvements.push({
      id: 'data-missing-migrations',
      category: 'data-modeling',
      severity: 'warning',
      title: 'ORM Detected Without Migration Files',
      impact: `${ormStyle} appears in dependencies/schemas, but no migrations folder was found. Schema drift between environments is a common outage cause.`,
      remediation:
        ormStyle === 'prisma'
          ? 'Commit prisma/migrations and run prisma migrate in CI/CD.'
          : ormStyle === 'drizzle'
            ? 'Generate and commit Drizzle SQL migrations; apply them in deploy.'
            : 'Add versioned migration files and apply them as part of deploy.',
      file: schemaFiles[0],
    });
  }

  // Timestamp summary (cap noise — one optimization if many models lack timestamps)
  const uniqueMissingTs = [...new Set(modelsMissingTimestamps)];
  if (uniqueMissingTs.length >= 3 && ormStyle !== 'none') {
    improvements.push({
      id: 'data-missing-timestamps-summary',
      category: 'data-modeling',
      severity: 'optimization',
      title: `${uniqueMissingTs.length} Models Missing Timestamps`,
      impact: 'Several models/tables lack createdAt/updatedAt (or ORM timestamp options). Auditing and debugging production data becomes harder.',
      remediation: 'Add createdAt/updatedAt (Prisma DateTime @default(now()) / @updatedAt, Mongoose timestamps: true, TypeORM @CreateDateColumn).',
      file: schemaFiles[0],
    });
  }

  const issueCount = improvements.filter(i => i.category === 'data-modeling').length;

  return {
    ormStyle,
    modelCount,
    schemaFiles: [...new Set(schemaFiles)].slice(0, 40),
    migrationFilesCount: migrationFiles.length,
    modelsMissingTimestamps: uniqueMissingTs.slice(0, 30),
    modelsWithSensitiveFields: [...new Set(modelsWithSensitiveFields)].slice(0, 30),
    modelsMissingIndexes: [...new Set(modelsMissingIndexes)].slice(0, 30),
    issueCount,
  };
}
