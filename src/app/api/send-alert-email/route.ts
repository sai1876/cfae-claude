import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { rateLimit } from '@/lib/rateLimit';
import { z } from 'zod';

const emailRequestSchema = z.object({
  ingredient: z.string().min(1).max(100),
  current: z.number().nonnegative(),
  threshold: z.number().nonnegative(),
  unit: z.string().max(20),
  outletName: z.string().max(100),
  ownerEmail: z.string().email().optional(),
  weatherContext: z.string().optional(),
  aiSuggestedRefill: z.number().optional(),
  aiReasoning: z.string().optional()
});

export async function POST(req: Request) {
  // 1. Check API Secret Key
  const authHeader = req.headers.get('authorization');
  const apiSecret = process.env.API_SECRET_KEY;
  if (!apiSecret || authHeader !== `Bearer ${apiSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Rate Limiting (30 requests per minute per IP)
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success: rateLimitSuccess } = rateLimit(`alert-email:${ip}`, 30, 60 * 1000);
  if (!rateLimitSuccess) {
    return NextResponse.json({ success: false, error: 'Too Many Requests' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const result = emailRequestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input data', details: result.error.issues }, { status: 400 });
    }

    const { ingredient, current, threshold, unit, outletName, ownerEmail: bodyOwnerEmail, weatherContext, aiSuggestedRefill, aiReasoning } = result.data;

    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASS || '';
    const ownerEmail = bodyOwnerEmail || process.env.OWNER_EMAIL || smtpUser;

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
      to: ownerEmail,
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
          <div style="text-align: center; margin-top: 25px; border-top: 1px solid #302117; padding-top: 15px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin" style="background-color: #f8bc51; color: #060403; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block;">Open Admin Portal</a>
          </div>
          <p style="font-size: 11px; color: #d4c4b0; opacity: 0.4; text-align: center; margin-top: 25px; font-family: monospace;">
            Hau Hau Cafe Automated Systems &bull; Generated Live
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, message: 'Email sent successfully!' });
  } catch (error: unknown) {
    console.error('Error sending alert email:', error);
    let errorMessage = 'Failed to send alert email';
    if (error instanceof Error) errorMessage = error.message;
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
