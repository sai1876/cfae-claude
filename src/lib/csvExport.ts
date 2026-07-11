export function generateRefundsCSV(requests: any[]): string {
  const headers = [
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
  ];

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = requests.map(req => {
    return headers.map(header => {
      let val = req[header];
      if ((header === 'paid_at' || header === 'reviewed_at' || header === 'created_at') && typeof val === 'number') {
        val = new Date(val).toISOString();
      }
      return escapeCsv(val);
    }).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function downloadCSV(csvContent: string, filename: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
