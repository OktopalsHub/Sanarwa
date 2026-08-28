export interface BrandingConfig {
  id: string;
  name: string;
  logo: {
    light: string;
    dark: string;
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
  };
  typography: {
    fontFamily: string;
    headingFont?: string;
  };
  customCss?: string;
}
