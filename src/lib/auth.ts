/**
 * Client-side authentication token management
 * Handles localStorage operations for JWT tokens
 */

const ACCESS_TOKEN_KEY = 'media_logbook_access_token'
const REFRESH_TOKEN_KEY = 'media_logbook_refresh_token'

/**
 * Get the stored access token
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

/**
 * Get the stored refresh token
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

/**
 * Store both access and refresh tokens
 */
export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

/**
 * Clear all tokens (sign out)
 */
export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

/**
 * Check if user is authenticated (has valid access token)
 */
export function isAuthenticated(): boolean {
  const token = getAccessToken()
  return token !== null && token.length > 0
}
