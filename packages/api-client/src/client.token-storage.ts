import { TokenStorage } from "./client.types";

export class LocalStorageTokenStorage implements TokenStorage {
  private readonly ACCESS_TOKEN_KEY = "sanarwa_access_token";
  private readonly REFRESH_TOKEN_KEY = "sanarwa_refresh_token";

  getAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  setAccessToken(token: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(this.ACCESS_TOKEN_KEY, token);
  }

  getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  setRefreshToken(token: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
  }

  clearTokens(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }
}
