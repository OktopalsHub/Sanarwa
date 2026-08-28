export enum MetricType {
  DELIVERY = "delivery",
  ENGAGEMENT = "engagement",
  PERFORMANCE = "performance",
  USAGE = "usage",
  ERROR = "error",
}

export enum TimeRange {
  LAST_HOUR = "last_hour",
  LAST_24_HOURS = "last_24_hours",
  LAST_7_DAYS = "last_7_days",
  LAST_30_DAYS = "last_30_days",
  LAST_90_DAYS = "last_90_days",
  CUSTOM = "custom",
}

export enum AggregationType {
  SUM = "sum",
  AVERAGE = "average",
  COUNT = "count",
  RATE = "rate",
  PERCENTAGE = "percentage",
}

export enum ExportFormat {
  CSV = "csv",
  JSON = "json",
  XLSX = "xlsx",
  PDF = "pdf",
}

