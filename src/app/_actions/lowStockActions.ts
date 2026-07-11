'use server';

import { z } from 'zod';

// We do NOT import nodemailer here directly because we can just call the existing API route securely,
// or we can use nodemailer. To keep it simple, we'll fetch the internal API route using the secret.

const alertSchema = z.object({
  ingredient: z.string(),
  current: z.number(),
  threshold: z.number(),
  unit: z.string()
});

export async function triggerCustomerLowStockAlert(data: {
  ingredient: string;
  current: number;
  threshold: number;
  unit: string;
}) {
  const parsed = alertSchema.safeParse(data);
  if (!parsed.success) return { success: false };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const apiSecret = process.env.API_SECRET_KEY;

  try {
    const res = await fetch(`${baseUrl}/api/send-alert-email`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiSecret}` 
      },
      body: JSON.stringify({
        ...parsed.data,
        outletName: 'Global Supply',
      })
    });
    
    if (!res.ok) {
      console.warn('Failed to send internal alert via API');
    }
    return { success: res.ok };
  } catch (err) {
    console.error('Error triggering alert:', err);
    return { success: false };
  }
}
