import type { QualityFinding } from '../types/codebase';

interface LanguageSourceRule {
  extensions: string[];
  pattern: RegExp;
  except?: RegExp;
  title: string;
  detail: string;
  priority: QualityFinding['priority'];
  category?: QualityFinding['category'];
}

export const LANGUAGE_SOURCE_RULES: LanguageSourceRule[] = [
  { extensions: ['py'], pattern: /\byaml\.load\s*\(/i, except: /safe_load|SafeLoader/, title: 'Potentially unsafe YAML loading', detail: 'yaml.load can construct Python objects depending on the library version and loader. Confirm an explicit safe loader is used for untrusted input.', priority: 'medium' },
  { extensions: ['py'], pattern: /\bpickle\.(?:loads?|Unpickler)\b/i, title: 'Python pickle deserialization', detail: 'Pickle can execute code while loading data. Do not deserialize content from users or other untrusted sources.', priority: 'medium' },
  { extensions: ['js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts'], pattern: /\b(?:exec|execSync)\s*\(\s*`[^`]*\$\{/i, title: 'Interpolated shell command', detail: 'A shell command appears to include interpolated values. Validate the source of those values or use an argument-based process API to avoid command injection.', priority: 'medium' },
  { extensions: ['ts', 'tsx', 'mts', 'cts'], pattern: /\/\/\s*@ts-(?:ignore|nocheck)\b|\/\*\s*@ts-nocheck\b/i, title: 'TypeScript checking suppressed', detail: 'A TypeScript suppression disables diagnostics for a line or file. Prefer a narrow, explained suppression so type errors remain visible elsewhere.', priority: 'low' },
  { extensions: ['go'], pattern: /InsecureSkipVerify\s*:\s*true\b/i, title: 'TLS certificate verification disabled', detail: 'Go TLS certificate verification appears to be disabled. This can expose connections to interception; restrict it to controlled tests if needed.', priority: 'high' },
  { extensions: ['go'], pattern: /\bexec\.Command\s*\(\s*["'](?:sh|bash)["']/i, title: 'Shell invoked by Go process command', detail: 'A shell is launched through exec.Command. Avoid concatenating untrusted input into shell arguments; pass validated arguments directly to the target program.', priority: 'medium' },
  { extensions: ['java', 'kt', 'kts'], pattern: /\b(?:ObjectInputStream|XMLDecoder)\b|\.readObject\s*\(/i, title: 'Java object deserialization', detail: 'Native object deserialization can be unsafe for untrusted data. Verify the input is trusted or use a constrained data format with validation.', priority: 'medium' },
  { extensions: ['php'], pattern: /\bunserialize\s*\(/i, title: 'PHP object deserialization', detail: 'unserialize can instantiate objects and invoke magic methods. Avoid applying it to untrusted data; prefer JSON or a restricted format.', priority: 'medium' },
  { extensions: ['rb'], pattern: /\b(?:YAML\.load|Marshal\.load)\s*\(/i, title: 'Ruby unsafe deserialization', detail: 'YAML.load and Marshal.load can instantiate objects from input. Use safe parsing and validate data when the source is not fully trusted.', priority: 'medium' },
  { extensions: ['cs'], pattern: /\bBinaryFormatter\b[\s\S]{0,160}\bDeserialize\s*\(|\bDeserialize\s*\([\s\S]{0,160}\bBinaryFormatter\b/i, title: '.NET BinaryFormatter deserialization', detail: 'BinaryFormatter deserialization is unsafe for untrusted data. Replace it with a safer, schema-based serializer.', priority: 'high' },
  { extensions: ['c', 'h', 'cc', 'cpp', 'hpp'], pattern: /\b(?:gets|strcpy|strcat|sprintf|vsprintf)\s*\(/i, title: 'Unsafe C/C++ memory API', detail: 'A legacy memory API without destination-size protection appears in use. Validate bounds and prefer safer alternatives appropriate to the project.', priority: 'medium' },
  { extensions: ['dart'], pattern: /badCertificateCallback\s*=|badCertificateCallback\s*:/i, title: 'Custom TLS certificate acceptance', detail: 'A custom certificate callback can allow invalid certificates. Confirm it rejects untrusted certificates outside controlled development use.', priority: 'medium' },
  { extensions: ['js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts'], pattern: /\b(?:exec|execSync)\s*\(\s*['"`][^\n'"`]*['"`]\s*\+/i, title: 'Dynamically assembled shell command', detail: 'A shell command appears to be assembled from concatenated values. If any part can be influenced externally, pass validated arguments directly to a process API instead.', priority: 'medium', category: 'security' },
  { extensions: ['js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts'], pattern: /\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/i, title: 'Empty JavaScript error handler', detail: 'An exception is caught and discarded. Handle expected failures or record enough context to diagnose unexpected ones.', priority: 'low', category: 'correctness' },
  { extensions: ['js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts'], pattern: /\b(?:localStorage|sessionStorage)\s*\.\s*setItem\s*\(\s*['"`][^'"`]*(?:token|secret|password|api.?key)[^'"`]*['"`]/i, title: 'Sensitive value stored in browser storage', detail: 'A credential-like value appears to be written to browser storage, where injected scripts can read it. Review whether a safer session strategy is available.', priority: 'medium', category: 'security' },
  { extensions: ['js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts'], pattern: /\bconsole\.(?:log|debug)\s*\(/i, title: 'Debug logging in application source', detail: 'Debug output may expose implementation details or sensitive values and can add noise in production. Confirm it is intentional or remove it.', priority: 'low', category: 'maintainability' },
  { extensions: ['py'], pattern: /\bsubprocess\.(?:run|Popen|call|check_call|check_output)\s*\([\s\S]{0,180}?\bshell\s*=\s*True/i, title: 'Python subprocess runs through a shell', detail: 'Shell mode can turn externally influenced command text into command injection. Prefer an argument list and avoid shell=True unless required and carefully constrained.', priority: 'medium', category: 'security' },
  { extensions: ['py'], pattern: /\b(?:execute|executemany)\s*\(\s*(?:f['"]|['"][^'"\n]*\s%\s|['"][^'"\n]*\s\+\s)/i, title: 'Potentially concatenated SQL query', detail: 'The SQL statement appears to be assembled from string values. Use parameterized queries so input is treated as data.', priority: 'medium', category: 'security' },
  { extensions: ['java', 'kt', 'kts'], pattern: /\b(?:Statement|createStatement)\b[\s\S]{0,220}?\bexecute(?:Query|Update)?\s*\(\s*[^)]*\+/i, title: 'Potentially concatenated SQL query', detail: 'The SQL statement appears to be assembled with string concatenation. Use prepared statements and bind values as parameters.', priority: 'medium', category: 'security' },
  { extensions: ['rb'], pattern: /\b(?:system|exec|`)[^\n]*(?:#\{|%s)/i, title: 'Potentially interpolated shell command', detail: 'A shell command appears to contain interpolated values. Validate the source of those values or use an argument-based process API.', priority: 'medium', category: 'security' },
  { extensions: ['php'], pattern: /\b(?:mysql_query|mysqli_query)\s*\([^\n]*\./i, title: 'Potentially concatenated SQL query', detail: 'The SQL statement may be assembled through concatenation. Use parameterized queries to keep input separate from SQL syntax.', priority: 'medium', category: 'security' },
  { extensions: ['go'], pattern: /\b(?:fmt\.Printf|log\.Printf)\s*\([^\n]*(?:%v|%s|%+v)/i, title: 'Formatted diagnostic logging', detail: 'Review logged values to ensure credentials, personal data, or request contents are not exposed in production logs.', priority: 'low', category: 'security' },
  { extensions: ['cs'], pattern: /\b(?:SqlCommand|ExecuteSqlRaw|FromSqlRaw)\s*\([^\n]*\+/i, title: 'Potentially concatenated SQL query', detail: 'The SQL command appears to be assembled with string concatenation. Use parameters or the ORM’s parameterized query APIs.', priority: 'medium', category: 'security' },
  { extensions: ['swift'], pattern: /\b(?:URLSession|URLRequest)[^\n]*\bhttp:\/\//i, title: 'Unencrypted HTTP endpoint', detail: 'A network URL uses plain HTTP. Confirm this is local or intentionally public; production traffic should generally use HTTPS.', priority: 'medium', category: 'security' },
];

interface NextSourceRule {
  title: string;
  detail: string;
  priority: QualityFinding['priority'];
  pattern: RegExp;
  pathPattern: RegExp;
  except?: RegExp;
}

// Next.js App Router and Pages Router have different correctness constraints.
// These checks are intentionally limited to high-signal file/framework rules.
export const NEXT_SOURCE_RULES: NextSourceRule[] = [
  { pathPattern: /(^|\/)app\/.*\.(?:[jt]sx?)$/i, except: /^\s*['"]use client['"]/i, pattern: /\buse(?:State|Effect|LayoutEffect|Reducer|Ref|Callback|Memo|Context|Transition|DeferredValue|SyncExternalStore|Router|Params|Pathname|SearchParams|SelectedLayoutSegment|SelectedLayoutSegments)\s*\(/, title: 'React hook used in a Next.js server component', detail: 'App Router modules are Server Components by default. Move the interactive component behind a client boundary with a top-level "use client" directive.', priority: 'high' },
  { pathPattern: /\.(?:[jt]sx?)$/i, pattern: /^\s*['"]use client['"]\s*;?[\s\S]*?\bexport\s+default\s+async\s+function\b/m, title: 'Async Next.js client component', detail: 'Client Components cannot be async functions. Keep data loading in a Server Component or load it from a client-side effect or query layer.', priority: 'high' },
  { pathPattern: /(^|\/)app\/.*\.(?:[jt]sx?)$/i, pattern: /\bfrom\s*['"]next\/router['"]/, title: 'Pages Router API used in the Next.js App Router', detail: 'The next/router hook is for the Pages Router. In app/ routes, use the navigation APIs from next/navigation.', priority: 'medium' },
  { pathPattern: /(^|\/)app\/.*\bpage\.(?:[jt]sx?)$/i, pattern: /\bexport\s+(?:async\s+)?(?:function|const|let|var)\s+get(?:ServerSide|Static)Props\b/, title: 'Pages Router data export in an App Router page', detail: 'getServerSideProps and getStaticProps are not supported in app/ routes. Use Server Component data loading or route segment options.', priority: 'high' },
  { pathPattern: /(^|\/)app\/.*\broute\.(?:[jt]s)$/i, pattern: /\bexport\s+default\b|\bas\s+default\b/, title: 'Default export in a Next.js route handler', detail: 'App Router route handlers use named HTTP method exports such as GET or POST. Replace the default export with the intended method handler.', priority: 'high' },
  { pathPattern: /(^|\/)app\/.*\broute\.(?:[jt]s)$/i, pattern: /^(?![\s\S]*\bexport\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b)(?![\s\S]*\bexport\s+(?:const|let|var)\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b)(?![\s\S]*\bexport\s*\{[^}]*\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b[^}]*\})[\s\S]*$/, title: 'No HTTP method exported from a Next.js route handler', detail: 'An app/**/route file should export at least one supported HTTP method. Verify the handler is exported with the correct method name.', priority: 'high' },
  { pathPattern: /(^|\/)app\/.*\b(?:page|layout)\.(?:[jt]sx?)$/i, pattern: /^(?![\s\S]*\bexport\s+default\b)(?![\s\S]*\bas\s+default\b)[\s\S]*$/, title: 'Missing default component export in a Next.js page or layout', detail: 'Next.js page and layout files need a default component export. Confirm this file exports the route UI as default.', priority: 'high' },
];

interface ToolchainQualityRule {
  id: string;
  languages: string[];
  name: string;
  category: QualityFinding['category'];
  pathPatterns?: RegExp[];
  manifestPatterns?: RegExp[];
  scriptPatterns?: RegExp[];
  testFilePatterns?: RegExp[];
}

// Keep toolchain checks declarative so new languages and ecosystem tools can be
// added without changing the assessment flow. These checks detect configuration;
// Blueprint does not execute the commands it finds.
export const TOOLCHAIN_QUALITY_RULES: ToolchainQualityRule[] = [
  { id: 'js-tests', languages: ['JavaScript', 'TypeScript', 'Vue', 'Svelte'], name: 'Jest / Vitest / Playwright / Cypress tests', category: 'testing', pathPatterns: [/(^|\/)(vitest|jest|playwright|cypress)\.config\./, /(^|\/)\.mocharc/], manifestPatterns: [/\b(?:vitest|jest|playwright|@playwright\/test|cypress|mocha|@testing-library\/react)\b/], scriptPatterns: [/^(?:test|test:.*|e2e|cypress)$/], testFilePatterns: [/\.(?:test|spec|cy)\.[^/]+$/, /(^|\/)(__tests__|tests?|e2e|cypress\/e2e)\//] },
  { id: 'python-tests', languages: ['Python'], name: 'Pytest / unittest', category: 'testing', pathPatterns: [/(^|\/)(pytest\.ini|tox\.ini|conftest\.py)$/], manifestPatterns: [/\bpytest\b|\[tool\.pytest/,], scriptPatterns: [/^(?:test|tests)$/], testFilePatterns: [/(^|\/)test_[^/]+\.py$/, /(^|\/)[^/]+_test\.py$/, /(^|\/)tests?\//] },
  { id: 'rust-tests', languages: ['Rust'], name: 'Cargo tests', category: 'testing', pathPatterns: [/(^|\/)cargo\.toml$/], manifestPatterns: [/cargo\s+test/], testFilePatterns: [/(^|\/)tests?\//] },
  { id: 'go-tests', languages: ['Go'], name: 'Go tests', category: 'testing', pathPatterns: [/(^|\/)go\.mod$/], manifestPatterns: [/go\s+test/], testFilePatterns: [/_test\.go$/] },
  { id: 'jvm-tests', languages: ['Java', 'Kotlin'], name: 'JUnit / Gradle / Maven tests', category: 'testing', pathPatterns: [/(^|\/)(pom\.xml|build\.gradle(?:\.kts)?|build\.gradle)$/], manifestPatterns: [/junit|testng|usejunitplatform/], testFilePatterns: [/(^|\/)src\/test\//] },
  { id: 'dotnet-tests', languages: ['C#'], name: '.NET tests', category: 'testing', pathPatterns: [/\.slnx?$/, /\.csproj$/], manifestPatterns: [/microsoft\.net\.test\.sdk|\bdotnet\s+test\b/], scriptPatterns: [/^test$/], testFilePatterns: [/(^|\/)(tests?|[^/]+\.tests?)\//i] },
  { id: 'php-tests', languages: ['PHP'], name: 'PHPUnit tests', category: 'testing', pathPatterns: [/(^|\/)(phpunit\.xml(?:\.dist)?|pest\.php)$/], manifestPatterns: [/phpunit\/phpunit|\bpestphp\b/], scriptPatterns: [/^(?:test|test:.*)$/], testFilePatterns: [/(^|\/)(tests?|tests?\.php)\//] },
  { id: 'ruby-tests', languages: ['Ruby'], name: 'RSpec / Minitest', category: 'testing', pathPatterns: [/(^|\/)(\.rspec|\.simplecov)$/], manifestPatterns: [/rspec|\bminitest\b/], scriptPatterns: [/^(?:test|spec)$/], testFilePatterns: [/(^|\/)(spec|test)\//] },
  { id: 'swift-tests', languages: ['Swift'], name: 'Swift Package tests', category: 'testing', pathPatterns: [/(^|\/)package\.swift$/], manifestPatterns: [/swift\s+test/], testFilePatterns: [/(^|\/)tests?\//] },
  { id: 'dart-tests', languages: ['Dart'], name: 'Dart / Flutter tests', category: 'testing', pathPatterns: [/(^|\/)pubspec\.yaml$/], manifestPatterns: [/flutter_test|\bdart\s+test\b/], testFilePatterns: [/(^|\/)test\//] },
  { id: 'cpp-tests', languages: ['C', 'C/C++', 'C++'], name: 'CTest', category: 'testing', pathPatterns: [/(^|\/)cmakelists\.txt$/], manifestPatterns: [/enable_testing\s*\(|add_test\s*\(/], testFilePatterns: [/(^|\/)(tests?|test)\//] },
  { id: 'js-lint', languages: ['JavaScript', 'TypeScript', 'Vue', 'Svelte'], name: 'ESLint', category: 'tooling', pathPatterns: [/eslint\.config\./, /(^|\/)\.eslintrc/], manifestPatterns: [/\beslint\b/], scriptPatterns: [/^lint$/] },
  { id: 'js-format', languages: ['JavaScript', 'TypeScript', 'Vue', 'Svelte', 'CSS', 'SCSS', 'HTML'], name: 'Prettier', category: 'tooling', pathPatterns: [/prettier\.config\./, /(^|\/)\.prettierrc/], manifestPatterns: [/\bprettier\b/], scriptPatterns: [/^format$/] },
  { id: 'js-types', languages: ['TypeScript'], name: 'TypeScript type checking', category: 'correctness', pathPatterns: [/(^|\/)tsconfig(?:\.[^/]+)?\.json$/], manifestPatterns: [/\btsc\b/], scriptPatterns: [/^type-?check$/] },
  { id: 'py-lint', languages: ['Python'], name: 'Ruff / Flake8 / Pylint', category: 'tooling', pathPatterns: [/(^|\/)(\.ruff\.toml|\.flake8|\.pylintrc)$/], manifestPatterns: [/\[tool\.(?:ruff|mypy|black|isort)|\b(?:ruff|flake8|pylint)\b/], scriptPatterns: [/^(?:lint|check)$/] },
  { id: 'py-format', languages: ['Python'], name: 'Black / isort', category: 'tooling', pathPatterns: [/(^|\/)(\.black|\.isort\.cfg)$/], manifestPatterns: [/\[tool\.(?:black|isort)\]/], scriptPatterns: [/^format$/] },
  { id: 'py-types', languages: ['Python'], name: 'Mypy / Pyright', category: 'correctness', pathPatterns: [/(^|\/)(mypy\.ini|\.mypy\.ini|pyrightconfig\.json)$/], manifestPatterns: [/\[tool\.(?:mypy|pyright)\]/], scriptPatterns: [/^type-?check$/] },
  { id: 'rust-lint', languages: ['Rust'], name: 'Clippy', category: 'tooling', pathPatterns: [/(^|\/)clippy\.toml$/, /(^|\/)\.clippy\.toml$/], manifestPatterns: [/cargo\s+clippy|\[lints\.clippy\]/] },
  { id: 'rust-format', languages: ['Rust'], name: 'rustfmt', category: 'tooling', pathPatterns: [/(^|\/)rustfmt\.toml$/, /(^|\/)\.rustfmt\.toml$/], manifestPatterns: [/cargo\s+fmt/] },
  { id: 'go-lint', languages: ['Go'], name: 'golangci-lint', category: 'tooling', pathPatterns: [/(^|\/)\.golangci\.(?:yml|yaml)$/], manifestPatterns: [/golangci-lint/] },
  { id: 'go-format', languages: ['Go'], name: 'gofmt', category: 'tooling', pathPatterns: [/(^|\/)\.gofmt\.cfg$/], manifestPatterns: [/gofmt\s+-w|gofmt\s+-d/] },
  { id: 'go-vet', languages: ['Go'], name: 'go vet', category: 'correctness', manifestPatterns: [/go\s+vet/] },
  { id: 'jvm-lint', languages: ['Java', 'Kotlin'], name: 'Checkstyle / Detekt / Ktlint', category: 'tooling', pathPatterns: [/(^|\/)(checkstyle\.xml|detekt\.yml|\.editorconfig)$/], manifestPatterns: [/checkstyle|detekt|ktlint|spotbugs|pmd/] },
  { id: 'jvm-format', languages: ['Java', 'Kotlin'], name: 'Spotless formatting', category: 'tooling', manifestPatterns: [/spotless|google-java-format/] },
  { id: 'dotnet-analyzers', languages: ['C#'], name: '.NET analyzers', category: 'tooling', pathPatterns: [/(^|\/)(\.editorconfig|\.globalconfig|directory\.build\.props)$/i], manifestPatterns: [/microsoft\.codeanalysis|\banalyzers\b/] },
  { id: 'php-static', languages: ['PHP'], name: 'PHPStan / Psalm', category: 'correctness', pathPatterns: [/(^|\/)(phpstan\.neon(?:\.dist)?|psalm\.xml)$/], manifestPatterns: [/phpstan|vimeo\/psalm/] },
  { id: 'php-format', languages: ['PHP'], name: 'PHP-CS-Fixer / Pint', category: 'tooling', pathPatterns: [/(^|\/)(\.php-cs-fixer(?:\.dist)?\.php|pint\.json)$/], manifestPatterns: [/php-cs-fixer|laravel\/pint/] },
  { id: 'ruby-lint', languages: ['Ruby'], name: 'RuboCop / StandardRB', category: 'tooling', pathPatterns: [/(^|\/)(\.rubocop\.yml|\.standard\.yml)$/], manifestPatterns: [/rubocop|standardrb/] },
  { id: 'swift-lint', languages: ['Swift'], name: 'SwiftLint', category: 'tooling', pathPatterns: [/(^|\/)(\.swiftlint\.yml|\.swiftlint\.yaml)$/], manifestPatterns: [/swiftlint/] },
  { id: 'dart-analysis', languages: ['Dart'], name: 'Dart analysis options', category: 'correctness', pathPatterns: [/(^|\/)analysis_options\.yaml$/], manifestPatterns: [/\banalyzer\s*:/] },
  { id: 'cpp-lint', languages: ['C', 'C/C++', 'C++'], name: 'clang-tidy', category: 'tooling', pathPatterns: [/(^|\/)(\.clang-tidy|_clang-tidy)$/], manifestPatterns: [/clang-tidy/] },
  { id: 'cpp-format', languages: ['C', 'C/C++', 'C++'], name: 'clang-format', category: 'tooling', pathPatterns: [/(^|\/)\.clang-format$/], manifestPatterns: [/clang-format/] },
  { id: 'shell-lint', languages: ['Shell'], name: 'ShellCheck', category: 'tooling', pathPatterns: [/(^|\/)\.shellcheckrc$/], manifestPatterns: [/shellcheck/] },
  { id: 'sql-lint', languages: ['SQL'], name: 'SQLFluff', category: 'tooling', pathPatterns: [/(^|\/)\.sqlfluff(?:\.toml)?$/], manifestPatterns: [/sqlfluff/] },
  { id: 'css-lint', languages: ['CSS', 'SCSS'], name: 'Stylelint', category: 'tooling', pathPatterns: [/(^|\/)\.stylelintrc(?:\.[^/]+)?$/, /stylelint\.config\./], manifestPatterns: [/\bstylelint\b/] },
  { id: 'html-lint', languages: ['HTML'], name: 'HTMLHint', category: 'tooling', pathPatterns: [/(^|\/)\.htmlhintrc$/], manifestPatterns: [/\bhtmlhint\b/] },
];
