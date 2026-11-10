import { RequestMethod } from "@nestjs/common";

export const API_PREFIX = "api/v1";

export const UNVERSIONED_PATHS: Array<{ path: string; method: RequestMethod }> = [
  { path: "/", method: RequestMethod.GET },
  { path: "/metrics", method: RequestMethod.GET },
  { path: "/docs", method: RequestMethod.GET },
  { path: "/mcp", method: RequestMethod.ALL },
];
