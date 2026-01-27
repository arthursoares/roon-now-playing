const STORAGE_KEY = 'roon-screen-cover:device-id';

function generateUUID(): string {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or create a persistent device ID (stored in localStorage).
 * Used for friendly name persistence across sessions.
 */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem(STORAGE_KEY);

  if (!deviceId) {
    deviceId = generateUUID();
    localStorage.setItem(STORAGE_KEY, deviceId);
  }

  return deviceId;
}

/**
 * Generate a unique session ID for this WebSocket connection.
 * Each tab/connection gets its own ID to avoid conflicts.
 */
export function useClientId(): string {
  // Generate a unique ID per session (tab), combining device ID with a session suffix
  const deviceId = getDeviceId();
  const sessionSuffix = generateUUID().slice(0, 8);
  return `${deviceId}:${sessionSuffix}`;
}
