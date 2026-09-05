import fs from 'fs';
import path from 'path';
import {
  type DisplaySettings,
  DEFAULT_DISPLAY_SETTINGS,
  IDLE_MODES,
  LAYOUTS,
} from '@roon-screen-cover/shared';

const CONFIG_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'config');
const SETTINGS_FILE = path.join(CONFIG_DIR, 'display-settings.json');

export function loadDisplaySettings(): DisplaySettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const parsed = JSON.parse(data) as Partial<DisplaySettings>;
      return normalizeDisplaySettings(parsed);
    }
  } catch (err) {
    console.error('Failed to load display settings:', err);
  }
  return { ...DEFAULT_DISPLAY_SETTINGS };
}

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function normalizeDisplaySettings(value: Partial<DisplaySettings>): DisplaySettings {
  const settings = { ...DEFAULT_DISPLAY_SETTINGS };
  for (const [key, candidate] of Object.entries(value)) {
    const error = validateDisplaySetting(key, candidate);
    if (!error && key in settings) {
      (settings as unknown as Record<string, unknown>)[key] = candidate;
    }
  }
  return settings;
}

export function validateDisplaySettingsUpdate(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 'Display settings must be an object';
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return 'At least one display setting is required';
  for (const [key, candidate] of entries) {
    if (!(key in DEFAULT_DISPLAY_SETTINGS)) return `Unknown display setting: ${key}`;
    const error = validateDisplaySetting(key, candidate);
    if (error) return error;
  }
  return null;
}

function validateDisplaySetting(key: string, value: unknown): string | null {
  switch (key) {
    case 'fontScale':
      return finiteNumberInRange(value, 0.75, 1.5, key);
    case 'artworkScale':
      return finiteNumberInRange(value, 50, 100, key);
    case 'idleMode':
      return typeof value === 'string' && (IDLE_MODES as readonly string[]).includes(value)
        ? null : `idleMode must be one of: ${IDLE_MODES.join(', ')}`;
    case 'idleLayout':
      return typeof value === 'string' && (LAYOUTS as readonly string[]).includes(value)
        ? null : `idleLayout must be one of: ${LAYOUTS.join(', ')}`;
    case 'idleDelayMinutes':
      return finiteNumberInRange(value, 1, 60, key, true);
    case 'nightDimmingEnabled':
      return typeof value === 'boolean' ? null : 'nightDimmingEnabled must be a boolean';
    case 'nightDimmingStart':
    case 'nightDimmingEnd':
      return typeof value === 'string' && TIME_PATTERN.test(value)
        ? null : `${key} must use 24-hour HH:MM format`;
    case 'nightBrightness':
      return finiteNumberInRange(value, 1, 100, key, true);
    default:
      return `Unknown display setting: ${key}`;
  }
}

function finiteNumberInRange(value: unknown, min: number, max: number, key: string, integer = false): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    return `${key} must be ${integer ? 'an integer' : 'a number'} between ${min} and ${max}`;
  }
  return null;
}

export function saveDisplaySettings(settings: DisplaySettings): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}
