// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

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

    saveDisplaySettings({ fontScale: 1.2, artworkScale: 75 });

    expect(JSON.parse(fs.readFileSync(path.join(dataDir, 'display-settings.json'), 'utf8'))).toEqual({
      fontScale: 1.2,
      artworkScale: 75,
    });
    expect(loadDisplaySettings()).toEqual({ fontScale: 1.2, artworkScale: 75 });
  });
});
