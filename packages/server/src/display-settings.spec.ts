// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DEFAULT_DISPLAY_SETTINGS } from '@roon-screen-cover/shared';

describe('display settings data directory', () => {
  const dirs: string[] = [];

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('loads and saves display settings under DATA_DIR', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'roon-display-settings-'));
    dirs.push(dataDir);
    vi.stubEnv('DATA_DIR', dataDir);
    const { loadDisplaySettings, saveDisplaySettings } = await import('./display-settings.js');

    saveDisplaySettings({ ...DEFAULT_DISPLAY_SETTINGS, fontScale: 1.2, artworkScale: 75 });

    expect(JSON.parse(fs.readFileSync(path.join(dataDir, 'display-settings.json'), 'utf8'))).toEqual({
      ...DEFAULT_DISPLAY_SETTINGS,
      fontScale: 1.2,
      artworkScale: 75,
    });
    expect(loadDisplaySettings()).toEqual({ ...DEFAULT_DISPLAY_SETTINGS, fontScale: 1.2, artworkScale: 75 });
  });

  it('fills smart idle defaults when loading a legacy settings file', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'roon-display-settings-'));
    dirs.push(dataDir);
    fs.writeFileSync(path.join(dataDir, 'display-settings.json'), JSON.stringify({ fontScale: 1.25, artworkScale: 80 }));
    vi.stubEnv('DATA_DIR', dataDir);
    vi.resetModules();
    const { loadDisplaySettings } = await import('./display-settings.js');

    expect(loadDisplaySettings()).toEqual({ ...DEFAULT_DISPLAY_SETTINGS, fontScale: 1.25, artworkScale: 80 });
  });
});

describe('display settings validation', () => {
  it('accepts strict partial smart idle updates', async () => {
    const { validateDisplaySettingsUpdate } = await import('./display-settings.js');
    expect(validateDisplaySettingsUpdate({ idleMode: 'layout', idleLayout: 'cover', idleDelayMinutes: 12 })).toBeNull();
    expect(validateDisplaySettingsUpdate({
      nightDimmingEnabled: true,
      nightDimmingStart: '23:15',
      nightDimmingEnd: '06:30',
      nightBrightness: 20,
    })).toBeNull();
  });

  it.each([
    [{ idleMode: 'album' }],
    [{ idleLayout: 'unknown' }],
    [{ idleDelayMinutes: Number.NaN }],
    [{ idleDelayMinutes: 2.5 }],
    [{ idleDelayMinutes: 0 }],
    [{ nightDimmingStart: '24:00' }],
    [{ nightDimmingEnd: '7:00' }],
    [{ nightBrightness: Number.POSITIVE_INFINITY }],
    [{ nightDimmingEnabled: 'yes' }],
    [{ unknown: true }],
    [{}],
  ])('rejects invalid update %j', async (update) => {
    const { validateDisplaySettingsUpdate } = await import('./display-settings.js');
    expect(validateDisplaySettingsUpdate(update)).not.toBeNull();
  });
});
