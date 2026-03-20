import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

interface PasswordResetEmailPayload {
  to: string;
  firstName: string;
  resetLink: string;
  expiresMinutes: number;
}

let transporter: nodemailer.Transporter | null = null;

function isBrevoSmtpHost(host: string | undefined): boolean {
  return host?.trim().toLowerCase() === 'smtp-relay.brevo.com';
}

function maskSmtpUser(value: string | undefined): string {
  if (!value) {
    return '<missing>';
  }

  const atIndex = value.indexOf('@');
  if (atIndex <= 1) {
    return '***';
  }

  return `${value.slice(0, 2)}***${value.slice(atIndex)}`;
}

function toPasswordResetMailError(error: unknown): Error {
  if (
    isBrevoSmtpHost(env.SMTP_HOST) &&
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'EAUTH'
  ) {
    const smtpError = error as { response?: unknown; command?: unknown };
    const response = typeof smtpError.response === 'string' ? ` Response: ${smtpError.response}.` : '';
    const command = typeof smtpError.command === 'string' ? ` Command: ${smtpError.command}.` : '';

    return new Error(
      `Brevo SMTP authentication failed for SMTP_USER=${maskSmtpUser(env.SMTP_USER)} on ${env.SMTP_HOST}:${env.SMTP_PORT}. Use your Brevo SMTP login email address as SMTP_USER and your Brevo SMTP key as SMTP_PASS. Do not use the Brevo REST API key here.${response}${command}`,
    );
  }

  return error instanceof Error ? error : new Error('Password reset email send failed');
}

export function isPasswordResetEmailConfigured(): boolean {
  return Boolean(env.MAIL_FROM && env.SMTP_HOST && env.SMTP_PORT);
}

function getTransporter(): nodemailer.Transporter {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER && env.SMTP_PASS
      ? {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        }
      : undefined,
  });

  return transporter;
}

export async function sendPasswordResetEmail(
  payload: PasswordResetEmailPayload,
): Promise<void> {
  if (!isPasswordResetEmailConfigured()) {
    return;
  }

  const mailer = getTransporter();
  const subject = 'PC Hub password reset';
  const text = [
    `Hello ${payload.firstName},`,
    '',
    'We received a request to reset your PC Hub password.',
    `Please use the link below to set a new password within ${payload.expiresMinutes} minutes:`,
    payload.resetLink,
    '',
    'If you did not request this change, you can safely ignore this email.',
    '',
    'PC Hub',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <h2 style="margin-bottom: 16px;">PC Hub password reset</h2>
      <p>Hello ${payload.firstName},</p>
      <p>We received a request to reset your PC Hub password.</p>
      <p>
        Please use the link below to set a new password within
        <strong>${payload.expiresMinutes} minutes</strong>.
      </p>
      <p style="margin: 24px 0;">
        <a
          href="${payload.resetLink}"
          style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 600;"
        >
          Reset password
        </a>
      </p>
      <p style="word-break: break-all;">
        If the button does not work, copy and paste this link into your browser:<br />
        <a href="${payload.resetLink}">${payload.resetLink}</a>
      </p>
      <p>If you did not request this change, you can safely ignore this email.</p>
      <p style="margin-top: 24px;">PC Hub</p>
    </div>
  `;

  try {
    await mailer.sendMail({
      from: env.MAIL_FROM,
      to: payload.to,
      subject,
      text,
      html,
    });
  } catch (error) {
    throw toPasswordResetMailError(error);
  }
}
