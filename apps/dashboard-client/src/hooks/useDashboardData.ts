import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';

const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL = isProduction ? import.meta.env.VITE_API_URL || '' : 'http://localhost:3000';

async function fetchTestsStructure(token: string): Promise<string[]> {
  try {
    const response = await fetch(`${API_URL}/api/tests-structure`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const contentType = response.headers.get('content-type');
    if (response.ok && contentType?.includes('application/json')) {
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    }
    return [];
  } catch {
    return [];
  }
}

async function fetchDefaults(token: string): Promise<Record<string, any> | null> {
  try {
    const response = await fetch(`${API_URL}/api/project-settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.success || !data.settings) return null;

    const { settings } = data;

    const envMapping: Record<string, string> = {};
    if (settings.targetUrls?.dev)     envMapping.development = settings.targetUrls.dev;
    if (settings.targetUrls?.staging) envMapping.staging     = settings.targetUrls.staging;
    if (settings.targetUrls?.prod)    envMapping.production  = settings.targetUrls.prod;

    const defaultBaseUrl =
      settings.targetUrls?.prod ||
      settings.targetUrls?.staging ||
      settings.targetUrls?.dev ||
      '';

    return {
      image:    settings.dockerImage        || '',
      baseUrl:  defaultBaseUrl,
      folder:   settings.defaultTestFolder  || 'all',
      envMapping,
    };
  } catch {
    return null;
  }
}

export function useDashboardData() {
  const { token } = useAuth();

  const { data: availableFolders = [] } = useQuery<string[]>({
    queryKey: ['tests-structure', token],
    queryFn:  () => fetchTestsStructure(token!),
    enabled:  !!token,
    staleTime: 5 * 60 * 1000,
  });

  const { data: defaults = null, isLoading } = useQuery<Record<string, any> | null>({
    queryKey: ['project-settings', token],
    queryFn:  () => fetchDefaults(token!),
    enabled:  !!token,
    staleTime: 5 * 60 * 1000,
  });

  return { availableFolders, defaults, loading: isLoading };
}
