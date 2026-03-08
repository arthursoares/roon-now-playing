import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import { ClientSettingsStore } from './clientSettings.js';

const TEST_FILE = './test-client-settings.json';

describe('ClientSettingsStore', () => {
  afterEach(() => {
    if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
  });

  it('should return null for unknown device', () => {
    const store = new ClientSettingsStore(TEST_FILE);
    expect(store.get('unknown')).toBeNull();
  });

  it('should persist and retrieve settings', () => {
    const store = new ClientSettingsStore(TEST_FILE);
    const settings = {
      layout: 'ambient' as const,
      font: 'inter' as const,
      background: 'gradient-radial' as const,
      zoneId: 'zone-1',
      zoneName: 'HiFi',
      fontScaleOverride: null,
    };
    store.set('device-1', settings);
    expect(store.get('device-1')).toEqual(settings);
  });

  it('should load from disk on construction', () => {
    const store1 = new ClientSettingsStore(TEST_FILE);
    store1.set('device-1', {
      layout: 'minimal' as const,
      font: 'system' as const,
      background: 'black' as const,
      zoneId: null,
      zoneName: null,
      fontScaleOverride: null,
    });

    const store2 = new ClientSettingsStore(TEST_FILE);
    const loaded = store2.get('device-1');
    expect(loaded).not.toBeNull();
    expect(loaded!.layout).toBe('minimal');
  });

  it('should delete settings', () => {
    const store = new ClientSettingsStore(TEST_FILE);
    store.set('device-1', {
      layout: 'detailed' as const,
      font: 'system' as const,
      background: 'black' as const,
      zoneId: null,
      zoneName: null,
      fontScaleOverride: null,
    });
    store.delete('device-1');
    expect(store.get('device-1')).toBeNull();
  });
});
