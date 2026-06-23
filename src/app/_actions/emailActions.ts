'use server';

import { z } from 'zod';
import nodemailer from 'nodemailer';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

const emailRequestSchema = z.object({
  ingredient: z.string().min(1).max(100),
  current: z.number().nonnegative(),
  threshold: z.number().nonnegative(),
  unit: z.string().max(20),
  outletName: z.string().max(100),
  weatherContext: z.string().optional(),
  aiSuggestedRefill: z.number().optional(),
  aiReasoning: z.string().optional()
});

const staffRequestSchema = z.object({
  action: z.enum(['send_otp', 'send_passcode']),
  otp: z.string().optional(),
  name: z.string().max(100).optional(),
  email: z.string().email().optional(),
  role: z.string().max(50).optional(),
  outlet: z.string().max(100).optional(),
  password: z.string().optional(),
  employeeId: z.string().max(50).optional()
});

async function verifyAdmin() {
  const session = cookies().get('__session')?.value || cookies().get('session')?.value;
  if (!session) throw new Error("Unauthorized");
  if (!adminAuth) throw new Error("Firebase Admin not configured");
  
  const decodedToken = await adminAuth.verifySessionCookie(session, true);
  let role = decodedToken.role;

  if (!role && decodedToken.email) {
    if (adminDb) {
      const configDoc = await adminDb.collection('config').doc('initialized').get();
      if (configDoc.exists && configDoc.data()?.owner_email?.toLowerCase() === decodedToken.email.toLowerCase()) {
        role = 'owner';
      } else {
        const staffDocs = await adminDb.collection('staff').where('email', '==', decodedToken.email).get();
        if (!staffDocs.empty) {
          role = staffDocs.docs[0].data().role;
        }
      }
    }
  }

  if (role !== 'admin' && role !== 'owner' && role !== 'manager') {
    throw new Error("Forbidden: Insufficient privileges");
  }
}

export async function sendAlertEmailAction(data: z.infer<typeof emailRequestSchema>) {
  // 1. Verify Authentication & Authorization
  await verifyAdmin();

  // 2. Validate Input
  const result = emailRequestSchema.safeParse(data);
  if (!result.success) throw new Error(`Invalid data: ${result.error.message}`);

  const { ingredient, current, threshold, unit, outletName, weatherContext, aiSuggestedRefill, aiReasoning } = result.data;

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const targetEmail = process.env.OWNER_EMAIL;

  if (!smtpUser || !smtpPass || !targetEmail) {
    console.warn('MOCK EMAIL: SMTP credentials or TARGET_EMAIL not set');
    return { success: true, message: 'Mock email sent', mock: true };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: smtpUser, pass: smtpPass },
  });

  const aiSection = aiSuggestedRefill !== undefined ? `
    <div style="background-color: #1a1512; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0; text-align: left; border-radius: 4px;">
      <h3 style="color: #10B981; margin: 0 0 10px 0; font-size: 16px;">✨ AI Smart Refill Prediction</h3>
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #d4c4b0;"><strong>Suggested Order:</strong> ${aiSuggestedRefill} ${unit}</p>
      <p style="margin: 0; font-size: 13px; color: #d4c4b0; font-style: italic;"><strong>Reasoning:</strong> ${aiReasoning || ''}</p>
    </div>
  ` : '';

  const weatherSection = weatherContext ? `
    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #302117; text-align: left;">
      <p style="margin: 0; font-size: 12px; color: #d4c4b0;"><strong>🌤️ Local Weather Context:</strong><br/>${weatherContext}</p>
    </div>
  ` : '';

  await transporter.sendMail({
    from: `"Hau Hau Cafe Stock Monitor" <${smtpUser}>`,
    to: targetEmail,
    subject: `⚠️ Low Stock Alert: ${ingredient} @ ${outletName || 'Global'}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #302117; background-color: #060403; border-radius: 16px; color: #f7dec4; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 40px;">⚠️</span>
          <h2 style="color: #f8bc51; font-family: serif; font-style: italic; margin-top: 10px; font-size: 24px;">Hau Hau Cafe Stock Telemetry</h2>
        </div>
        <p style="font-size: 15px; line-height: 1.5; color: #d4c4b0; text-align: center;">
          An ingredient is running critically low. Please arrange restock to prevent service disruption.
        </p>
        <div style="background-color: #120a06; border: 1px solid #302117; border-radius: 12px; padding: 20px; margin: 25px 0; text-align: center;">
          <p style="margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; color: #f8bc51; font-weight: bold;">📍 Location: ${outletName || 'Global Supply'}</p>
          <p style="margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; color: #d4c4b0; opacity: 0.6;">Ingredient</p>
          <p style="margin: 0 0 16px 0; color: #ffffff; font-size: 22px; font-weight: bold;">${ingredient}</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr>
              <td style="width: 50%; padding: 8px; text-align: right; border-right: 1px solid #302117; font-size: 14px; color: #d4c4b0;">Current Quantity:</td>
              <td style="width: 50%; padding: 8px; text-align: left; font-size: 16px; color: #ef4444; font-weight: bold;">${current} ${unit}</td>
            </tr>
            <tr>
              <td style="width: 50%; padding: 8px; text-align: right; border-right: 1px solid #302117; font-size: 14px; color: #d4c4b0;">Low Stock Limit:</td>
              <td style="width: 50%; padding: 8px; text-align: left; font-size: 14px; color: #f8bc51;">${threshold} ${unit}</td>
            </tr>
          </table>
          ${weatherSection}
        </div>
        ${aiSection}
      </div>
    `,
  });

  return { success: true };
}

export async function sendStaffCodeAction(data: z.infer<typeof staffRequestSchema>) {
  // 1. Verify Authentication & Authorization
  await verifyAdmin();

  // 2. Validate Input
  const result = staffRequestSchema.safeParse(data);
  if (!result.success) throw new Error(`Invalid data: ${result.error.message}`);

  const { action, otp, name, email, role, outlet, password, employeeId } = result.data;

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const targetEmail = action === 'send_otp' ? process.env.OWNER_EMAIL : (email || process.env.OWNER_EMAIL);

  if (!smtpUser || !smtpPass || !targetEmail) {
    console.warn('MOCK EMAIL: SMTP_USER or SMTP_PASS not set');
    return { success: true, mock: true };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: smtpUser, pass: smtpPass },
  });

  let htmlTemplate = '';
  let subject = '';

  if (action === 'send_otp') {
    subject = `Security Alert: Staff Provisioning Verification`;
    htmlTemplate = `
      <div style="background: #120a06; border: 1px solid #302117; padding: 30px; text-align: center; color: #f7dec4;">
        <h2 style="color: #f8bc51;">Verification Required</h2>
        <p>A request was made to provision a new staff terminal. Use this OTP:</p>
        <h1 style="color: #f8bc51; letter-spacing: 8px;">${otp}</h1>
      </div>
    `;
  } else {
    subject = `Your Hau Hau Cafe Login Credentials`;
    htmlTemplate = `
      <div style="background: #120a06; border: 1px solid #302117; padding: 30px; text-align: center; color: #f7dec4;">
        <h2 style="color: #f8bc51;">Welcome to the Team, ${name}!</h2>
        <p>Your Staff Terminal has been provisioned.</p>
        <p>Employee ID: ${employeeId} | Outlet: ${outlet}</p>
        <div style="margin: 20px 0; padding: 15px; border: 1px dashed #302117; background: #070402;">
          <p style="margin: 0; color: #d4c4b0; font-size: 14px;">Your Starting Password:</p>
          <h1 style="color: #10B981; letter-spacing: 3px; margin-top: 10px;">${password}</h1>
        </div>
        <p style="font-size: 12px; opacity: 0.7;">You can log in at the admin portal using your email and this password.</p>
      </div>
    `;
  }

  await transporter.sendMail({
    from: `"Terminal Security" <${smtpUser}>`,
    to: targetEmail,
    subject,
    html: htmlTemplate,
  });

  return { success: true };
}
