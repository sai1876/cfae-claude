import { describe, it, expect } from 'vitest';
import { generateRefundsCSV } from '../lib/csvExport';

describe('CSV Export Utility', () => {
  it('should generate a valid CSV string with correct headers and escaping', () => {
    const mockRequests = [
      {
        request_id: 'req1',
        order_id: 'ord1',
        user_id: 'usr1',
        status: 'approved',
        payment_status: 'paid',
        request_scope: 'full_order',
        reason_category: 'Item Missing',
        requested_amount: 100,
        approved_refund_amount: 50,
        linked_refund_id: 'ref1',
        manager_note: 'Partial refund approved',
        payment_method: 'upi',
        payment_reference: 'UPI1234',
        payment_note: 'Paid, thank you!', // contains comma
        paid_at: 1682899200000,
        paid_by: 'man1',
        reviewed_at: 1682899000000,
        reviewed_by: 'man1',
        created_at: 1682898000000
      }
    ];

    const csvStr = generateRefundsCSV(mockRequests);
    const rows = csvStr.split('\n');

    expect(rows.length).toBe(2);

    const headers = rows[0].split(',');
    expect(headers).toEqual([
      'request_id',
      'order_id',
      'user_id',
      'status',
      'payment_status',
      'request_scope',
      'reason_category',
      'requested_amount',
      'approved_refund_amount',
      'linked_refund_id',
      'manager_note',
      'payment_method',
      'payment_reference',
      'payment_note',
      'paid_at',
      'paid_by',
      'reviewed_at',
      'reviewed_by',
      'created_at'
    ]);

    // Check data row
    const dataRow = rows[1];
    expect(dataRow).toContain('req1');
    expect(dataRow).toContain('ord1');
    expect(dataRow).toContain('usr1');
    expect(dataRow).toContain('approved');
    expect(dataRow).toContain('paid');
    expect(dataRow).toContain('full_order');
    expect(dataRow).toContain('Item Missing');
    expect(dataRow).toContain('100');
    expect(dataRow).toContain('50');
    expect(dataRow).toContain('ref1');
    expect(dataRow).toContain('Partial refund approved');
    expect(dataRow).toContain('upi');
    expect(dataRow).toContain('UPI1234');
    expect(dataRow).toContain('"Paid, thank you!"'); // escaped correctly
    expect(dataRow).toContain(new Date(1682899200000).toISOString()); // paid_at formatted
    expect(dataRow).toContain('man1');
    expect(dataRow).toContain(new Date(1682899000000).toISOString()); // reviewed_at formatted
    expect(dataRow).toContain(new Date(1682898000000).toISOString()); // created_at formatted
  });

  it('should handle empty or undefined fields correctly', () => {
    const mockRequests = [
      {
        request_id: 'req2',
        order_id: 'ord2',
        user_id: 'usr2',
        status: 'pending',
        // missing many fields
      }
    ];

    const csvStr = generateRefundsCSV(mockRequests);
    const rows = csvStr.split('\n');
    expect(rows.length).toBe(2);
    
    // There are 19 headers, so there should be 18 commas in the row
    const commaCount = (rows[1].match(/,/g) || []).length;
    expect(commaCount).toBe(18);
    
    // Starts with req2,ord2,usr2,pending
    expect(rows[1].startsWith('req2,ord2,usr2,pending')).toBe(true);
  });
});
