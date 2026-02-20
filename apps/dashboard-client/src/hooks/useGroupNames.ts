import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const isProduction =
    window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL = isProduction ? import.meta.env.VITE_API_URL : 'http://localhost:3000';

/**
 * Fetches the list of distinct group names for the current organization.
 * Used to populate the group filter combobox in FilterBar.
 * Groups named "__ungrouped__" (server-side synthetic bucket) are excluded.
 */
export function useGroupNames(): string[] {
    const { token } = useAuth();

    const { data } = useQuery<string[]>({
        queryKey: ['group-names', token],
        queryFn: async () => {
            const { data } = await axios.get(
                `${API_URL}/api/executions/grouped?limit=100`,
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (data.success && data.data?.groups) {
                return (data.data.groups as Array<{ groupName: string }>)
                    .map((g) => g.groupName)
                    .filter((n) => n !== '__ungrouped__');
            }
            return [];
        },
        enabled: !!token,
        staleTime: 30_000,
    });

    return data ?? [];
}
