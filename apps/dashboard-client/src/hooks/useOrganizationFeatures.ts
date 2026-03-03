import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface IOrganizationFeatures {
    testCasesEnabled: boolean;
    testCyclesEnabled: boolean;
}

export interface IAiFeatureFlags {
    rootCauseAnalysis:  boolean;
    autoBugGeneration:  boolean;
    flakinessDetective: boolean;
    testOptimizer:      boolean;
    prRouting:          boolean;
    qualityChatbot:     boolean;
}

type FeatureUpdatePayload =
    Partial<IOrganizationFeatures> &
    { aiFeatures?: Partial<IAiFeatureFlags> };

const DEFAULT_FEATURES: IOrganizationFeatures = {
    testCasesEnabled: true,
    testCyclesEnabled: true,
};

const DEFAULT_AI_FEATURES: IAiFeatureFlags = {
    rootCauseAnalysis:  false,
    autoBugGeneration:  false,
    flakinessDetective: false,
    testOptimizer:      false,
    prRouting:          false,
    qualityChatbot:     false,
};

export function useOrganizationFeatures() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['organization-features'],
        queryFn: async (): Promise<{ features: IOrganizationFeatures; aiFeatures: IAiFeatureFlags }> => {
            const res = await axios.get(`${API_URL}/api/organization`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const f  = res.data.organization?.features;
            const af = res.data.organization?.aiFeatures;
            return {
                features: {
                    testCasesEnabled:  f?.testCasesEnabled  !== false,
                    testCyclesEnabled: f?.testCyclesEnabled !== false,
                },
                aiFeatures: {
                    rootCauseAnalysis:  af?.rootCauseAnalysis  ?? false,
                    autoBugGeneration:  af?.autoBugGeneration  ?? false,
                    flakinessDetective: af?.flakinessDetective ?? false,
                    testOptimizer:      af?.testOptimizer      ?? false,
                    prRouting:          af?.prRouting          ?? false,
                    qualityChatbot:     af?.qualityChatbot     ?? false,
                },
            };
        },
        enabled: !!token,
        staleTime: 5 * 60 * 1000,
    });

    const mutation = useMutation({
        mutationFn: async (updates: FeatureUpdatePayload) => {
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
        features:      data?.features   ?? DEFAULT_FEATURES,
        aiFeatures:    data?.aiFeatures  ?? DEFAULT_AI_FEATURES,
        isLoading,
        updateFeatures: mutation.mutateAsync,
        isUpdating:    mutation.isPending,
    };
}
