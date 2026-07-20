import Sanarwa from '../src';

// Initialize the client with the new simplified API
const sanarwaClient = new Sanarwa({
  key: process.env.SANARWA_API_KEY || 'your-api-key-here'
});

async function sendEmailNotification() {
  try {
    // Send an email notification
    const response = await sanarwaClient.email.send({
      to: 'user@example.com',
      template: 'welcome-email',
      data: {
        name: 'John Doe',
        company: 'Acme Corp'
      }
    });

    console.log('✅ Email sent:', response.id);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function sendSmsNotification() {
  try {
    // Send an SMS notification
    const response = await sanarwaClient.sms.send({
      to: '+1234567890',
      template: 'verification-code',
      data: {
        code: '123456'
      }
    });

    console.log('✅ SMS sent:', response.id);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}



async function sendInAppNotification() {
  try {
    // Send an in-app notification
    const response = await sanarwaClient.inapp.send({
      to: 'user-123',
      template: 'new-message',
      data: {
        sender: 'Alice',
        message: 'Hello there!'
      }
    });

    console.log('✅ In-app notification sent:', response.id);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function sendPushNotification() {
  try {
    // Send a push notification
    const response = await sanarwaClient.push.send({
      to: 'device-token-123',
      template: 'breaking-news',
      data: {
        title: 'Breaking News',
        body: 'Important update available'
      }
    });

    console.log('✅ Push notification sent:', response.id);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function sendWhatsAppNotification() {
  try {
    // Send a WhatsApp notification
    const response = await sanarwaClient.whatsapp.send({
      to: '+1234567890',
      template: 'order-update',
      data: {
        customerName: 'John Doe',
        orderNumber: 'ORD-12345',
        status: 'shipped'
      }
    });

    console.log('✅ WhatsApp message sent:', response.id);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function sendBulkEmails() {
  try {
    // Send bulk email notifications
    const response = await sanarwaClient.email.bulkSend({
      template: 'newsletter',
      notifications: [
        {
          to: 'user1@example.com',
          data: { name: 'Alice' }
        },
        {
          to: 'user2@example.com',
          data: { name: 'Bob' }
        }
      ]
    });

    console.log('✅ Bulk emails sent:', response.batchId);
    console.log('Success count:', response.successCount);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function getEmailHistory() {
  try {
    // Get email notification history
    const notifications = await sanarwaClient.email.getHistory({
      limit: 10,
      status: 'delivered'
    });

    console.log('📊 Total email notifications:', notifications.total);
    notifications.data.forEach(notification => {
      console.log(`${notification.id}: ${notification.status}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function getNotificationDetails() {
  const sanarwaClient = new Sanarwa({
    key: process.env.SANARWA_API_KEY || 'your-api-key-here'
  });

  try {
    // Get notification details
    const response = await sanarwaClient.getNotificationDetails('notification-id');
    console.log('✅ Notification details:', response);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run examples
async function runExamples() {
  console.log('🚀 Running Sanarwa SDK Examples (New API)\n');

  await sendEmailNotification();
  console.log('\n' + '='.repeat(50) + '\n');

  await sendSmsNotification();
  console.log('\n' + '='.repeat(50) + '\n');

  await sendVoiceNotification();
  console.log('\n' + '='.repeat(50) + '\n');

  await sendInAppNotification();
  console.log('\n' + '='.repeat(50) + '\n');

  await sendPushNotification();
  console.log('\n' + '='.repeat(50) + '\n');

  await sendWhatsAppNotification();
  console.log('\n' + '='.repeat(50) + '\n');

  await sendBulkEmails();
  console.log('\n' + '='.repeat(50) + '\n');

  await getEmailHistory();
  console.log('\n' + '='.repeat(50) + '\n');

  await getNotificationDetails();
}

if (require.main === module) {
  runExamples().catch(console.error);
}