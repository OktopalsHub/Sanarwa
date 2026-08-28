import type { DeadLetterJobData, SystemAlertPayload } from "./dead-letter.types";

export function generateAlertEmailHtml(alert: SystemAlertPayload): string {
  const severityColor =
    {
      low: "#28a745",
      medium: "#ffc107",
      high: "#fd7e14",
      critical: "#dc3545",
    }[alert.severity] || "#6c757d";

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>System Alert</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${severityColor}; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; border: 1px solid #ddd; }
        .severity { background: ${severityColor}; color: white; padding: 5px 10px; border-radius: 3px; }
        .metadata { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>🚨 System Alert</h1></div>
        <div class="content">
            <h2>${alert.title}</h2>
            <p><strong>Severity:</strong> <span class="severity">${alert.severity.toUpperCase()}</span></p>
            <p><strong>Type:</strong> ${alert.type}</p>
            <p><strong>Tenant:</strong> ${alert.tenantId}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <h3>Message:</h3>
            <p>${alert.message}</p>
            ${
              alert.metadata
                ? `<div class="metadata"><h4>Additional Details:</h4><pre>${JSON.stringify(alert.metadata, null, 2)}</pre></div>`
                : ""
            }
            <p><em>This is an automated system alert. Please investigate and take appropriate action.</em></p>
        </div>
    </div>
</body>
</html>`;
}

export function generateAlertEmailText(alert: SystemAlertPayload): string {
  return `
SYSTEM ALERT

Title: ${alert.title}
Severity: ${alert.severity.toUpperCase()}
Type: ${alert.type}
Tenant: ${alert.tenantId}
Time: ${new Date().toLocaleString()}

Message:
${alert.message}

${alert.metadata ? `Additional Details:\n${JSON.stringify(alert.metadata, null, 2)}\n` : ""}
This is an automated system alert. Please investigate and take appropriate action.
  `.trim();
}

export function generateDeadLetterEmailHtml(data: DeadLetterJobData): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Dead Letter Queue Alert</title></head>
<body style="font-family: Arial, sans-serif;">
    <h1>💀 Dead Letter Queue Alert</h1>
    <h2>Failed ${data.originalType}: ${data.originalId}</h2>
    <p><strong>Tenant:</strong> ${data.tenantId}</p>
    <p><strong>Retry Count:</strong> ${data.retryCount}</p>
    <p><strong>Failure Reason:</strong> ${data.failureReason}</p>
    <p>This ${data.originalType} requires manual review.</p>
</body>
</html>`;
}

export function generateDeadLetterEmailText(data: DeadLetterJobData): string {
  return `
DEAD LETTER QUEUE ALERT

Failed ${data.originalType}: ${data.originalId}
Tenant: ${data.tenantId}
Retry Count: ${data.retryCount}
Failed At: ${data.failedAt}
Failure Reason: ${data.failureReason}
  `.trim();
}

export function getSlackColorBySeverity(severity: string): string {
  const colors: Record<string, string> = {
    low: "#36a64f",
    medium: "#ff9500",
    high: "#ff6b35",
    critical: "#e01e5a",
  };
  return colors[severity] || "#808080";
}

export function getAlertChannels(severity: string): string[] {
  switch (severity) {
    case "critical":
      return ["email", "sms", "slack"];
    case "high":
      return ["email", "slack"];
    case "medium":
      return ["email"];
    case "low":
      return ["slack"];
    default:
      return ["email"];
  }
}
