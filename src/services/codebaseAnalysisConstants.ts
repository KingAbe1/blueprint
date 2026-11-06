export const MANIFEST_FILES = new Set([
  'package.json', 'cargo.toml', 'pyproject.toml', 'requirements.txt', 'go.mod',
  'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock',
  'gemfile', 'composer.json', 'pubspec.yaml', 'pom.xml', 'build.gradle',
  'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts',
]);

/** Lockfiles read with the larger lockfile size limit. */
export const LOCKFILE_NAMES = new Set(['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock']);

export function normalizedName(path: string) {
  return path.split('/').pop()?.toLowerCase() || '';
}

export const IGNORED_DIRECTORIES = new Set([
  '.git', '.hg', '.svn', '.next', '.nuxt', '.svelte-kit', '.turbo', '.cache',
  '.idea', '.vscode', '.venv', 'venv', '__pycache__', 'node_modules', 'vendor',
  'target', 'dist', 'build', 'coverage', 'out', 'Pods', 'bin', 'obj',
]);
