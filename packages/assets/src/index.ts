/**
 * Central brand assets for Sanarwa.
 * Import marks/logos from here — do not scatter SVG paths across the app.
 *
 * @example
 * import { SanarwaMark, SanarwaWordmark, brandAssets } from '@sanarwa/assets'
 */

export { SanarwaMark } from './logos/mark';
export { SanarwaWordmark } from './logos/wordmark';

/** Public URL paths after assets are copied / linked into `apps/web/public`. */
export const brandAssets = {
  favicon: '/favicon.svg',
  faviconPng: '/favicon-32.png',
  appleTouchIcon: '/apple-touch-icon.png',
  ogImage: '/og.png',
  logoMark: '/brand/mark.svg',
  logoWordmark: '/brand/wordmark.svg',
} as const;

export type BrandAssetKey = keyof typeof brandAssets;
