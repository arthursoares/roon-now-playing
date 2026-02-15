import fs from 'fs';
import path from 'path';
import { DisplaySettings, DEFAULT_DISPLAY_SETTINGS } from '@roon-screen-cover/shared';

const CONFIG_DIR = path.join(process.cwd(), 'config');
const SETTINGS_FILE = path.join(CONFIG_DIR, 'display-settings.json');

export function loadDisplaySettings(): DisplaySettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return { ...DEFAULT_DISPLAY_SETTINGS, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Failed to load display settings:', err);
  }
  return { ...DEFAULT_DISPLAY_SETTINGS };
}

export function saveDisplaySettings(settings: DisplaySettings): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Failed to save display settings:', err);
  }
}
