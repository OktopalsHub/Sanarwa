/**
 * TypeScript Usage Example
 * 
 * This shows how to use the Sanarwa SDK with TypeScript
 */

import { Sanarwa, NotificationRequest, NotificationResponse } from 'sanarwa-sdk';

// Simple - just pass your API key!
const client = new Sanarwa(process.env.SANARWA_API_KEY || 'your-api-key-here');

async function sendTypedNotifications() {
  try {
    // Send an email with type safety
    console.log('📧 Sending email...');
    const emailRequest: NotificationRequest = {
      to: 'user@example.com',
      template: 'welcome-email',
      data: {
        name: 'John Doe',
        email: 'user@example.com'
      }
    };
    
    const emailResult: NotificationResponse = await client.email.send(emailRequest);
    console.log('✅ Email sent:', emailResult.id);

    // Send bulk emails
    console.log('\n📬 Sending bulk emails...');
    const bulkResult = await client.email.bulkSend({
      template: 'newsletter',
      notifications: [
        { to: 'user1@example.com', data: { name: 'Alice' } },
        { to: 'user2@example.com', data: { name: 'Bob' } },
        { to: 'user3@example.com', data: { name: 'Charlie' } }
      ]
    });
    console.log('✅ Bulk emails sent:', bulkResult.batchId);

    // Get templates
    console.log('\n📋 Fetching templates...');
    const templates = await client.getTemplates({ type: 'email', limit: 5 });
    console.log(`✅ Found ${templates.data?.length || 0} templates`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

// Run the example
sendTypedNotifications();
