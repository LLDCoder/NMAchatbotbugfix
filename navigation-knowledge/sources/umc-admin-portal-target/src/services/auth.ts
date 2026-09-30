
import { authStorage } from '@/storage/authStorage';
import { TIME } from '@/config/constants';

class AuthService{
    getToken(): string | null {
        return authStorage.getToken() || null;
    }
    isAuthenticated(): boolean {
        const token = this.getToken();
        if (!token) return false;

        return authStorage.isTokenValid(TIME.TOKEN_REFRESH_AHEAD);
    }
}


export const authService = new AuthService(); 
