/**
 * Detects if the current device is a mobile device
 */

export function isMobile(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return false;
  }

  // Check user agent for mobile indicators
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
}
