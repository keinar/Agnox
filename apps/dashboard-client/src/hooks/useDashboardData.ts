import { useState, useEffect } from 'react';

const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL = isProduction
  ? import.meta.env.VITE_API_URL || ''
  : 'http://localhost:3000';

interface DashboardData {
  availableFolders: string[];
  defaults: any;
  loading: boolean;
}

async function fetchTestsStructure(token: string): Promise<string[]> {
  try {
    const response = await fetch(`${API_URL}/api/tests-structure`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const contentType = response.headers.get('content-type');
    if (response.ok && contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    }
    return [];
  } catch (error) {
    console.warn('Using decoupled mode (local folders not found)');
    return [];
  }
}

async function fetchDefaults(token: string): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/config/defaults`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return await response.json();
  } catch (error) {
    console.warn('Using hardcoded defaults');
    return null;
  }
}

export function useDashboardData(token: string | null): DashboardData {
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [defaults, setDefaults] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);

    Promise.all([
      fetchTestsStructure(token),
      fetchDefaults(token)
    ]).then(([folders, defaultsData]) => {
      setAvailableFolders(folders);
      setDefaults(defaultsData);
      setLoading(false);
    }).catch((error) => {
      console.error('Failed to fetch dashboard data:', error);
      setLoading(false);
    });
  }, [token]);

  return { availableFolders, defaults, loading };
}
