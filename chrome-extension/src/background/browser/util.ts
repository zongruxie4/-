import type { BrowserContextConfig } from './views';

/**
 * Check if a URL is allowed based on the allowlist configuration.
 * @param url - The URL to check
 * @returns True if the URL is allowed, false otherwise
 */
export function isUrlAllowed(url: string, config: BrowserContextConfig): boolean {
  const trimmedUrl = url.trim();
  if (trimmedUrl.length === 0) {
    return false;
  }

  const lowerCaseUrl = trimmedUrl.toLocaleLowerCase();
  if (
    lowerCaseUrl.includes('chrome-extension://') ||
    lowerCaseUrl.includes('chrome://') ||
    lowerCaseUrl.startsWith('javascript:')
  ) {
    return false;
  }

  if (!config.allowedDomains || config.allowedDomains.length === 0) {
    return true;
  }

  try {
    // Special case: Allow 'about:blank' explicitly
    if (trimmedUrl === 'about:blank') {
      return true;
    }

    const parsedUrl = new URL(trimmedUrl);
    let domain = parsedUrl.hostname.toLowerCase();

    // Remove port number if present
    if (domain.includes(':')) {
      domain = domain.split(':')[0];
    }

    // Check if domain matches any allowed domain pattern
    return config.allowedDomains.some(
      allowedDomain => domain === allowedDomain.toLowerCase() || domain.endsWith(`.${allowedDomain.toLowerCase()}`),
    );
  } catch (error) {
    return false;
  }
}
