import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface IOrganizationFeatures {
    testCasesEnabled: boolean;
    testCyclesEnabled: boolean;
}

const DEFAULT_FEATURES: IOrganizationFeatures = {
    testCasesEnabled: true,
    testCyclesEnabled: true,
};

export function useOrganizationFeatures() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    const { data: features, isLoading } = useQuery({
        queryKey: ['organization-features'],
        queryFn: async (): Promise<IOrganizationFeatures> => {
            const res = await axios.get(`${API_URL}/api/organization`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const f = res.data.organization?.features;
            return {
                testCasesEnabled: f?.testCasesEnabled !== false,
                testCyclesEnabled: f?.testCyclesEnabled !== false,
            };
        },
        enabled: !!token,
        staleTime: 5 * 60 * 1000,
    });

    const mutation = useMutation({
        mutationFn: async (updates: Partial<IOrganizationFeatures>) => {
            const res = await axios.patch(
                `${API_URL}/api/organization/features`,
                updates,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organization-features'] });
        },
    });

    return {
        features: features ?? DEFAULT_FEATURES,
        isLoading,
        updateFeatures: mutation.mutateAsync,
        isUpdating: mutation.isPending,
    };
}
