import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
if (smtpHost && smtpUser && smtpPass) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
}

export const sendEmail = async (to: string, subject: string, text: string) => {
  if (!transporter) {
    console.log('[Notifications] Email not sent (SMTP not configured).', { to, subject, text });
    return;
  }

  await transporter.sendMail({
    from: smtpUser,
    to,
    subject,
    text
  });
};

export const sendWhatsApp = async (number: string, message: string) => {
  // Placeholder: integrate with provider (e.g., Twilio, Meta WhatsApp API)
  console.log('[Notifications] WhatsApp (placeholder) to', number, message);
};

export const sendSMS = async (number: string, message: string) => {
  // Placeholder: integrate with SMS provider
  console.log('[Notifications] SMS (placeholder) to', number, message);
};
