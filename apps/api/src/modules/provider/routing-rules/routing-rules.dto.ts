import { ArrayMaxSize, IsArray, IsOptional, IsString, Matches } from "class-validator";

export const ROUTING_CHANNELS = ["email", "push", "sms"] as const;
export type RoutingChannel = (typeof ROUTING_CHANNELS)[number];

export class SetRoutingRuleDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: "region must be an uppercase ISO 3166-1 alpha-2 code" })
  region?: string;

  @IsString()
  primary!: string;

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  fallback!: string[];
}

export class RoutingRuleScopeDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: "region must be an uppercase ISO 3166-1 alpha-2 code" })
  region?: string;
}

export interface RoutingRuleEntry {
  channel: RoutingChannel;
  region: string;
  primary: string;
  fallback: string[];
}
