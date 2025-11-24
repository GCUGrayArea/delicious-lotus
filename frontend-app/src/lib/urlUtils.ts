/**
 * Removes query parameters from a URL
 * @param url - The URL to clean
 * @returns The URL without query parameters
 */
export function stripQueryParams(url: string | null | undefined): string {
  if (!url) return '';

  try {
    // Handle both absolute URLs and relative URLs
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const urlObj = new URL(url);
      return urlObj.origin + urlObj.pathname;
    } else {
      // For relative URLs, just remove everything after '?'
      return url.split('?')[0];
    }
  } catch (error) {
    // Fallback: just split by '?' if URL parsing fails
    return url.split('?')[0];
  }
}

/**
 * Checks if a URL has query parameters
 * @param url - The URL to check
 * @returns True if the URL has query parameters
 */
export function hasQueryParams(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes('?');
}