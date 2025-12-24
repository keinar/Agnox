import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import type { Execution } from '../types';

const fetchExecutions = async (): Promise<Execution[]> => {
    const { data } = await axios.get('http://localhost:3000/executions');
    
    if (!Array.isArray(data)) {
        throw new Error(data?.error || 'Invalid data format received from server');
    }
    
    return data;
};

export const useExecutions = () => {
    const { 
        data: executions = [], 
        isLoading: loading, 
        error,
        refetch 
    } = useQuery({
        queryKey: ['executions'],
        queryFn: fetchExecutions,
        refetchInterval: 5000,
        refetchOnWindowFocus: true,
    });

    // Support legacy error string format
    const errorMessage = error instanceof Error ? error.message : error ? String(error) : null;

    return { 
        executions, 
        loading, 
        error: errorMessage,
        refetch 
    };
};