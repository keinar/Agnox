import { useState, useEffect } from 'react';
import axios from 'axios';
import type { Execution } from '../types';

export const useExecutions = () => {
    const [executions, setExecutions] = useState<Execution[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchExecutions = async () => {
        try {
            const response = await axios.get('http://localhost:3000/executions');
            
            console.log('Server Response Data:', response.data);

            if (Array.isArray(response.data)) {
                setExecutions(response.data);
                setError(null);
            } else {
                console.error('Data is not an array!', response.data);
                
                const errorMsg = response.data?.error || 'Invalid data format received from server';
                setError(errorMsg);
                
                setExecutions([]); 
            }

        } catch (err: any) {
            console.error('Failed to fetch executions', err);
            setError(err.response?.data?.error || err.message || 'Failed to load data');
            setExecutions([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExecutions();
        const interval = setInterval(fetchExecutions, 5000); 
        return () => clearInterval(interval);
    }, []);

    return { executions, loading, error };
};