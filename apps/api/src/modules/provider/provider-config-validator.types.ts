export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ProviderConfigSchema {
  required: string[];
  optional: string[];
  validation: Record<string, (value: any) => boolean>;
  description: Record<string, string>;
}
