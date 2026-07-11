/**
 * Business Date Utility
 * 
 * F&B Business Day: 11:00 AM to 1:00 AM (next day) IST
 * Any time before 11:00 AM IST belongs to the previous business date.
 */

const TIMEZONE = 'Asia/Kolkata';
const BUSINESS_DAY_START_HOUR = 11;

export interface BusinessDateContext {
  business_date: string;
  is_operating_time: boolean;
  operating_state: "open_window" | "after_midnight_window" | "closed_before_open";
}

export function getBusinessDateContext(timestampMs: number = Date.now()): BusinessDateContext {
  // Convert timestamp to IST Date object
  const dateStr = new Date(timestampMs).toLocaleString('en-US', { timeZone: TIMEZONE });
  const istDate = new Date(dateStr);
  
  const hour = istDate.getHours();
  let operating_state: BusinessDateContext['operating_state'] = 'open_window';
  let is_operating_time = true;
  
  if (hour < BUSINESS_DAY_START_HOUR) {
    // Before 11 AM, belongs to previous calendar day
    istDate.setDate(istDate.getDate() - 1);
    
    if (hour === 0) {
      // 12:00am - 12:59am
      operating_state = 'after_midnight_window';
    } else {
      // 1:00am - 10:59am
      operating_state = 'closed_before_open';
      is_operating_time = false;
    }
  }
  
  const yyyy = istDate.getFullYear();
  const mm = String(istDate.getMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getDate()).padStart(2, '0');
  
  return {
    business_date: `${yyyy}-${mm}-${dd}`,
    is_operating_time,
    operating_state
  };
}

/**
 * Gets the current business date string (YYYY-MM-DD) based on IST.
 */
export function getCurrentBusinessDate(timestampMs: number = Date.now()): string {
  return getBusinessDateContext(timestampMs).business_date;
}

/**
 * Gets the unix timestamps (ms) for the start and end of a given business date.
 * Business window is 11:00 AM on the given date to 1:00 AM on the next day.
 * 
 * @param businessDate YYYY-MM-DD
 */
export function getBusinessWindow(businessDate: string): { start_at: number; end_at: number; timezone: 'Asia/Kolkata' } {
  const [yyyy, mm, dd] = businessDate.split('-').map(Number);
  
  // Format: YYYY-MM-DDTHH:mm:ss+05:30
  const dateStr = `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}T11:00:00+05:30`;
  const start_at = new Date(dateStr).getTime();
  
  // End of business window is 14 hours later (11:00 AM to 1:00 AM next day)
  const end_at = start_at + (14 * 60 * 60 * 1000);
  
  return {
    start_at,
    end_at,
    timezone: TIMEZONE
  };
}

/**
 * Checks if a given timestamp falls within the operating window of a specific business date.
 */
export function isWithinOperatingWindow(timestampMs: number, businessDate: string): boolean {
  const { start_at, end_at } = getBusinessWindow(businessDate);
  return timestampMs >= start_at && timestampMs < end_at;
}
