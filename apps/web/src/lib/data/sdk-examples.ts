// Enhanced SDK examples with more comprehensive coverage
export const sdkExamples = {
  javascript: [
    {
      id: "js-send-email",
      title: "Send Email Notification",
      description: "Send a simple email notification using the JavaScript SDK",
      language: "javascript",
      code: `import { NotifiClient } from '@notifi/sdk';

const client = new NotifiClient({
  apiKey: process.env.NOTIFI_API_KEY,
  baseUrl: 'https://api.notifi.com'
});

async function sendEmail() {
  try {
    const result = await client.email.send({
      to: 'user@example.com',
      subject: 'Welcome to Notifi!',
      template: 'welcome-template',
      variables: {
        name: 'John Doe',
        company: 'Acme Corp'
      }
    });
    
    console.log('Email sent:', result.id);
    return result;
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

sendEmail();`,
      parameters: [
        {
          name: "to",
          type: "string",
          required: true,
          description: "Recipient email address",
          defaultValue: "user@example.com",
        },
        {
          name: "subject",
          type: "string",
          required: true,
          description: "Email subject line",
          defaultValue: "Welcome to Notifi!",
        },
        {
          name: "template",
          type: "string",
          required: true,
          description: "Template ID to use",
          defaultValue: "welcome-template",
        },
      ],
      expectedOutput: `{
  "id": "msg_1234567890",
  "status": "sent",
  "to": "user@example.com",
  "subject": "Welcome to Notifi!",
  "sentAt": "2024-01-15T10:30:00Z"
}`,
    },
    {
      id: "js-send-sms",
      title: "Send SMS Notification",
      description: "Send an SMS message using the JavaScript SDK",
      language: "javascript",
      code: `import { NotifiClient } from '@notifi/sdk';

const client = new NotifiClient({
  apiKey: process.env.NOTIFI_API_KEY
});

async function sendSMS() {
  try {
    const result = await client.sms.send({
      to: '+1234567890',
      message: 'Your verification code is: {{code}}',
      variables: {
        code: '123456'
      }
    });
    
    console.log('SMS sent:', result.id);
    return result;
  } catch (error) {
    console.error('Failed to send SMS:', error);
    throw error;
  }
}

sendSMS();`,
      parameters: [
        {
          name: "to",
          type: "string",
          required: true,
          description: "Recipient phone number (E.164 format)",
          defaultValue: "+1234567890",
        },
        {
          name: "message",
          type: "text",
          required: true,
          description: "SMS message content",
          defaultValue: "Your verification code is: {{code}}",
        },
      ],
      expectedOutput: `{
  "id": "sms_1234567890",
  "status": "sent",
  "to": "+1234567890",
  "message": "Your verification code is: 123456",
  "sentAt": "2024-01-15T10:30:00Z"
}`,
    },
    {
      id: "js-create-workflow",
      title: "Create Workflow",
      description: "Create a multi-step notification workflow",
      language: "javascript",
      code: `import { NotifiClient } from '@notifi/sdk';

const client = new NotifiClient({
  apiKey: process.env.NOTIFI_API_KEY
});

async function createWorkflow() {
  try {
    const workflow = await client.workflows.create({
      name: 'User Onboarding',
      trigger: {
        type: 'event',
        event: 'user.registered'
      },
      steps: [
        {
          type: 'email',
          delay: 0,
          template: 'welcome-email',
          conditions: []
        },
        {
          type: 'email',
          delay: 86400, // 24 hours
          template: 'onboarding-tips',
          conditions: [
            {
              field: 'user.email_verified',
              operator: 'equals',
              value: true
            }
          ]
        }
      ]
    });
    
    console.log('Workflow created:', workflow.id);
    return workflow;
  } catch (error) {
    console.error('Failed to create workflow:', error);
    throw error;
  }
}

createWorkflow();`,
      parameters: [
        {
          name: "name",
          type: "string",
          required: true,
          description: "Workflow name",
          defaultValue: "User Onboarding",
        },
        {
          name: "trigger_event",
          type: "string",
          required: true,
          description: "Event that triggers the workflow",
          defaultValue: "user.registered",
        },
      ],
      expectedOutput: `{
  "id": "wf_1234567890",
  "name": "User Onboarding",
  "status": "active",
  "trigger": {
    "type": "event",
    "event": "user.registered"
  },
  "steps": [
    {
      "id": "step_1",
      "type": "email",
      "delay": 0,
      "template": "welcome-email"
    },
    {
      "id": "step_2", 
      "type": "email",
      "delay": 86400,
      "template": "onboarding-tips"
    }
  ],
  "createdAt": "2024-01-15T10:30:00Z"
}`,
    },
  ],
  python: [
    {
      id: "py-send-email",
      title: "Send Email Notification",
      description: "Send an email notification using the Python SDK",
      language: "python",
      code: `from notifi import NotifiClient
import os

client = NotifiClient(
    api_key=os.getenv('NOTIFI_API_KEY'),
    base_url='https://api.notifi.com'
)

def send_email():
    try:
        result = client.email.send(
            to='user@example.com',
            subject='Welcome to Notifi!',
            template='welcome-template',
            variables={
                'name': 'John Doe',
                'company': 'Acme Corp'
            }
        )
        
        print(f'Email sent: {result.id}')
        return result
    except Exception as error:
        print(f'Failed to send email: {error}')
        raise error

if __name__ == '__main__':
    send_email()`,
      parameters: [
        {
          name: "to",
          type: "string",
          required: true,
          description: "Recipient email address",
          defaultValue: "user@example.com",
        },
        {
          name: "subject",
          type: "string",
          required: true,
          description: "Email subject line",
          defaultValue: "Welcome to Notifi!",
        },
      ],
      expectedOutput: `{
  "id": "msg_1234567890",
  "status": "sent",
  "to": "user@example.com",
  "subject": "Welcome to Notifi!",
  "sent_at": "2024-01-15T10:30:00Z"
}`,
    },
  ],
  php: [
    {
      id: "php-send-email",
      title: "Send Email Notification",
      description: "Send an email notification using the PHP SDK",
      language: "php",
      code: `<?php
require_once 'vendor/autoload.php';

use Notifi\\NotifiClient;

$client = new NotifiClient([
    'api_key' => $_ENV['NOTIFI_API_KEY'],
    'base_url' => 'https://api.notifi.com'
]);

function sendEmail($client) {
    try {
        $result = $client->email->send([
            'to' => 'user@example.com',
            'subject' => 'Welcome to Notifi!',
            'template' => 'welcome-template',
            'variables' => [
                'name' => 'John Doe',
                'company' => 'Acme Corp'
            ]
        ]);
        
        echo "Email sent: " . $result->id . "\\n";
        return $result;
    } catch (Exception $error) {
        echo "Failed to send email: " . $error->getMessage() . "\\n";
        throw $error;
    }
}

sendEmail($client);
?>`,
      parameters: [
        {
          name: "to",
          type: "string",
          required: true,
          description: "Recipient email address",
          defaultValue: "user@example.com",
        },
      ],
      expectedOutput: `{
  "id": "msg_1234567890",
  "status": "sent",
  "to": "user@example.com",
  "subject": "Welcome to Notifi!",
  "sent_at": "2024-01-15T10:30:00Z"
}`,
    },
  ],
  java: [
    {
      id: "java-send-email",
      title: "Send Email Notification",
      description: "Send an email notification using the Java SDK",
      language: "java",
      code: `import com.notifi.sdk.NotifiClient;
import com.notifi.sdk.models.EmailRequest;
import com.notifi.sdk.models.EmailResponse;
import java.util.HashMap;
import java.util.Map;

public class NotifiExample {
    public static void main(String[] args) {
        NotifiClient client = new NotifiClient.Builder()
            .apiKey(System.getenv("NOTIFI_API_KEY"))
            .baseUrl("https://api.notifi.com")
            .build();
        
        try {
            Map<String, Object> variables = new HashMap<>();
            variables.put("name", "John Doe");
            variables.put("company", "Acme Corp");
            
            EmailRequest request = EmailRequest.builder()
                .to("user@example.com")
                .subject("Welcome to Notifi!")
                .template("welcome-template")
                .variables(variables)
                .build();
            
            EmailResponse response = client.email().send(request);
            System.out.println("Email sent: " + response.getId());
        } catch (Exception e) {
            System.err.println("Failed to send email: " + e.getMessage());
        }
    }
}`,
      parameters: [
        {
          name: "to",
          type: "string",
          required: true,
          description: "Recipient email address",
          defaultValue: "user@example.com",
        },
        {
          name: "subject",
          type: "string",
          required: true,
          description: "Email subject line",
          defaultValue: "Welcome to Notifi!",
        },
      ],
      expectedOutput: `{
  "id": "msg_1234567890",
  "status": "sent",
  "to": "user@example.com",
  "subject": "Welcome to Notifi!",
  "sent_at": "2024-01-15T10:30:00Z"
}`,
    },
  ],
  go: [
    {
      id: "go-send-email",
      title: "Send Email Notification",
      description: "Send an email notification using the Go SDK",
      language: "go",
      code: `package main

import (
    "context"
    "fmt"
    "log"
    "os"
    
    "github.com/notifi/go-sdk/notifi"
)

func main() {
    client := notifi.NewClient(&notifi.Config{
        APIKey:  os.Getenv("NOTIFI_API_KEY"),
        BaseURL: "https://api.notifi.com",
    })
    
    ctx := context.Background()
    
    req := &notifi.EmailRequest{
        To:       "user@example.com",
        Subject:  "Welcome to Notifi!",
        Template: "welcome-template",
        Variables: map[string]interface{}{
            "name":    "John Doe",
            "company": "Acme Corp",
        },
    }
    
    resp, err := client.Email.Send(ctx, req)
    if err != nil {
        log.Fatalf("Failed to send email: %v", err)
    }
    
    fmt.Printf("Email sent: %s\\n", resp.ID)
}`,
      parameters: [
        {
          name: "to",
          type: "string",
          required: true,
          description: "Recipient email address",
          defaultValue: "user@example.com",
        },
      ],
      expectedOutput: `{
  "id": "msg_1234567890",
  "status": "sent",
  "to": "user@example.com",
  "subject": "Welcome to Notifi!",
  "sent_at": "2024-01-15T10:30:00Z"
}`,
    },
  ],
  dotnet: [
    {
      id: "dotnet-send-email",
      title: "Send Email Notification",
      description: "Send an email notification using the .NET SDK",
      language: "csharp",
      code: `using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Notifi.SDK;
using Notifi.SDK.Models;

class Program
{
    static async Task Main(string[] args)
    {
        var client = new NotifiClient(new NotifiClientOptions
        {
            ApiKey = Environment.GetEnvironmentVariable("NOTIFI_API_KEY"),
            BaseUrl = "https://api.notifi.com"
        });
        
        try
        {
            var variables = new Dictionary<string, object>
            {
                ["name"] = "John Doe",
                ["company"] = "Acme Corp"
            };
            
            var request = new EmailRequest
            {
                To = "user@example.com",
                Subject = "Welcome to Notifi!",
                Template = "welcome-template",
                Variables = variables
            };
            
            var response = await client.Email.SendAsync(request);
            Console.WriteLine($"Email sent: {response.Id}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to send email: {ex.Message}");
        }
    }
}`,
      parameters: [
        {
          name: "to",
          type: "string",
          required: true,
          description: "Recipient email address",
          defaultValue: "user@example.com",
        },
      ],
      expectedOutput: `{
  "id": "msg_1234567890",
  "status": "sent",
  "to": "user@example.com",
  "subject": "Welcome to Notifi!",
  "sent_at": "2024-01-15T10:30:00Z"
}`,
    },
  ],
};

export const apiEndpoints = [
  {
    id: "send-email",
    method: "POST" as const,
    path: "/v1/notifications/email",
    description: "Send an email notification",
    parameters: [
      {
        name: "to",
        type: "string",
        in: "body" as const,
        required: true,
        description: "Recipient email address",
        example: "user@example.com",
      },
      {
        name: "subject",
        type: "string",
        in: "body" as const,
        required: true,
        description: "Email subject line",
        example: "Welcome to Notifi!",
      },
      {
        name: "template",
        type: "string",
        in: "body" as const,
        required: false,
        description: "Template ID to use",
        example: "welcome-template",
      },
    ],
    requestBody: {
      contentType: "application/json",
      schema: {
        type: "object",
        properties: {
          to: { type: "string", format: "email" },
          subject: { type: "string" },
          template: { type: "string" },
          variables: { type: "object" },
        },
      },
      example: {
        to: "user@example.com",
        subject: "Welcome to Notifi!",
        template: "welcome-template",
        variables: {
          name: "John Doe",
          company: "Acme Corp",
        },
      },
    },
    responses: [
      {
        status: 200,
        description: "Email sent successfully",
        example: {
          id: "msg_1234567890",
          status: "sent",
          to: "user@example.com",
          subject: "Welcome to Notifi!",
          sentAt: "2024-01-15T10:30:00Z",
        },
      },
      {
        status: 400,
        description: "Invalid request parameters",
        example: {
          error: "validation_error",
          message: "Invalid email address",
          details: {
            field: "to",
            code: "invalid_email",
          },
        },
      },
      {
        status: 401,
        description: "Authentication failed",
        example: {
          error: "authentication_error",
          message: "Invalid API key",
        },
      },
    ],
  },
  {
    id: "send-sms",
    method: "POST" as const,
    path: "/v1/notifications/sms",
    description: "Send an SMS notification",
    parameters: [
      {
        name: "to",
        type: "string",
        in: "body" as const,
        required: true,
        description: "Recipient phone number in E.164 format",
        example: "+1234567890",
      },
      {
        name: "message",
        type: "string",
        in: "body" as const,
        required: true,
        description: "SMS message content",
        example: "Your verification code is: 123456",
      },
    ],
    requestBody: {
      contentType: "application/json",
      schema: {
        type: "object",
        properties: {
          to: { type: "string" },
          message: { type: "string" },
          variables: { type: "object" },
        },
      },
      example: {
        to: "+1234567890",
        message: "Your verification code is: {{code}}",
        variables: {
          code: "123456",
        },
      },
    },
    responses: [
      {
        status: 200,
        description: "SMS sent successfully",
        example: {
          id: "sms_1234567890",
          status: "sent",
          to: "+1234567890",
          message: "Your verification code is: 123456",
          sentAt: "2024-01-15T10:30:00Z",
        },
      },
      {
        status: 400,
        description: "Invalid request parameters",
        example: {
          error: "validation_error",
          message: "Invalid phone number format",
          details: {
            field: "to",
            code: "invalid_phone",
          },
        },
      },
    ],
  },
  {
    id: "send-push",
    method: "POST" as const,
    path: "/v1/notifications/push",
    description: "Send a push notification",
    parameters: [
      {
        name: "to",
        type: "string",
        in: "body" as const,
        required: true,
        description: "Device token or user ID",
        example: "device_token_123",
      },
      {
        name: "title",
        type: "string",
        in: "body" as const,
        required: true,
        description: "Notification title",
        example: "New Message",
      },
      {
        name: "body",
        type: "string",
        in: "body" as const,
        required: true,
        description: "Notification body text",
        example: "You have a new message from John",
      },
    ],
    requestBody: {
      contentType: "application/json",
      schema: {
        type: "object",
        properties: {
          to: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          data: { type: "object" },
        },
      },
      example: {
        to: "device_token_123",
        title: "New Message",
        body: "You have a new message from John",
        data: {
          messageId: "msg_123",
          userId: "user_456",
        },
      },
    },
    responses: [
      {
        status: 200,
        description: "Push notification sent successfully",
        example: {
          id: "push_1234567890",
          status: "sent",
          to: "device_token_123",
          title: "New Message",
          sentAt: "2024-01-15T10:30:00Z",
        },
      },
      {
        status: 400,
        description: "Invalid request parameters",
        example: {
          error: "validation_error",
          message: "Invalid device token",
          details: {
            field: "to",
            code: "invalid_token",
          },
        },
      },
    ],
  },
  {
    id: "create-template",
    method: "POST" as const,
    path: "/v1/templates",
    description: "Create a new notification template",
    parameters: [
      {
        name: "name",
        type: "string",
        in: "body" as const,
        required: true,
        description: "Template name",
        example: "welcome-email",
      },
      {
        name: "channel",
        type: "string",
        in: "body" as const,
        required: true,
        description: "Communication channel",
        example: "email",
      },
      {
        name: "content",
        type: "object",
        in: "body" as const,
        required: true,
        description: "Template content",
        example: {
          subject: "Welcome {{name}}!",
          html: "<h1>Welcome {{name}}!</h1><p>Thanks for joining {{company}}.</p>",
        },
      },
    ],
    requestBody: {
      contentType: "application/json",
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          channel: { type: "string", enum: ["email", "sms", "push", "in-app"] },
          content: { type: "object" },
          variables: { type: "array" },
        },
      },
      example: {
        name: "welcome-email",
        channel: "email",
        content: {
          subject: "Welcome {{name}}!",
          html: "<h1>Welcome {{name}}!</h1><p>Thanks for joining {{company}}.</p>",
          text: "Welcome {{name}}! Thanks for joining {{company}}.",
        },
        variables: [
          { name: "name", type: "string", required: true },
          { name: "company", type: "string", required: false },
        ],
      },
    },
    responses: [
      {
        status: 201,
        description: "Template created successfully",
        example: {
          id: "tpl_1234567890",
          name: "welcome-email",
          channel: "email",
          status: "active",
          createdAt: "2024-01-15T10:30:00Z",
        },
      },
      {
        status: 400,
        description: "Invalid template data",
        example: {
          error: "validation_error",
          message: "Template name already exists",
          details: {
            field: "name",
            code: "duplicate_name",
          },
        },
      },
    ],
  },
  {
    id: "get-analytics",
    method: "GET" as const,
    path: "/v1/analytics/delivery",
    description: "Get delivery analytics and metrics",
    parameters: [
      {
        name: "startDate",
        type: "string",
        in: "query" as const,
        required: true,
        description: "Start date (ISO 8601)",
        example: "2024-01-01T00:00:00Z",
      },
      {
        name: "endDate",
        type: "string",
        in: "query" as const,
        required: true,
        description: "End date (ISO 8601)",
        example: "2024-01-31T23:59:59Z",
      },
      {
        name: "channel",
        type: "string",
        in: "query" as const,
        required: false,
        description: "Filter by channel",
        example: "email",
      },
    ],
    responses: [
      {
        status: 200,
        description: "Analytics data retrieved successfully",
        example: {
          period: {
            startDate: "2024-01-01T00:00:00Z",
            endDate: "2024-01-31T23:59:59Z",
          },
          metrics: {
            totalSent: 15420,
            delivered: 14892,
            bounced: 234,
            failed: 294,
            deliveryRate: 0.966,
            bounceRate: 0.015,
          },
          channelBreakdown: {
            email: { sent: 12000, delivered: 11580 },
            sms: { sent: 2500, delivered: 2450 },
            push: { sent: 920, delivered: 862 },
          },
        },
      },
    ],
  },
];
