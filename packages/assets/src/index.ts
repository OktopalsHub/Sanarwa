export { SanarwaMark } from "./logos/mark";
export { SanarwaWordmark } from "./logos/wordmark";

export const brandAssets = {
  favicon: "/favicon.svg",
  faviconPng: "/favicon-32.png",
  appleTouchIcon: "/apple-touch-icon.png",
  ogImage: "/og.png",
  logoMark: "/brand/mark.svg",
  logoWordmark: "/brand/wordmark.svg",
} as const;

export type BrandAssetKey = keyof typeof brandAssets;
