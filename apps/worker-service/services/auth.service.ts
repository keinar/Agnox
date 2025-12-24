import { ApiClient } from '../helpers/apiClient';
import { config } from '../config/env';

export interface LoginResponse {
    token: string;
    user: {
        _id: string;
        name: string;
        email: string;
    };
}

export class AuthService {
    constructor(private api: ApiClient) {}

    /**
     * Authenticates a user and returns the token data.
     */
    async login(email: string = config.ADMIN_USER, password: string = config.ADMIN_PASS): Promise<LoginResponse> {
        return await this.api.post<LoginResponse>('/api/users/login', {
            email,
            password
        }, 200); 
    }
}