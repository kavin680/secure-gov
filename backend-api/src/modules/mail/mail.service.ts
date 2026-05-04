import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    const enabled = this.configService.get<boolean>('mail.enabled');

    if (enabled) {
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('mail.host'),
        port: this.configService.get<number>('mail.port'),
        secure: this.configService.get<boolean>('mail.secure'),
        auth: {
          user: this.configService.get<string>('mail.user'),
          pass: this.configService.get<string>('mail.password'),
        },
      });
      this.logger.log('Mail service initialized');
    } else {
      this.logger.warn('Mail service is disabled');
    }
  }

  async send(options: SendMailOptions): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`Mail not sent (disabled): ${options.subject}`);
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('mail.from'),
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      this.logger.log(`Mail sent to ${options.to}: ${options.subject}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send mail to ${options.to}`,
        (error as Error).stack,
      );
      return false;
    }
  }

  async sendVerificationEmail(email: string, token: string): Promise<boolean> {
    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    const link = `${frontendUrl}/verify-email?token=${token}`;

    return this.send({
      to: email,
      subject: 'Verify your email',
      html: `<h1>Email Verification</h1><p>Click <a href="${link}">here</a> to verify your email.</p>`,
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    const link = `${frontendUrl}/reset-password?token=${token}`;

    return this.send({
      to: email,
      subject: 'Reset your password',
      html: `<h1>Password Reset</h1><p>Click <a href="${link}">here</a> to reset your password.</p>`,
    });
  }
}
