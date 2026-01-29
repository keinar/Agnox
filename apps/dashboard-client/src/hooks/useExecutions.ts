import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import type { Execution } from '../types';

const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL = isProduction
    ? import.meta.env.VITE_API_URL
    : 'http://localhost:3000';

export const useExecutions = () => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    const fetchExecutions = async (): Promise<Execution[]> => {
        const { data } = await axios.get(`${API_URL}/api/executions`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        // Backend now returns { success: true, data: [...] }
        if (data.success && Array.isArray(data.data)) {
            return data.data;
        }

        // Fallback for old format
        if (Array.isArray(data)) {
            return data;
        }

        throw new Error(data?.error || 'Invalid data format received from server');
    };

    const {
        data: executions = [],
        isLoading: loading,
        error
    } = useQuery({
        queryKey: ['executions', token],
        queryFn: fetchExecutions,
        enabled: !!token, // Only fetch when token exists
    });

    useEffect(() => {
        if (!token) return; // Don't connect Socket.io without token

        const socket = io(API_URL, {
            auth: {
                token // Send JWT token for authentication
            }
        });

        socket.on('execution-updated', (updatedTask: Partial<Execution>) => {
            console.log('Real-time update received:', updatedTask);

            queryClient.setQueryData(['executions'], (oldData: Execution[] | undefined) => {
                if (!oldData) return [updatedTask as Execution];

                const index = oldData.findIndex(ex => ex.taskId === updatedTask.taskId);

                if (index !== -1) {
                    const newData = [...oldData];
                    newData[index] = { ...newData[index], ...updatedTask };
                    return newData;
                } else {
                    return [updatedTask as Execution, ...oldData];
                }
            });
        });

        // Real-time log streaming listener
        socket.on('execution-log', (data: { taskId: string; log: string }) => {
            queryClient.setQueryData(['executions'], (oldData: Execution[] | undefined) => {
                if (!oldData) return [];

                return oldData.map(exec => {
                    if (exec.taskId === data.taskId) {
                        return {
                            ...exec,
                            // Append the new log chunk to the existing output
                            output: (exec.output || '') + data.log
                        };
                    }
                    return exec;
                });
            });
        });

        return () => {
            socket.disconnect();
        };
    }, [queryClient, token]);

    const errorMessage = error instanceof Error ? error.message : error ? String(error) : null;

    const setExecutionsManual = (updater: (old: Execution[]) => Execution[]) => {
        queryClient.setQueryData(['executions'], updater);
    };

    return {
        executions,
        loading,
        error: errorMessage,
        setExecutions: setExecutionsManual
    };
};