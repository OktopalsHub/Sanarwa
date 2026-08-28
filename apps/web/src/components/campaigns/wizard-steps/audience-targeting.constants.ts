import { Filter, Send, Target, Users } from "@/lib/icons";
import type { AudienceConfig, AudienceFilter } from "@/lib/types/campaign";

export const AUDIENCE_TYPES = [
  {
    value: "all" as const,
    label: "All Users",
    description: "Send to your entire audience",
    icon: Users,
  },
  {
    value: "segment" as const,
    label: "Saved Segments",
    description: "Use pre-defined audience segments",
    icon: Target,
  },
  {
    value: "custom" as const,
    label: "Custom Filters",
    description: "Create custom audience filters",
    icon: Filter,
  },
];

export const FILTER_FIELDS = [
  { value: "email", label: "Email", type: "text" },
  { value: "name", label: "Name", type: "text" },
  { value: "country", label: "Country", type: "text" },
  { value: "city", label: "City", type: "text" },
  { value: "age", label: "Age", type: "number" },
  { value: "signup_date", label: "Signup Date", type: "date" },
  { value: "last_active", label: "Last Active", type: "date" },
  {
    value: "subscription_status",
    label: "Subscription Status",
    type: "select",
    options: ["active", "inactive", "trial"],
  },
  {
    value: "user_type",
    label: "User Type",
    type: "select",
    options: ["free", "premium", "enterprise"],
  },
];

export const OPERATORS = [
  { value: "equals", label: "Equals", types: ["text", "number", "select"] },
  { value: "not_equals", label: "Not Equals", types: ["text", "number", "select"] },
  { value: "contains", label: "Contains", types: ["text"] },
  { value: "not_contains", label: "Does Not Contain", types: ["text"] },
  { value: "greater_than", label: "Greater Than", types: ["number", "date"] },
  { value: "less_than", label: "Less Than", types: ["number", "date"] },
  { value: "in", label: "In List", types: ["text", "select"] },
  { value: "not_in", label: "Not In List", types: ["text", "select"] },
];

export type AudienceType = AudienceConfig["type"];

export function getAvailableOperators(fieldType: string) {
  return OPERATORS.filter((op) => op.types.includes(fieldType));
}
