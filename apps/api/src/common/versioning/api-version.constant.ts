/**
 * API Versioning Constants
 * Follows semantic versioning for API routes
 */

export const API_VERSION = {
  V1: 'v1',
  V2: 'v2', // Future version
} as const;

export const API_VERSION_PREFIX = `/${API_VERSION.V1}`;

/**
 * Route versioning helper
 * Usage: versionedRoute('tenants/:tenantId/devices')
 * Output: 'tenants/:tenantId/devices'
 */
export function versionedRoute(route: string): string {
  return `${API_VERSION.V1}/${route}`;
}
