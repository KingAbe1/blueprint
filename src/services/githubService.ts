import { GitHubRepositoryStatus } from '../types/codebase';

interface GitHubRepoRef {
  owner: string;
  repo: string;
  fullName: string;
}

export function parseGitHubRemote(remote: string): GitHubRepoRef | null {
  const trimmed = remote.trim().replace(/\.git$/i, '');
  const match = trimmed.match(/^(?:https?:\/\/github\.com\/|ssh:\/\/git@github\.com\/|git@github\.com:)([^/]+)\/([^/]+)$/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2], fullName: `${match[1]}/${match[2]}` };
}

async function githubGet<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('GitHub rejected this token. Check that it is valid and has not expired.');
    if (response.status === 403) throw new Error('GitHub denied access. Check the token permissions and organization approval.');
    if (response.status === 404) throw new Error('GitHub returned 404: repository not found or this token cannot access it.');
    throw new Error(`GitHub request failed (${response.status}). Please try again.`);
  }
  return response.json() as Promise<T>;
}

export async function fetchGitHubRepositoryStatus(remote: string, token: string): Promise<GitHubRepositoryStatus> {
  const ref = parseGitHubRemote(remote);
  if (!ref) throw new Error('This repository remote is not a github.com URL.');

  const apiRoot = `https://api.github.com/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`;
  let repository: { full_name: string; html_url: string; default_branch: string };
  try {
    repository = await githubGet<{ full_name: string; html_url: string; default_branch: string }>(apiRoot, token);
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      throw new Error(`GitHub could not access ${ref.fullName}. Check the repository URL. If it is private, set the token's Resource owner to ${ref.owner} and include ${ref.repo} under Only select repositories. GitHub returns 404 when a token cannot see a private repository.`);
    }
    throw error;
  }
  const warnings: string[] = [];
  const [runsResult, deploymentsResult] = await Promise.allSettled([
    githubGet<{ workflow_runs: Array<{ id: number; name: string; event: string; status: string; conclusion: string | null; updated_at: string; html_url: string; head_branch: string }> }>(`${apiRoot}/actions/runs?per_page=5`, token),
    githubGet<Array<{ id: number; environment: string; created_at: string; statuses_url: string; url: string }>>(`${apiRoot}/deployments?per_page=5`, token),
  ]);

  const runs = runsResult.status === 'fulfilled'
    ? runsResult.value.workflow_runs.map(run => ({
      id: run.id, name: run.name, event: run.event, status: run.status, conclusion: run.conclusion,
      updatedAt: run.updated_at, htmlUrl: run.html_url, branch: run.head_branch,
    }))
    : (warnings.push(runsResult.reason instanceof Error ? runsResult.reason.message : 'Could not read GitHub Actions runs.'), []);

  const deployments = deploymentsResult.status === 'fulfilled'
    ? await Promise.all(deploymentsResult.value.slice(0, 3).map(async deployment => {
      try {
        const statuses = await githubGet<Array<{ state: string; updated_at: string; environment_url?: string; target_url?: string }>>(deployment.statuses_url, token);
        const latest = statuses[0];
        return {
          id: deployment.id,
          environment: deployment.environment,
          state: latest?.state || 'pending',
          updatedAt: latest?.updated_at || deployment.created_at,
          environmentUrl: latest?.environment_url,
          htmlUrl: latest?.target_url || deployment.url,
        };
      } catch {
        return { id: deployment.id, environment: deployment.environment, state: 'status unavailable', updatedAt: deployment.created_at, htmlUrl: deployment.url };
      }
    }))
    : (warnings.push(deploymentsResult.reason instanceof Error ? deploymentsResult.reason.message : 'Could not read GitHub deployments.'), []);

  return {
    fullName: repository.full_name,
    htmlUrl: repository.html_url,
    defaultBranch: repository.default_branch,
    runs,
    deployments,
    warnings,
    fetchedAt: Date.now(),
  };
}
