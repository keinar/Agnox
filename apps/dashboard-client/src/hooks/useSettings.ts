/**
 * Settings API Hooks
 *
 * Custom hooks for organization, users, invitations, and usage API calls.
 * These hooks are currently implemented directly in the components using axios.
 * This file provides a centralized interface for future refactoring.
 *
 * Note: The components (OrganizationTab, MembersTab, etc.) currently make
 * direct API calls. This file is a placeholder for future refactoring to
 * consolidate API logic into reusable hooks.
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  limits: {
    maxProjects: number;
    maxTestRuns: number;
    maxUsers: number;
    maxConcurrentRuns: number;
  };
  userCount: number;
  userLimit: number;
  aiAnalysisEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  lastLoginAt?: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  invitedByName: string;
  expiresAt: string;
  status: string;
  createdAt: string;
}

interface UsageData {
  currentPeriod: {
    startDate: string;
    endDate: string;
  };
  testRuns: {
    used: number;
    limit: number;
    percentUsed: number;
  };
  users: {
    active: number;
    limit: number;
  };
  storage: {
    usedBytes: number;
    limitBytes: number;
  };
}

/**
 * Hook for organization data and operations
 *
 * @returns Organization data, loading state, and update function
 */
export function useOrganization() {
  const { token } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganization = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/organization`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setOrganization(response.data.organization);
      }
    } catch (err: any) {
      console.error('Failed to fetch organization:', err);
      setError(err.response?.data?.message || 'Failed to fetch organization');
    } finally {
      setLoading(false);
    }
  };

  const updateOrganization = async (updates: Partial<Pick<Organization, 'name' | 'aiAnalysisEnabled'>>) => {
    try {
      const response = await axios.patch(
        `${API_URL}/api/organization`,
        updates,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setOrganization((prev) => (prev ? { ...prev, ...updates } : null));
        return { success: true };
      }
    } catch (err: any) {
      console.error('Failed to update organization:', err);
      return {
        success: false,
        error: err.response?.data?.message || 'Failed to update organization',
      };
    }
  };

  useEffect(() => {
    fetchOrganization();
  }, []);

  return { organization, loading, error, updateOrganization, refetch: fetchOrganization };
}

/**
 * Hook for users list and operations
 *
 * @returns Users list, loading state, and CRUD functions
 */
export function useUsers() {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setUsers(response.data.users);
      }
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
      setError(err.response?.data?.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, role: string) => {
    try {
      const response = await axios.patch(
        `${API_URL}/api/users/${userId}/role`,
        { role },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role } : u))
        );
        return { success: true };
      }
    } catch (err: any) {
      console.error('Failed to update user role:', err);
      return {
        success: false,
        error: err.response?.data?.message || 'Failed to update user role',
      };
    }
  };

  const removeUser = async (userId: string) => {
    try {
      const response = await axios.delete(`${API_URL}/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        return { success: true };
      }
    } catch (err: any) {
      console.error('Failed to remove user:', err);
      return {
        success: false,
        error: err.response?.data?.message || 'Failed to remove user',
      };
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return { users, loading, error, updateUserRole, removeUser, refetch: fetchUsers };
}

/**
 * Hook for invitations list and operations
 *
 * @returns Invitations list, loading state, and CRUD functions
 */
export function useInvitations() {
  const { token } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitations = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/invitations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setInvitations(response.data.invitations);
      }
    } catch (err: any) {
      console.error('Failed to fetch invitations:', err);
      setError(err.response?.data?.message || 'Failed to fetch invitations');
    } finally {
      setLoading(false);
    }
  };

  const sendInvitation = async (email: string, role: string) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/invitations`,
        { email, role },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        await fetchInvitations(); // Refresh list
        return { success: true };
      }
    } catch (err: any) {
      console.error('Failed to send invitation:', err);
      return {
        success: false,
        error: err.response?.data?.message || 'Failed to send invitation',
      };
    }
  };

  const revokeInvitation = async (invitationId: string) => {
    try {
      const response = await axios.delete(`${API_URL}/api/invitations/${invitationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
        return { success: true };
      }
    } catch (err: any) {
      console.error('Failed to revoke invitation:', err);
      return {
        success: false,
        error: err.response?.data?.message || 'Failed to revoke invitation',
      };
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, []);

  return { invitations, loading, error, sendInvitation, revokeInvitation, refetch: fetchInvitations };
}

/**
 * Hook for usage statistics
 *
 * @returns Usage data and loading state
 */
export function useUsage() {
  const { token } = useAuth();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/organization/usage`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setUsage(response.data.usage);
      }
    } catch (err: any) {
      console.error('Failed to fetch usage:', err);
      setError(err.response?.data?.message || 'Failed to fetch usage');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, []);

  return { usage, loading, error, refetch: fetchUsage };
}
