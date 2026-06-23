import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { rateLimit } from '@/lib/rateLimit';
import { z } from 'zod';

const staffRequestSchema = z.object({
  action: z.enum(['send_otp', 'send_code']),
  otp: z.string().optional(),
  name: z.string().max(100).optional(),
  role: z.string().max(50).optional(),
  outlet: z.string().max(100).optional(),
  passcode: z.string().max(20).optional(),
  employeeId: z.string().max(50).optional()
});

export async function POST(req: Request) {
  // 1. Check API Secret Key
  const authHeader = req.headers.get('authorization');
  const apiSecret = process.env.API_SECRET_KEY;
  if (!apiSecret || authHeader !== `Bearer ${apiSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Rate Limiting (3 requests per minute per IP)
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success: rateLimitSuccess } = rateLimit(`staff-code:${ip}`, 3, 60 * 1000);
  if (!rateLimitSuccess) {
    return NextResponse.json({ success: false, error: 'Too Many Requests' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const result = staffRequestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input data', details: result.error.issues }, { status: 400 });
    }

    const { action, otp, name, role, outlet, passcode, employeeId } = result.data;

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const targetEmail = process.env.OWNER_EMAIL || smtpUser;

    if (!smtpUser || !smtpPass) {
      console.warn('MOCK EMAIL: SMTP_USER or SMTP_PASS not set');
      return NextResponse.json({ success: true, message: 'Mock email sent', mock: true });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    let htmlTemplate = '';
    let subject = '';

    if (action === 'send_otp') {
      subject = `Security Alert: Staff Provisioning Verification`;
      htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin: 0; padding: 20px; font-family: 'Courier New', Courier, monospace; background-color: #0A0604; color: #f7dec4;">
        <div style="max-width: 600px; margin: 0 auto; background: #120a06; border: 1px solid #302117; border-radius: 12px; padding: 30px;">
          <h2 style="color: #f8bc51; font-family: Georgia, serif; font-style: italic; margin-top: 0;">Verification Required</h2>
          <p style="color: #d4c4b0; font-size: 14px; line-height: 1.6;">
            A request was made to provision a new staff terminal. Please enter the following One-Time Password (OTP) in the dashboard to authorize this action:
          </p>
          <div style="background: #070402; border: 1px solid #302117; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center;">
            <p style="color: #d4c4b0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">Authorization Code</p>
            <h1 style="color: #f8bc51; font-size: 32px; letter-spacing: 8px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #d4c4b0; font-size: 12px; margin-top: 30px; opacity: 0.6; text-align: center;">
            If you did not request this, please secure your account immediately.
          </p>
        </div>
      </body>
      </html>`;
    } else {
      const isOwner = role === 'owner';
      const roleTitle = isOwner ? 'Owner / Master Admin' : (role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Staff');
      subject = `Terminal Access Code: ${name} (${roleTitle})`;
      htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin: 0; padding: 20px; font-family: 'Courier New', Courier, monospace; background-color: #0A0604; color: #f7dec4;">
        <div style="max-width: 600px; margin: 0 auto; background: #120a06; border: 1px solid #302117; border-radius: 12px; padding: 30px;">
          <h2 style="color: #f8bc51; font-family: Georgia, serif; font-style: italic; margin-top: 0;">New Staff Terminal Provisioned</h2>
          <p style="color: #d4c4b0; font-size: 14px; line-height: 1.6;">
            A new terminal access token has been generated. Please keep this code secure and share it only with the assigned staff member.
          </p>
          <div style="background: #070402; border: 1px solid #302117; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #d4c4b0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; width: 40%;">Employee ID</td>
                <td style="padding: 8px 0; color: #ffffff; font-weight: bold;">${employeeId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #d4c4b0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Name</td>
                <td style="padding: 8px 0; color: #ffffff; font-weight: bold;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #d4c4b0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Access Tier</td>
                <td style="padding: 8px 0; color: #ffffff; font-weight: bold;">${roleTitle}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #d4c4b0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Outlet Hub</td>
                <td style="padding: 8px 0; color: #ffffff; font-weight: bold;">${outlet}</td>
              </tr>
              <tr>
                <td style="padding: 15px 0 8px 0; color: #d4c4b0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; border-top: 1px solid #302117;">Verification Code</td>
                <td style="padding: 15px 0 8px 0; color: #10B981; font-weight: bold; font-size: 18px; letter-spacing: 3px; border-top: 1px solid #302117;">${passcode}</td>
              </tr>
            </table>
          </div>
          <p style="color: #d4c4b0; font-size: 12px; margin-top: 30px; opacity: 0.6; text-align: center;">
            This is an automated system message. Do not reply.
          </p>
        </div>
      </body>
      </html>`;
    }

    await transporter.sendMail({
      from: `"Terminal Security" <${smtpUser}>`,
      to: targetEmail,
      subject,
      html: htmlTemplate,
    });

    return NextResponse.json({ success: true, message: 'Email sent successfully' });
  } catch (error: any) {
    console.error('Error sending staff email:', error);
    return NextResponse.json({ success: false, message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
