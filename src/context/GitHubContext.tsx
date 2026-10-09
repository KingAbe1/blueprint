import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { GitHubRepositoryStatus } from '../types/codebase';
import { fetchGitHubRepositoryStatus, parseGitHubRemote } from '../services/githubService';

interface GitHubContextValue {
  status: GitHubRepositoryStatus | null;
  connectedRemote: string | null;
  isConnectedFor: (remote?: string, projectId?: string) => boolean;
  isLoading: boolean;
  error: string | null;
  connect: (remote: string, token: string, projectId?: string) => Promise<void>;
  refresh: () => Promise<void>;
  disconnect: () => void;
}

const GitHubContext = createContext<GitHubContextValue | undefined>(undefined);
const GITHUB_CONNECTION_STORAGE_KEY = 'blueprint_github_connection';

interface SavedGitHubConnection {
  token: string;
  remote: string;
  projectId: string | null;
  status: GitHubRepositoryStatus;
}

function readSavedConnection(): SavedGitHubConnection | null {
  try {
    const value = localStorage.getItem(GITHUB_CONNECTION_STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<SavedGitHubConnection>;
    if (typeof parsed.token !== 'string' || typeof parsed.remote !== 'string' || !parsed.status || typeof parsed.status.fullName !== 'string') return null;
    return parsed as SavedGitHubConnection;
  } catch {
    return null;
  }
}

function saveConnection(connection: SavedGitHubConnection): boolean {
  try {
    localStorage.setItem(GITHUB_CONNECTION_STORAGE_KEY, JSON.stringify(connection));
    return true;
  } catch {
    return false;
  }
}

export const GitHubProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [savedConnection] = useState(readSavedConnection);
  const [token, setToken] = useState<string | null>(savedConnection?.token || null);
  const [status, setStatus] = useState<GitHubRepositoryStatus | null>(savedConnection?.status || null);
  const [connectedRemote, setConnectedRemote] = useState<string | null>(savedConnection?.remote || null);
  const [connectedProjectId, setConnectedProjectId] = useState<string | null>(savedConnection?.projectId || null);
  const [isLoading, setIsLoading] = useState(Boolean(savedConnection));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!savedConnection) return;
    let cancelled = false;
    fetchGitHubRepositoryStatus(savedConnection.remote, savedConnection.token)
      .then(result => {
        if (cancelled) return;
        setStatus(result);
        saveConnection({ ...savedConnection, status: result });
      })
      .catch(cause => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'Could not refresh the saved GitHub connection.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [savedConnection]);

  const connect = async (remote: string, candidateToken: string, projectId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchGitHubRepositoryStatus(remote, candidateToken.trim());
      setToken(candidateToken.trim());
      setStatus(result);
      setConnectedRemote(remote);
      setConnectedProjectId(projectId || null);
      if (!saveConnection({ token: candidateToken.trim(), remote, projectId: projectId || null, status: result })) {
        setError('Connected to GitHub, but this device could not save the connection. Check local storage settings.');
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not connect to GitHub.';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const refresh = async () => {
    if (!token || !connectedRemote) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchGitHubRepositoryStatus(connectedRemote, token);
      setStatus(result);
      saveConnection({ token, remote: connectedRemote, projectId: connectedProjectId, status: result });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not refresh GitHub status.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = () => {
    setToken(null);
    setStatus(null);
    setConnectedRemote(null);
    setConnectedProjectId(null);
    setError(null);
    try {
      localStorage.removeItem(GITHUB_CONNECTION_STORAGE_KEY);
    } catch {
      // The in-memory connection is still cleared if local storage is unavailable.
    }
  };

  const isConnectedFor = (remote?: string, projectId?: string) => {
    if (!status) return false;
    const remoteRef = remote ? parseGitHubRemote(remote) : null;
    if (remoteRef) return remoteRef.fullName.toLowerCase() === status.fullName.toLowerCase();
    return Boolean(projectId && connectedProjectId === projectId);
  };

  return <GitHubContext.Provider value={{ status, connectedRemote, isConnectedFor, isLoading, error, connect, refresh, disconnect }}>{children}</GitHubContext.Provider>;
};

export function useGitHub() {
  const context = useContext(GitHubContext);
  if (!context) throw new Error('useGitHub must be used inside GitHubProvider.');
  return context;
}
