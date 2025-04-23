// src/modules/email/email.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
    private transporter;

    constructor(private configService: ConfigService) {
        // Configure email transporter
        this.transporter = nodemailer.createTransport({
            host: this.configService.get<string>('EMAIL_HOST'),
            port: this.configService.get<number>('EMAIL_PORT'),
            secure: this.configService.get<boolean>('EMAIL_SECURE'),
            auth: {
                user: this.configService.get<string>('EMAIL_USER'),
                pass: this.configService.get<string>('EMAIL_PASSWORD'),
            },

            // Add these options to handle TLS issues
            tls: {
                rejectUnauthorized: false, // Only use during development!
            }
        });
    }

    async sendConfirmationEmail(email: string, token: string): Promise<boolean> {
        const confirmationUrl = `https://prop-harmony.vercel.app/confirm-email?token=${token}`;

        try {
            await this.transporter.sendMail({
                from: this.configService.get<string>('EMAIL_FROM'),
                to: email,
                subject: 'Please confirm your email address',
                html: `
          <h1>Email Confirmation</h1>
          <p>Thank you for registering! Please confirm your email by clicking the link below:</p>
          <a href="${confirmationUrl}">Confirm Email</a>
          <p>This link will expire in 24 hours.</p>
        `,
            });
            return true;
        } catch (error) {
            console.error('Failed to send confirmation email:', error);
            return false;
        }
    }

    async verifyEmailExists(email: string): Promise<boolean> {
        // In a production environment, you would integrate with an email validation API
        // For example: abstract-api, emailage, etc.
        // For this example, we'll just check basic email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);

        // Example of API integration:
        // const response = await axios.get(`https://emailvalidation.abstractapi.com/v1/?api_key=${apiKey}&email=${email}`);
        // return response.data.is_valid_format && response.data.deliverability === 'DELIVERABLE';
    }

    // src/modules/email/email.service.ts
    async testEmailConfiguration(): Promise<boolean> {
        try {
            await this.transporter.sendMail({
                from: this.configService.get<string>('EMAIL_FROM'),
                to: this.configService.get<string>('EMAIL_USER'), // Send to yourself for testing
                subject: 'Email Configuration Test',
                html: '<h1>Email Configuration Test</h1><p>If you received this email, your email configuration is working correctly!</p>',
            });
            console.log('Test email sent successfully');
            return true;
        } catch (error) {
            console.error('Failed to send test email:', error);
            return false;
        }
    }

    // New methods for password reset functionality
    async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
        const resetUrl = `https://prop-harmony.vercel.app/reset-password?token=${resetToken}`;
        
        try {
            await this.transporter.sendMail({
                from: this.configService.get<string>('EMAIL_FROM'),
                to: email,
                subject: 'Password Reset Request',
                html: `
                    <h1>Password Reset</h1>
                    <p>You requested a password reset. Click the link below to reset your password:</p>
                    <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
                    <p>This link is valid for 1 hour.</p>
                    <p>If you didn't request this, please ignore this email.</p>
                `,
            });
            return true;
        } catch (error) {
            console.error('Failed to send password reset email:', error);
            return false;
        }
    }

    async sendPasswordChangeConfirmationEmail(email: string): Promise<boolean> {
        try {
            await this.transporter.sendMail({
                from: this.configService.get<string>('EMAIL_FROM'),
                to: email,
                subject: 'Password Changed Successfully',
                html: `
                    <h1>Password Changed</h1>
                    <p>Your password has been changed successfully.</p>
                    <p>If you did not perform this action, please contact our support team immediately.</p>
                `,
            });
            return true;
        } catch (error) {
            console.error('Failed to send password change confirmation email:', error);
            return false;
        }
    }

    // Generic method for sending emails
    async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
        try {
            await this.transporter.sendMail({
                from: this.configService.get<string>('EMAIL_FROM'),
                to,
                subject,
                html,
            });
            return true;
        } catch (error) {
            console.error(`Failed to send email with subject "${subject}":`, error);
            return false;
        }
    }
}
