import { type APIRequestContext, type APIResponse } from '@playwright/test';
import * as fs from 'fs';
import { Logger } from './logger';

const AUTH_FILE_PATH = '.auth/auth-state.json';

/**
 * Generic API Client.
 * Responsible for handling HTTP requests, Authentication, and Logging.
 * This client is agnostic of the specific business logic.
 */
export class ApiClient {
    readonly request: APIRequestContext;

    constructor(request: APIRequestContext) {
        this.request = request;
    }

    /**
     * Retrieves the Authorization header from the storage state file.
     */
    private getAuthHeader(): { [key: string]: string } {
        try {
            if (!fs.existsSync(AUTH_FILE_PATH)) {
                return {};
            }

            const authFileContent = fs.readFileSync(AUTH_FILE_PATH, 'utf-8');
            const authData = JSON.parse(authFileContent);
            
            // Navigate Playwright's storage state structure to find the token
            const localStorage = authData.origins[0]?.localStorage;
            if (!localStorage) return {};

            const userItem = localStorage.find((item: any) => item.name === 'user');
            if (!userItem) return {};

            const userInfo = JSON.parse(userItem.value);
            
            if (userInfo.token) {
                return { 'Authorization': `Bearer ${userInfo.token}` };
            }
            return {};
            
        } catch (error) {
            Logger.error(`Failed to parse auth file: ${error}`);
            return {};
        }
    }

    /**
     * Helper to retrieve auth headers statically (useful for teardowns).
     */
    public static readAuthHeaderFromDisk(): { [key: string]: string } {
         return new ApiClient({} as any).getAuthHeader(); 
    }

    // --- Generic HTTP Methods ---

    /**
     * Performs a POST request.
     */
    async post<T>(endpoint: string, data: any, expectedStatus = 201): Promise<T> {
        Logger.info(`API POST Request: ${endpoint}`);
        
        const response = await this.request.post(endpoint, {
            headers: {
                ...this.getAuthHeader(),
                'Content-Type': 'application/json'
            },
            data: data
        });

        if (response.status() !== expectedStatus) {
            await this.logFailure(response, endpoint, 'POST');
        }

        return await response.json() as T;
    }

    /**
     * Performs a GET request.
     */
    async get<T>(endpoint: string, expectedStatus = 200): Promise<T> {
        Logger.info(`API GET Request: ${endpoint}`);

        const response = await this.request.get(endpoint, {
            headers: this.getAuthHeader()
        });

        if (response.status() !== expectedStatus) {
            await this.logFailure(response, endpoint, 'GET');
        }

        return await response.json() as T;
    }

    /**
     * Performs a PUT request.
     */
    async put<T>(endpoint: string, data: any, expectedStatus = 200): Promise<T> {
        Logger.info(`API PUT Request: ${endpoint}`);

        const response = await this.request.put(endpoint, {
            headers: {
                ...this.getAuthHeader(),
                'Content-Type': 'application/json'
            },
            data: data
        });

        if (response.status() !== expectedStatus) {
            await this.logFailure(response, endpoint, 'PUT');
        }

        return await response.json() as T;
    }

    /**
     * Performs a DELETE request.
     */
    async delete(endpoint: string, expectedStatus = 200): Promise<void> {
        Logger.info(`API DELETE Request: ${endpoint}`);
        
        const response = await this.request.delete(endpoint, {
            headers: this.getAuthHeader()
        });

        if (response.status() !== expectedStatus) {
            await this.logFailure(response, endpoint, 'DELETE');
        }
    }

    /**
     * Retrieves the raw APIResponse object (useful for testing headers/status directly).
     */
    async fetchRaw(endpoint: string): Promise<APIResponse> {
        Logger.info(`API RAW Request: ${endpoint}`);
        return this.request.get(endpoint, {
            headers: this.getAuthHeader()
        });
    }

    private async logFailure(response: APIResponse, endpoint: string, method: string) {
        const errorText = await response.text();
        Logger.error(`API ${method} Failed. Status: ${response.status()} | Body: ${errorText}`);
        throw new Error(`API ${method} failed on ${endpoint} with status ${response.status()}`);
    }
}