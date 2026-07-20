import { registerAs } from '@nestjs/config';

export default registerAs('logging', () => ({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT || 'json',
  
  // File logging
  file: {
    enabled: process.env.LOG_FILE_ENABLED === 'true',
    path: process.env.LOG_FILE_PATH || './logs/app.log',
    maxSize: process.env.LOG_FILE_MAX_SIZE || '10m',
    maxFiles: parseInt(process.env.LOG_FILE_MAX_FILES || '5', 10),
  },
  
  // Database logging
  database: {
    enabled: process.env.DATABASE_LOGGING === 'true',
    logQueries: process.env.DATABASE_LOG_QUERIES === 'true',
    logMigrations: process.env.DATABASE_LOG_MIGRATIONS !== 'false', // Default true
    logErrors: process.env.DATABASE_LOG_ERRORS !== 'false', // Default true
  },
  
  // Correlation ID
  correlationId: {
    header: process.env.LOG_CORRELATION_ID_HEADER || 'x-correlation-id',
  },
  
  // Console logging
  console: {
    enabled: process.env.LOG_CONSOLE_ENABLED !== 'false', // Default true
    colorize: process.env.NODE_ENV === 'development',
    timestamp: true,
  },
  
  // External logging services
  external: {
    loki: {
      enabled: process.env.LOKI_ENABLED === 'true',
      url: process.env.LOKI_URL,
      pushUrl: process.env.LOKI_PUSH_URL,
    },
    elasticsearch: {
      enabled: process.env.ELASTICSEARCH_LOGGING_ENABLED === 'true',
      url: process.env.ELASTICSEARCH_URL,
      index: process.env.ELASTICSEARCH_LOG_INDEX || 'notifi-logs',
    },
  },
  
  // ELK Stack configuration
  elk: {
    elasticsearch: {
      url: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    },
    logstash: {
      host: process.env.LOGSTASH_HOST || 'localhost',
      port: parseInt(process.env.LOGSTASH_PORT || '5044', 10),
    },
    kibana: {
      url: process.env.KIBANA_URL || 'http://localhost:5601',
    },
  },
  
  // Performance logging
  performance: {
    enabled: process.env.PERFORMANCE_LOGGING_ENABLED === 'true',
    slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '1000', 10),
    slowRequestThreshold: parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS || '5000', 10),
  },
}));