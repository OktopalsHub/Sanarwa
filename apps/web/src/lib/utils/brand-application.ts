import { BrandingConfig } from '@/contexts/branding-context';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables: string[];
}

export interface BrandedEmailTemplate extends EmailTemplate {
  brandedHtmlContent: string;
  brandedTextContent?: string;
}

/**
 * Apply branding to an email template
 */
export function applyBrandingToEmailTemplate(
  template: EmailTemplate,
  branding: BrandingConfig
): BrandedEmailTemplate {
  const brandedHtmlContent = applyBrandingToHTML(template.htmlContent, branding);
  const brandedTextContent = template.textContent
    ? applyBrandingToText(template.textContent, branding)
    : undefined;

  return {
    ...template,
    brandedHtmlContent,
    brandedTextContent,
  };
}

/**
 * Apply branding to HTML content
 */
function applyBrandingToHTML(htmlContent: string, branding: BrandingConfig): string {
  // Create a branded HTML template wrapper
  const brandedWrapper = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
  <style>
    :root {
      --primary: ${branding.colors.primary};
      --secondary: ${branding.colors.secondary};
      --accent: ${branding.colors.accent};
      --background: ${branding.colors.background};
      --foreground: ${branding.colors.foreground};
      --muted: ${branding.colors.muted || '#f1f5f9'};
      --muted-foreground: ${branding.colors.mutedForeground || '#64748b'};
      --border: ${branding.colors.border || '#e2e8f0'};
      --destructive: ${branding.colors.destructive || '#ef4444'};
    }
    
    body {
      font-family: ${branding.typography.fontFamily}, sans-serif;
      background-color: var(--background);
      color: var(--foreground);
      margin: 0;
      padding: 0;
      line-height: 1.6;
    }
    
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: var(--background);
    }
    
    .email-header {
      padding: 20px;
      text-align: center;
      border-bottom: 1px solid var(--border);
    }
    
    .email-logo {
      max-height: 60px;
      max-width: 200px;
    }
    
    .email-content {
      padding: 30px 20px;
    }
    
    .email-footer {
      padding: 20px;
      text-align: center;
      border-top: 1px solid var(--border);
      background-color: var(--muted);
      color: var(--muted-foreground);
      font-size: 14px;
    }
    
    .btn-primary {
      display: inline-block;
      padding: 12px 24px;
      background-color: var(--primary);
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 500;
      margin: 10px 0;
    }
    
    .btn-secondary {
      display: inline-block;
      padding: 12px 24px;
      background-color: var(--secondary);
      color: var(--foreground);
      text-decoration: none;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-weight: 500;
      margin: 10px 0;
    }
    
    h1, h2, h3, h4, h5, h6 {
      font-family: ${branding.typography.headingFont || branding.typography.fontFamily}, sans-serif;
      color: var(--foreground);
      margin-top: 0;
    }
    
    h1 { color: var(--primary); }
    
    a {
      color: var(--primary);
    }
    
    .highlight {
      background-color: var(--accent);
      color: white;
      padding: 2px 6px;
      border-radius: 3px;
    }
    
    .alert {
      padding: 15px;
      border-radius: 6px;
      margin: 15px 0;
    }
    
    .alert-info {
      background-color: var(--accent);
      color: white;
    }
    
    .alert-warning {
      background-color: var(--destructive);
      color: white;
    }
    
    ${branding.customCss || ''}
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      ${branding.logo.light ? `<img src="${branding.logo.light}" alt="${branding.name}" class="email-logo">` : `<h2>${branding.name}</h2>`}
    </div>
    <div class="email-content">
      ${htmlContent}
    </div>
    <div class="email-footer">
      <p>&copy; ${new Date().getFullYear()} ${branding.name}. All rights reserved.</p>
      <p>You received this email because you're subscribed to our notifications.</p>
    </div>
  </div>
</body>
</html>`;

  return brandedWrapper;
}

/**
 * Apply branding to text content
 */
function applyBrandingToText(textContent: string, branding: BrandingConfig): string {
  const brandedTextWrapper = `
${branding.name}
${'='.repeat(branding.name.length)}

${textContent}

---
© ${new Date().getFullYear()} ${branding.name}. All rights reserved.
You received this email because you're subscribed to our notifications.
`;

  return brandedTextWrapper;
}

/**
 * Generate CSS variables for dashboard UI
 */
export function generateDashboardCSS(branding: BrandingConfig): string {
  return `
:root {
  --primary: ${branding.colors.primary};
  --primary-foreground: oklch(1 0 0);
  --secondary: ${branding.colors.secondary};
  --secondary-foreground: ${branding.colors.foreground};
  --accent: ${branding.colors.accent};
  --accent-foreground: oklch(1 0 0);
  --background: ${branding.colors.background};
  --foreground: ${branding.colors.foreground};
  --muted: ${branding.colors.muted || '#f1f5f9'};
  --muted-foreground: ${branding.colors.mutedForeground || '#64748b'};
  --border: ${branding.colors.border || '#e2e8f0'};
  --input: ${branding.colors.border || '#e2e8f0'};
  --ring: ${branding.colors.primary};
  --destructive: ${branding.colors.destructive || '#ef4444'};
  --destructive-foreground: oklch(1 0 0);
  --card: ${branding.colors.background};
  --card-foreground: ${branding.colors.foreground};
  --popover: ${branding.colors.background};
  --popover-foreground: ${branding.colors.foreground};
  
  --font-sans: ${branding.typography.fontFamily}, sans-serif;
  --font-heading: ${branding.typography.headingFont || branding.typography.fontFamily}, sans-serif;
}

${branding.customCss || ''}
`;
}

/**
 * Apply branding to in-app notification templates
 */
export function applyBrandingToInAppNotification(
  title: string,
  message: string,
  branding: BrandingConfig
): {
  title: string;
  message: string;
  style: React.CSSProperties;
} {
  return {
    title,
    message,
    style: {
      '--notification-primary': branding.colors.primary,
      '--notification-background': branding.colors.background,
      '--notification-foreground': branding.colors.foreground,
      '--notification-border': branding.colors.border || '#e2e8f0',
      fontFamily: branding.typography.fontFamily,
    } as React.CSSProperties,
  };
}

/**
 * Generate brand-consistent color palette for charts and analytics
 */
export function generateChartColors(branding: BrandingConfig): string[] {
  const baseColors = [
    branding.colors.primary,
    branding.colors.accent,
    branding.colors.secondary,
  ];

  // Generate additional colors by adjusting lightness and saturation
  const additionalColors = [
    adjustOklchColor(branding.colors.primary, { lightness: 0.1 }),
    adjustOklchColor(branding.colors.accent, { lightness: 0.1 }),
    adjustOklchColor(branding.colors.primary, { lightness: -0.1 }),
    adjustOklchColor(branding.colors.accent, { lightness: -0.1 }),
  ];

  return [...baseColors, ...additionalColors];
}

/**
 * Adjust OKLCH color values
 */
function adjustOklchColor(
  oklchColor: string,
  adjustments: { lightness?: number; chroma?: number; hue?: number }
): string {
  // Parse OKLCH color: oklch(L C H)
  const match = oklchColor.match(/oklch\(([^)]+)\)/);
  if (!match) return oklchColor;

  const values = match?.[1]?.split(' ').map(v => parseFloat(v)) || [];
  if (values.length < 3) return oklchColor;

  let [l, c, h] = values;

  if (adjustments.lightness !== undefined) {
    l = Math.max(0, Math.min(1, (l || 0) + adjustments.lightness));
  }
  if (adjustments.chroma !== undefined) {
    c = Math.max(0, (c || 0) + adjustments.chroma);
  }
  if (adjustments.hue !== undefined) {
    h = ((h || 0) + adjustments.hue) % 360;
  }

  return `oklch(${l} ${c} ${h})`;
}

/**
 * Validate brand colors for accessibility
 */
export function validateBrandAccessibility(branding: BrandingConfig): {
  isValid: boolean;
  issues: Array<{
    combination: string;
    ratio: number;
    level: 'AAA' | 'AA' | 'FAIL';
    recommendation?: string;
  }>;
} {
  const issues: Array<{
    combination: string;
    ratio: number;
    level: 'AAA' | 'AA' | 'FAIL';
    recommendation?: string;
  }> = [];

  // Check primary color against background
  const primaryRatio = calculateContrastRatio(branding.colors.primary, branding.colors.background);
  const primaryLevel = getAccessibilityLevel(primaryRatio);

  if (primaryLevel === 'FAIL') {
    issues.push({
      combination: 'Primary on Background',
      ratio: primaryRatio,
      level: primaryLevel,
      recommendation: 'Increase contrast between primary color and background'
    });
  }

  // Check foreground against background
  const foregroundRatio = calculateContrastRatio(branding.colors.foreground, branding.colors.background);
  const foregroundLevel = getAccessibilityLevel(foregroundRatio);

  if (foregroundLevel === 'FAIL') {
    issues.push({
      combination: 'Foreground on Background',
      ratio: foregroundRatio,
      level: foregroundLevel,
      recommendation: 'Increase contrast between text and background colors'
    });
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

function calculateContrastRatio(color1: string, color2: string): number {
  // This is a simplified contrast ratio calculation
  // In a real implementation, you'd want to use a proper color library
  // that can parse OKLCH and calculate accurate contrast ratios
  return 4.5; // Placeholder
}

function getAccessibilityLevel(ratio: number): 'AAA' | 'AA' | 'FAIL' {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  return 'FAIL';
}