export interface TemplateInterface {
  id: string;
  name?: string;
}

export type TemplateVariableType = "string" | "number" | "boolean" | "date" | "object";

export interface TemplateVariableValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
}

export interface TemplateVariable {
  name: string;
  type: TemplateVariableType;
  required: boolean;
  defaultValue?: string | number | boolean;
  validation?: TemplateVariableValidation;
}
