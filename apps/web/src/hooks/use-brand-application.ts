'use client';

import { useBranding } from '@/contexts/branding-context';
import {
  applyBrandingToEmailTemplate,
  generateChartColors,
  generateDashboardCSS,
  validateBrandAccessibility,
  type BrandedEmailTemplate,
  type EmailTemplate
} from '@/lib/utils/brand-application';
import { useCallback, useEffect, useMemo, useState } from 'react';

export function useBrandApplication() {
  const { branding } = useBranding();
  const [appliedCSS, setAppliedCSS] = useState<string>('');

  // Apply branding CSS to the document
  useEffect(() => {
    if (!branding) return;

    const css = generateDashboardCSS(branding);
    setAppliedCSS(css);

    // Apply CSS to document
    let styleElement = document.getElementById('brand-application-styles');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'brand-application-styles';
      document.head.appendChild(styleElement);
    }
    styleElement.textContent = css;

    return () => {
      // Cleanup on unmount
      const element = document.getElementById('brand-application-styles');
      if (element) {
        element.remove();
      }
    };
  }, [branding]);

  // Apply branding to email templates
  const applyToEmailTemplate = useCallback((template: EmailTemplate): BrandedEmailTemplate | null => {
    if (!branding) return null;
    return applyBrandingToEmailTemplate(template, branding);
  }, [branding]);

  // Get chart colors based on branding
  const chartColors = useMemo(() => {
    if (!branding) return [];
    return generateChartColors(branding);
  }, [branding]);

  // Validate accessibility
  const accessibilityReport = useMemo(() => {
    if (!branding) return { isValid: true, issues: [] };
    return validateBrandAccessibility(branding);
  }, [branding]);

  // Get brand-aware component styles
  const getComponentStyles = useCallback((component: 'button' | 'card' | 'input' | 'badge') => {
    if (!branding) return {};

    const baseStyles = {
      fontFamily: branding.typography.fontFamily,
    };

    switch (component) {
      case 'button':
        return {
          ...baseStyles,
          '--button-primary-bg': branding.colors.primary,
          '--button-primary-color': 'white',
          '--button-secondary-bg': branding.colors.secondary,
          '--button-secondary-color': branding.colors.foreground,
        };
      case 'card':
        return {
          ...baseStyles,
          '--card-bg': branding.colors.background,
          '--card-border': branding.colors.border || '#e2e8f0',
          '--card-color': branding.colors.foreground,
        };
      case 'input':
        return {
          ...baseStyles,
          '--input-border': branding.colors.border || '#e2e8f0',
          '--input-focus': branding.colors.primary,
          '--input-bg': branding.colors.background,
        };
      case 'badge':
        return {
          ...baseStyles,
          '--badge-primary-bg': branding.colors.primary,
          '--badge-primary-color': 'white',
          '--badge-secondary-bg': branding.colors.muted || '#f1f5f9',
          '--badge-secondary-color': branding.colors.mutedForeground || '#64748b',
        };
      default:
        return baseStyles;
    }
  }, [branding]);

  // Generate brand package for export
  const generateBrandPackage = useCallback(() => {
    if (!branding) return null;

    return {
      name: branding.name,
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      branding,
      css: appliedCSS,
      chartColors,
      accessibilityReport,
      componentStyles: {
        button: getComponentStyles('button'),
        card: getComponentStyles('card'),
        input: getComponentStyles('input'),
        badge: getComponentStyles('badge'),
      },
    };
  }, [branding, appliedCSS, chartColors, accessibilityReport, getComponentStyles]);

  return {
    branding,
    appliedCSS,
    applyToEmailTemplate,
    chartColors,
    accessibilityReport,
    getComponentStyles,
    generateBrandPackage,
    isReady: !!branding,
  };
}

// Hook for applying branding to specific components
export function useBrandedComponent(componentType: 'button' | 'card' | 'input' | 'badge') {
  const { getComponentStyles, branding } = useBrandApplication();

  const styles = useMemo(() => {
    return getComponentStyles(componentType);
  }, [getComponentStyles, componentType]);

  return {
    styles,
    className: `branded-${componentType}`,
    isReady: !!branding,
  };
}

// Hook for branded email templates
export function useBrandedEmailTemplates() {
  const { applyToEmailTemplate, branding } = useBrandApplication();
  const [templates, setTemplates] = useState<BrandedEmailTemplate[]>([]);

  const addTemplate = useCallback((template: EmailTemplate) => {
    const brandedTemplate = applyToEmailTemplate(template);
    if (brandedTemplate) {
      setTemplates(prev => [...prev, brandedTemplate]);
    }
  }, [applyToEmailTemplate]);

  const removeTemplate = useCallback((templateId: string) => {
    setTemplates(prev => prev.filter(t => t.id !== templateId));
  }, []);

  const updateTemplate = useCallback((templateId: string, updates: Partial<EmailTemplate>) => {
    setTemplates(prev => prev.map(template => {
      if (template.id === templateId) {
        const updatedTemplate = { ...template, ...updates };
        const brandedTemplate = applyToEmailTemplate(updatedTemplate);
        return brandedTemplate || template;
      }
      return template;
    }));
  }, [applyToEmailTemplate]);

  return {
    templates,
    addTemplate,
    removeTemplate,
    updateTemplate,
    isReady: !!branding,
  };
}