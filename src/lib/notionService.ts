import { Client } from '@notionhq/client';

// Initialize the Notion client safely
// This will silently fail or skip operations if the API key is not configured,
// preventing the app from crashing before the owner sets up Notion.
const notion = process.env.NOTION_API_KEY 
  ? new Client({ auth: process.env.NOTION_API_KEY })
  : null;

/**
 * Creates or updates a customer in the Notion Customers database
 */
export async function syncCustomerToNotion(data: {
  phone: string;
  name: string;
  email?: string;
  isStudent?: boolean;
}) {
  if (!notion || !process.env.NOTION_CUSTOMERS_DB_ID) return;

  try {
    // 1. Check if customer already exists by Phone
    const existing = await notion.databases.query({
      database_id: process.env.NOTION_CUSTOMERS_DB_ID,
      filter: {
        property: 'Phone',
        rich_text: {
          equals: data.phone
        }
      }
    });

    if (existing.results.length > 0) {
      // Update existing customer (e.g., if they added an email later)
      const pageId = existing.results[0].id;
      await notion.pages.update({
        page_id: pageId,
        properties: {
          'Name': { title: [{ text: { content: data.name } }] },
          ...(data.email && { 'Email': { email: data.email } }),
          ...(data.isStudent !== undefined && { 'Verified Student': { checkbox: data.isStudent } }),
        }
      });
    } else {
      // Create new customer
      await notion.pages.create({
        parent: { database_id: process.env.NOTION_CUSTOMERS_DB_ID },
        properties: {
          'Name': { title: [{ text: { content: data.name } }] },
          'Phone': { rich_text: [{ text: { content: data.phone } }] },
          ...(data.email && { 'Email': { email: data.email } }),
          ...(data.isStudent !== undefined && { 'Verified Student': { checkbox: data.isStudent } }),
        }
      });
    }
  } catch (error) {
    console.error("Notion Sync Customer Error:", error);
  }
}

/**
 * Adds an order to the Notion Orders database
 */
export async function syncOrderToNotion(data: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  items: string; // Summary of items
  totalAmount: number;
  status: string;
  paymentMethod: string;
}) {
  if (!notion || !process.env.NOTION_ORDERS_DB_ID) return;

  try {
    await notion.pages.create({
      parent: { database_id: process.env.NOTION_ORDERS_DB_ID },
      properties: {
        'Order ID': { title: [{ text: { content: data.orderId } }] },
        'Customer Name': { rich_text: [{ text: { content: data.customerName } }] },
        'Customer Phone': { rich_text: [{ text: { content: data.customerPhone } }] },
        'Items Summary': { rich_text: [{ text: { content: data.items } }] },
        'Total Amount': { number: data.totalAmount },
        'Status': { select: { name: data.status } },
        'Payment Method': { select: { name: data.paymentMethod } },
        'Date': { date: { start: new Date().toISOString() } },
      }
    });
  } catch (error) {
    console.error("Notion Sync Order Error:", error);
  }
}

/**
 * Adds feedback to the Notion Feedback database
 */
export async function syncFeedbackToNotion(data: {
  orderId: string;
  customerName: string;
  rating: number;
  comment: string;
  date: string;
}) {
  if (!notion || !process.env.NOTION_FEEDBACK_DB_ID) return;

  try {
    await notion.pages.create({
      parent: { database_id: process.env.NOTION_FEEDBACK_DB_ID },
      properties: {
        'Feedback ID': { title: [{ text: { content: `FB-${data.orderId}` } }] },
        'Order ID': { rich_text: [{ text: { content: data.orderId } }] },
        'Customer': { rich_text: [{ text: { content: data.customerName } }] },
        'Rating': { number: data.rating },
        'Comment': { rich_text: [{ text: { content: data.comment || 'No comment provided' } }] },
        'Date Submitted': { date: { start: new Date(data.date).toISOString() } },
      }
    });
  } catch (error) {
    console.error("Notion Sync Feedback Error:", error);
  }
}
