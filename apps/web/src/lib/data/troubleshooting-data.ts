export const troubleshootingItems = [
  {
    id: "auth-invalid-api-key",
    title: "Invalid API Key Error",
    category: "authentication" as const,
    severity: "high" as const,
    description: "Getting authentication errors when making API calls",
    symptoms: [
      "Receiving 401 Unauthorized responses",
      'Error message: "Invalid API key"',
      "All API requests failing with authentication error",
    ],
    causes: [
      "API key is incorrect or expired",
      "API key is not properly set in environment variables",
      "Using wrong API key for the environment (dev/staging/prod)",
      "API key has been revoked or deactivated",
    ],
    solutions: [
      {
        title: "Verify API Key Configuration",
        description: "Check that your API key is correctly configured and valid.",
        steps: [
          "Log in to your Notifi dashboard",
          "Navigate to Settings > API Keys",
          "Verify the API key matches what you're using in your code",
          "Check the key's status and permissions",
          "Regenerate the key if necessary",
        ],
        code: `// Check your API key configuration
const client = new NotifiClient({
  apiKey: process.env.NOTIFI_API_KEY, // Make sure this is set
  baseUrl: 'https://api.notifi.com'
});

// Test the connection
try {
  const result = await client.auth.verify();
  console.log('API key is valid:', result);
} catch (error) {
  console.error('API key validation failed:', error);
}`,
        language: "javascript",
      },
      {
        title: "Environment Variable Setup",
        description: "Ensure your environment variables are properly configured.",
        steps: [
          "Create a .env file in your project root",
          "Add your API key: NOTIFI_API_KEY=your_actual_key_here",
          "Restart your application to load the new environment variables",
          "Verify the variable is loaded correctly",
        ],
        code: `# .env file
NOTIFI_API_KEY=nk_live_1234567890abcdef
NOTIFI_BASE_URL=https://api.notifi.com

# Verify in your code
console.log('API Key loaded:', process.env.NOTIFI_API_KEY ? 'Yes' : 'No');`,
        language: "bash",
      },
    ],
    relatedLinks: [
      {
        title: "API Authentication Guide",
        url: "/docs/authentication",
      },
      {
        title: "Environment Setup",
        url: "/docs/getting-started/setup",
      },
    ],
    tags: ["api-key", "authentication", "401", "unauthorized"],
  },
  {
    id: "email-delivery-failed",
    title: "Email Delivery Failures",
    category: "api" as const,
    severity: "medium" as const,
    description: "Emails are not being delivered to recipients",
    symptoms: [
      "API returns success but emails are not received",
      "High bounce rates in analytics",
      "Emails going to spam folder",
      'Delivery status shows "failed" or "bounced"',
    ],
    causes: [
      "Invalid or non-existent email addresses",
      "Email provider blocking messages",
      "Domain reputation issues",
      "Missing SPF/DKIM/DMARC records",
      "Content triggering spam filters",
    ],
    solutions: [
      {
        title: "Validate Email Addresses",
        description: "Ensure you're sending to valid, active email addresses.",
        code: `// Email validation before sending
function isValidEmail(email) {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}

async function sendEmailSafely(to, subject, content) {
  if (!isValidEmail(to)) {
    throw new Error('Invalid email address format');
  }
  
  try {
    const result = await client.email.send({
      to,
      subject,
      content,
      // Enable bounce tracking
      trackBounces: true
    });
    
    return result;
  } catch (error) {
    console.error('Email send failed:', error);
    throw error;
  }
}`,
        language: "javascript",
      },
      {
        title: "Check Domain Authentication",
        description: "Verify your domain has proper email authentication records.",
        steps: [
          'Add SPF record to your DNS: "v=spf1 include:_spf.notifi.com ~all"',
          "Configure DKIM signing in your Notifi dashboard",
          "Set up DMARC policy for your domain",
          "Verify records using DNS lookup tools",
        ],
      },
      {
        title: "Monitor Delivery Analytics",
        description: "Use Notifi's analytics to track delivery performance.",
        code: `// Check delivery status
const deliveryStats = await client.analytics.getDeliveryStats({
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  channel: 'email'
});

console.log('Delivery rate:', deliveryStats.deliveryRate);
console.log('Bounce rate:', deliveryStats.bounceRate);
console.log('Spam rate:', deliveryStats.spamRate);`,
        language: "javascript",
      },
    ],
    relatedLinks: [
      {
        title: "Email Deliverability Guide",
        url: "/docs/channels/email/deliverability",
      },
      {
        title: "Domain Authentication Setup",
        url: "/docs/channels/email/authentication",
      },
    ],
    tags: ["email", "delivery", "bounce", "spam", "deliverability"],
  },
  {
    id: "sdk-installation-issues",
    title: "SDK Installation Problems",
    category: "sdk" as const,
    severity: "medium" as const,
    description: "Issues installing or importing the Notifi SDK",
    symptoms: [
      "npm install fails with dependency errors",
      "Import statements not working",
      "TypeScript compilation errors",
      "Module not found errors",
    ],
    causes: [
      "Node.js version incompatibility",
      "Package manager cache issues",
      "Conflicting dependencies",
      "Incorrect import syntax",
      "Missing peer dependencies",
    ],
    solutions: [
      {
        title: "Clear Package Manager Cache",
        description: "Clear your package manager cache and reinstall.",
        code: `# For npm
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# For yarn
yarn cache clean
rm -rf node_modules yarn.lock
yarn install

# For pnpm
pnpm store prune
rm -rf node_modules pnpm-lock.yaml
pnpm install`,
        language: "bash",
      },
      {
        title: "Check Node.js Version",
        description: "Ensure you're using a supported Node.js version.",
        steps: [
          "Check your Node.js version: node --version",
          "Notifi SDK requires Node.js 16 or higher",
          "Update Node.js if necessary using nvm or direct download",
          "Reinstall dependencies after Node.js update",
        ],
        code: `# Check Node.js version
node --version

# Install latest LTS version with nvm
nvm install --lts
nvm use --lts`,
        language: "bash",
      },
      {
        title: "Correct Import Syntax",
        description: "Use the correct import syntax for your environment.",
        code: `// ES6 Modules (recommended)
import { NotifiClient } from '@notifi/sdk';

// CommonJS
const { NotifiClient } = require('@notifi/sdk');

// TypeScript with types
import { NotifiClient, EmailOptions } from '@notifi/sdk';

// Default import (if using default export)
import NotifiClient from '@notifi/sdk';`,
        language: "javascript",
      },
    ],
    relatedLinks: [
      {
        title: "Installation Guide",
        url: "/docs/getting-started/installation",
      },
      {
        title: "TypeScript Setup",
        url: "/docs/sdks/typescript",
      },
    ],
    tags: ["sdk", "installation", "npm", "import", "dependencies"],
  },
  {
    id: "rate-limit-exceeded",
    title: "Rate Limit Exceeded",
    category: "api" as const,
    severity: "medium" as const,
    description: "Getting rate limit errors when making API requests",
    symptoms: [
      "Receiving 429 Too Many Requests responses",
      'Error message: "Rate limit exceeded"',
      "API requests being throttled or rejected",
    ],
    causes: [
      "Sending too many requests in a short time period",
      "Not implementing proper rate limiting in client code",
      "Burst traffic exceeding plan limits",
      "Multiple instances making concurrent requests",
    ],
    solutions: [
      {
        title: "Implement Exponential Backoff",
        description: "Add retry logic with exponential backoff to handle rate limits gracefully.",
        code: `async function sendWithRetry(requestFn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      if (error.status === 429 && attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s, 8s...
        const delay = Math.pow(2, attempt) * 1000;
        console.log(\`Rate limited, retrying in \${delay}ms...\`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

// Usage
const result = await sendWithRetry(() => 
  client.email.send({
    to: 'user@example.com',
    subject: 'Hello',
    content: 'World'
  })
);`,
        language: "javascript",
      },
      {
        title: "Use Batch Operations",
        description: "Send multiple notifications in batches to reduce API calls.",
        code: `// Instead of individual calls
// for (const user of users) {
//   await client.email.send({ to: user.email, ... });
// }

// Use batch sending
const emailBatch = users.map(user => ({
  to: user.email,
  subject: 'Batch Email',
  template: 'newsletter',
  variables: { name: user.name }
}));

const result = await client.email.sendBatch(emailBatch);
console.log(\`Sent \${result.sent} emails, \${result.failed} failed\`);`,
        language: "javascript",
      },
      {
        title: "Monitor Rate Limits",
        description: "Check rate limit headers and adjust request frequency.",
        code: `// Check rate limit headers in response
client.on('response', (response) => {
  const remaining = response.headers['x-ratelimit-remaining'];
  const resetTime = response.headers['x-ratelimit-reset'];
  
  console.log(\`Rate limit remaining: \${remaining}\`);
  console.log(\`Rate limit resets at: \${new Date(resetTime * 1000)}\`);
  
  if (remaining < 10) {
    console.warn('Approaching rate limit, consider slowing down requests');
  }
});`,
        language: "javascript",
      },
    ],
    relatedLinks: [
      {
        title: "Rate Limiting Guide",
        url: "/docs/api/rate-limits",
      },
      {
        title: "Batch Operations",
        url: "/docs/api/batch-operations",
      },
    ],
    tags: ["rate-limit", "429", "throttling", "batch", "retry"],
  },
  {
    id: "webhook-not-received",
    title: "Webhooks Not Being Received",
    category: "integration" as const,
    severity: "medium" as const,
    description: "Webhook events are not reaching your endpoint",
    symptoms: [
      "No webhook requests received at your endpoint",
      "Webhook delivery attempts showing as failed",
      "Missing delivery status updates",
      "Events not triggering expected actions",
    ],
    causes: [
      "Incorrect webhook URL configuration",
      "Firewall blocking incoming requests",
      "SSL certificate issues",
      "Webhook endpoint returning non-2xx status codes",
      "Request timeout or slow response times",
    ],
    solutions: [
      {
        title: "Verify Webhook Configuration",
        description: "Check that your webhook URL is correctly configured and accessible.",
        steps: [
          "Verify the webhook URL in your Notifi dashboard",
          "Test the URL manually with curl or Postman",
          "Ensure the endpoint returns 200 OK for POST requests",
          "Check that the URL is publicly accessible (not localhost)",
        ],
        code: `# Test your webhook endpoint
curl -X POST https://your-domain.com/webhooks/notifi \\
  -H "Content-Type: application/json" \\
  -d '{"test": true}'

# Should return 200 OK`,
        language: "bash",
      },
      {
        title: "Implement Proper Webhook Handler",
        description: "Create a webhook endpoint that properly handles Notifi events.",
        code: `// Express.js webhook handler
app.post('/webhooks/notifi', express.raw({type: 'application/json'}), (req, res) => {
  const signature = req.headers['x-notifi-signature'];
  const payload = req.body;
  
  // Verify webhook signature
  if (!verifyWebhookSignature(payload, signature)) {
    return res.status(401).send('Invalid signature');
  }
  
  try {
    const event = JSON.parse(payload);
    console.log('Received webhook:', event.type);
    
    // Process the event
    handleWebhookEvent(event);
    
    // Always respond with 200 OK
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).send('Internal Server Error');
  }
});

function verifyWebhookSignature(payload, signature) {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.NOTIFI_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  return signature === \`sha256=\${expectedSignature}\`;
}`,
        language: "javascript",
      },
      {
        title: "Debug Webhook Deliveries",
        description: "Use webhook debugging tools to troubleshoot delivery issues.",
        code: `// Check webhook delivery logs
const deliveries = await client.webhooks.getDeliveries({
  webhookId: 'wh_1234567890',
  limit: 10
});

deliveries.forEach(delivery => {
  console.log(\`Delivery \${delivery.id}:\`);
  console.log(\`  Status: \${delivery.status}\`);
  console.log(\`  Response: \${delivery.responseCode}\`);
  console.log(\`  Error: \${delivery.errorMessage}\`);
});`,
        language: "javascript",
      },
    ],
    relatedLinks: [
      {
        title: "Webhook Setup Guide",
        url: "/docs/webhooks/setup",
      },
      {
        title: "Webhook Security",
        url: "/docs/webhooks/security",
      },
    ],
    tags: ["webhooks", "integration", "delivery", "endpoint", "debugging"],
  },
  {
    id: "template-rendering-errors",
    title: "Template Rendering Errors",
    category: "api" as const,
    severity: "medium" as const,
    description: "Template variables not rendering correctly or causing errors",
    symptoms: [
      "Variables showing as {{variable}} in sent messages",
      "Template compilation errors",
      "Missing or incorrect dynamic content",
      'Error: "Template variable not found"',
    ],
    causes: [
      "Missing required template variables",
      "Incorrect variable syntax in templates",
      "Data type mismatches",
      "Nested object access issues",
      "Template syntax errors",
    ],
    solutions: [
      {
        title: "Validate Template Variables",
        description: "Ensure all required variables are provided with correct data types.",
        code: `// Validate variables before sending
function validateTemplateVariables(template, variables) {
  const requiredVars = template.variables.filter(v => v.required);
  const missing = requiredVars.filter(v => !(v.name in variables));
  
  if (missing.length > 0) {
    throw new Error(\`Missing required variables: \${missing.map(v => v.name).join(', ')}\`);
  }
  
  // Type validation
  template.variables.forEach(varDef => {
    const value = variables[varDef.name];
    if (value !== undefined && typeof value !== varDef.type) {
      console.warn(\`Variable '\${varDef.name}' expected \${varDef.type}, got \${typeof value}\`);
    }
  });
}

// Usage
const templateVars = {
  name: 'John Doe',
  age: 30,
  preferences: {
    newsletter: true,
    notifications: false
  }
};

validateTemplateVariables(template, templateVars);

const result = await client.email.send({
  to: 'user@example.com',
  template: 'user-profile-update',
  variables: templateVars
});`,
        language: "javascript",
      },
      {
        title: "Test Template Rendering",
        description: "Use the template preview API to test rendering before sending.",
        code: `// Preview template with test data
const preview = await client.templates.preview({
  templateId: 'welcome-email',
  variables: {
    name: 'Test User',
    company: 'Test Company',
    loginUrl: 'https://app.example.com/login'
  }
});

console.log('Rendered subject:', preview.subject);
console.log('Rendered HTML:', preview.html);
console.log('Rendered text:', preview.text);

// Check for unrendered variables
const unrendered = preview.html.match(/{{\\w+}}/g);
if (unrendered) {
  console.warn('Unrendered variables found:', unrendered);
}`,
        language: "javascript",
      },
    ],
    relatedLinks: [
      {
        title: "Template Variables Guide",
        url: "/docs/templates/variables",
      },
      {
        title: "Template Testing",
        url: "/docs/templates/testing",
      },
    ],
    tags: ["templates", "variables", "rendering", "validation"],
  },
  {
    id: "performance-slow-api",
    title: "Slow API Response Times",
    category: "performance" as const,
    severity: "medium" as const,
    description: "API requests taking longer than expected to complete",
    symptoms: [
      "API requests timing out",
      "Slow response times (>5 seconds)",
      "Application performance degradation",
      "User experience issues",
    ],
    causes: [
      "Large payload sizes",
      "Inefficient API usage patterns",
      "Network latency issues",
      "Server-side processing delays",
      "Missing request optimization",
    ],
    solutions: [
      {
        title: "Optimize Request Payloads",
        description: "Reduce payload size and optimize request structure.",
        code: `// Instead of sending large objects
const heavyPayload = {
  to: 'user@example.com',
  subject: 'Newsletter',
  content: {
    html: '<!-- Very large HTML content -->',
    attachments: [/* Large files */]
  },
  metadata: {/* Lots of metadata */}
};

// Use templates and references
const optimizedPayload = {
  to: 'user@example.com',
  template: 'newsletter-template', // Reference instead of inline content
  variables: {
    userName: 'John',
    month: 'January'
  },
  attachmentIds: ['att_123', 'att_456'] // Reference instead of inline
};

// Measure request time
const startTime = Date.now();
const result = await client.email.send(optimizedPayload);
const duration = Date.now() - startTime;
console.log(\`Request completed in \${duration}ms\`);`,
        language: "javascript",
      },
      {
        title: "Implement Request Caching",
        description: "Cache frequently used data to reduce API calls.",
        code: `class NotifiCache {
  constructor(ttl = 300000) { // 5 minutes default TTL
    this.cache = new Map();
    this.ttl = ttl;
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  set(key, value) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttl
    });
  }
}

const cache = new NotifiCache();

async function getTemplateWithCache(templateId) {
  const cacheKey = \`template:\${templateId}\`;
  let template = cache.get(cacheKey);
  
  if (!template) {
    template = await client.templates.get(templateId);
    cache.set(cacheKey, template);
  }
  
  return template;
}`,
        language: "javascript",
      },
      {
        title: "Use Async Processing",
        description: "Implement asynchronous processing for non-critical operations.",
        code: `// Queue non-urgent notifications
const notificationQueue = [];

async function queueNotification(notification) {
  notificationQueue.push({
    ...notification,
    queuedAt: new Date()
  });
  
  // Return immediately
  return { queued: true, position: notificationQueue.length };
}

// Process queue in batches
async function processQueue() {
  const batch = notificationQueue.splice(0, 10); // Process 10 at a time
  
  if (batch.length === 0) return;
  
  try {
    const results = await Promise.allSettled(
      batch.map(notification => client.email.send(notification))
    );
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(\`Failed to send notification \${index}:\`, result.reason);
        // Re-queue or handle error
      }
    });
  } catch (error) {
    console.error('Batch processing error:', error);
  }
}

// Process queue every 30 seconds
setInterval(processQueue, 30000);`,
        language: "javascript",
      },
    ],
    relatedLinks: [
      {
        title: "Performance Best Practices",
        url: "/docs/performance/best-practices",
      },
      {
        title: "API Optimization Guide",
        url: "/docs/api/optimization",
      },
    ],
    tags: ["performance", "optimization", "caching", "async", "batching"],
  },
  {
    id: "multi-channel-sync-issues",
    title: "Multi-Channel Synchronization Issues",
    category: "integration" as const,
    severity: "high" as const,
    description: "Messages not synchronized properly across different channels",
    symptoms: [
      "Duplicate messages across channels",
      "Messages sent out of order",
      "Some channels not receiving messages",
      "Inconsistent delivery timing",
    ],
    causes: [
      "Race conditions in multi-channel workflows",
      "Incorrect workflow configuration",
      "Channel-specific delivery delays",
      "Missing error handling for failed channels",
      "Improper sequencing logic",
    ],
    solutions: [
      {
        title: "Implement Proper Workflow Sequencing",
        description: "Use workflow steps with proper delays and conditions.",
        code: `// Create a synchronized multi-channel workflow
const workflow = await client.workflows.create({
  name: 'Synchronized Welcome Campaign',
  trigger: {
    type: 'event',
    event: 'user.registered'
  },
  steps: [
    {
      id: 'welcome-email',
      type: 'email',
      delay: 0,
      template: 'welcome-email',
      conditions: []
    },
    {
      id: 'welcome-sms',
      type: 'sms',
      delay: 300, // 5 minutes after email
      template: 'welcome-sms',
      conditions: [
        {
          field: 'steps.welcome-email.status',
          operator: 'equals',
          value: 'sent'
        }
      ]
    },
    {
      id: 'push-notification',
      type: 'push',
      delay: 600, // 10 minutes after email
      template: 'welcome-push',
      conditions: [
        {
          field: 'user.push_enabled',
          operator: 'equals',
          value: true
        }
      ]
    }
  ]
});`,
        language: "javascript",
      },
      {
        title: "Handle Channel Failures Gracefully",
        description: "Implement fallback mechanisms for failed channels.",
        code: `async function sendMultiChannelMessage(user, message) {
  const results = {
    email: null,
    sms: null,
    push: null
  };
  
  // Try email first
  try {
    results.email = await client.email.send({
      to: user.email,
      subject: message.subject,
      content: message.content
    });
  } catch (error) {
    console.error('Email failed:', error);
    results.email = { error: error.message };
  }
  
  // If email fails, try SMS as fallback
  if (results.email?.error && user.phone) {
    try {
      results.sms = await client.sms.send({
        to: user.phone,
        message: message.fallbackText
      });
    } catch (error) {
      console.error('SMS fallback failed:', error);
      results.sms = { error: error.message };
    }
  }
  
  // Always try push if available
  if (user.deviceToken) {
    try {
      results.push = await client.push.send({
        to: user.deviceToken,
        title: message.title,
        body: message.body
      });
    } catch (error) {
      console.error('Push notification failed:', error);
      results.push = { error: error.message };
    }
  }
  
  return results;
}`,
        language: "javascript",
      },
    ],
    relatedLinks: [
      {
        title: "Multi-Channel Workflows",
        url: "/docs/workflows/multi-channel",
      },
      {
        title: "Error Handling Strategies",
        url: "/docs/best-practices/error-handling",
      },
    ],
    tags: ["multi-channel", "workflows", "synchronization", "fallback", "sequencing"],
  },
];
