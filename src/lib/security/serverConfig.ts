/**
 * Resolves the server's base URL from the environment.
 * Ensures the URL is absolute and uses HTTPS in production.
 */
export function getServerBaseUrl(): string {
  const baseUrl = process.env.APP_BASE_URL;

  if (!baseUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error("APP_BASE_URL environment variable is missing in production.");
    }
    // Safe fallback for local development if not provided, but failing closed in production.
    return "http://localhost:3000";
  }

  let sanitized = baseUrl.trim();
  
  // Remove trailing slashes
  while (sanitized.endsWith('/')) {
    sanitized = sanitized.slice(0, -1);
  }

  if (!sanitized.startsWith('http://') && !sanitized.startsWith('https://')) {
    throw new Error(`APP_BASE_URL must be an absolute URL (http/https). Received: ${baseUrl}`);
  }

  if (process.env.NODE_ENV === 'production' && !sanitized.startsWith('https://')) {
    throw new Error(`APP_BASE_URL must use HTTPS in production. Received: ${baseUrl}`);
  }

  return sanitized;
}
