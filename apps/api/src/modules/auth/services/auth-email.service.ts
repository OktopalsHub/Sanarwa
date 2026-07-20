import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthEmailService {
  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    // Email sending logic would go here
    console.log(`Sending welcome email to ${email} for ${firstName}`);
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    // Password reset email logic would go here
    console.log(`Sending password reset email to ${email} with token ${resetToken}`);
  }

  async sendEmail(options: { to: string | string[]; subject: string; html: string; text?: string; from?: string }): Promise<void> {
    // Generic email sending logic would go here
    const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;
    const from = options.from || 'default@system.com';
    console.log(`Sending email from ${from} to ${to} with subject ${options.subject}`);
  }
}