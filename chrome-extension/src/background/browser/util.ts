/**
 * Checks if a URL is allowed based on firewall configuration
 * @param url The URL to check
 * @param allowList The allow list
 * @param denyList The deny list
 * @returns True if the URL is allowed, false otherwise
 */
export function isUrlAllowed(url: string, allowList: string[], denyList: string[]): boolean {
  // Normalize and validate input
  const trimmedUrl = url.trim();
  if (trimmedUrl.length === 0) {
    return false;
  }

  const lowerCaseUrl = trimmedUrl.toLowerCase();

  // ALWAYS block dangerous URLs, even if firewall is disabled
  const DANGEROUS_PREFIXES = [
    'chrome-extension://',
    'chrome://',
    'javascript:',
    'data:',
    'file:',
    'vbscript:',
    'ws:',
    'wss:',
  ];

  if (DANGEROUS_PREFIXES.some(prefix => lowerCaseUrl.startsWith(prefix))) {
    return false;
  }

  // If firewall is disabled, allow all other URLs
  if (allowList.length === 0 && denyList.length === 0) {
    return true;
  }

  // Special case: Allow 'about:blank' explicitly
  if (trimmedUrl === 'about:blank') {
    return true;
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    let domain = parsedUrl.hostname.toLowerCase();

    // Remove port number if present
    const portIndex = domain.indexOf(':');
    if (portIndex > -1) {
      domain = domain.substring(0, portIndex);
    }

    // Handle IP addresses and localhost
    if (domain === 'localhost' || domain === '127.0.0.1' || domain === '[::1]') {
      // Check deny list first for consistency with security priority
      if (denyList.includes(domain)) {
        return false;
      }
      // Then check allow list
      return allowList.includes(domain) || allowList.length === 0;
    }

    // Check deny list first (security priority)
    for (const deniedEntry of denyList) {
      if (lowerCaseUrl === deniedEntry || domain === deniedEntry || domain.endsWith(`.${deniedEntry}`)) {
        return false;
      }
    }

    // Check allow list
    for (const allowedEntry of allowList) {
      if (lowerCaseUrl === allowedEntry || domain === allowedEntry || domain.endsWith(`.${allowedEntry}`)) {
        return true;
      }
    }

    // Default policy
    return allowList.length === 0;
  } catch (error) {
    // Invalid URL format - deny by default
    return false;
  }
}
