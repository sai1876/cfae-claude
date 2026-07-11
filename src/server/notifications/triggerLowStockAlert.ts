import nodemailer from 'nodemailer';

export async function triggerLowStockAlert(alertData: {
  name: string;
  current: number;
  threshold: number;
  unit: string;
}, outletName: string) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const targetEmail = process.env.OWNER_EMAIL || smtpUser;

  if (!smtpUser || !smtpPass || !targetEmail) {
    console.warn('MOCK EMAIL: SMTP credentials or OWNER_EMAIL not set');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: smtpUser, pass: smtpPass },
  });

  try {
    await transporter.sendMail({
      from: `"Hau Hau Cafe Stock Monitor" <${smtpUser}>`,
      to: targetEmail,
      subject: `⚠️ Low Stock Alert: ${alertData.name} @ ${outletName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #302117; background-color: #060403; border-radius: 16px; color: #f7dec4;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 40px;">⚠️</span>
            <h2 style="color: #f8bc51; font-family: serif; font-style: italic; margin-top: 10px;">Low Stock Telemetry</h2>
          </div>
          <p style="text-align: center;">An ingredient is running critically low at <strong>${outletName}</strong>.</p>
          <div style="background-color: #120a06; border: 1px solid #302117; border-radius: 12px; padding: 20px; text-align: center;">
            <p style="margin: 0; color: #ffffff; font-size: 22px; font-weight: bold;">${alertData.name}</p>
            <p style="margin: 10px 0; font-size: 16px; color: #ef4444; font-weight: bold;">Current: ${alertData.current} ${alertData.unit}</p>
            <p style="margin: 0; font-size: 14px; color: #f8bc51;">Threshold: ${alertData.threshold} ${alertData.unit}</p>
          </div>
        </div>
      `,
    });
    console.log(`⚠️ Alert email automatically triggered for low stock of: ${alertData.name}`);
  } catch (err) {
    console.warn("Auto stock-alert email delivery failed: ", err);
  }
}
