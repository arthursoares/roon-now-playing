import { describe, expect, it } from 'vitest';
import {
  BACKGROUNDS,
  BACKGROUND_CONFIG,
  DEFAULT_DISPLAY_SETTINGS,
  DEFAULT_FACTS_PROMPT,
  FONTS,
  FONT_CONFIG,
  LAYOUTS,
  LLM_MODELS,
  LLM_PROVIDERS,
  IDLE_MODES,
} from './index';

describe('shared configuration registries', () => {
  it('publishes each supported layout exactly once', () => {
    expect(LAYOUTS).toEqual([
      'detailed',
      'minimal',
      'fullscreen',
      'ambient',
      'cover',
      'facts-columns',
      'facts-overlay',
      'facts-carousel',
      'basic',
    ]);
    expect(new Set(LAYOUTS).size).toBe(LAYOUTS.length);
  });

  it('keeps the font registry and metadata in sync', () => {
    expect(Object.keys(FONT_CONFIG)).toEqual(FONTS);
    expect(FONT_CONFIG.system.googleFont).toBeNull();

    for (const font of FONTS) {
      expect(FONT_CONFIG[font].displayName.trim()).not.toBe('');
      if (font !== 'system') {
        expect(FONT_CONFIG[font].googleFont).toMatch(/:wght@/);
      }
    }
  });

  it('keeps the background registry and metadata in sync', () => {
    expect(Object.keys(BACKGROUND_CONFIG)).toEqual(BACKGROUNDS);

    for (const background of BACKGROUNDS) {
      expect(BACKGROUND_CONFIG[background].displayName.trim()).not.toBe('');
      expect(BACKGROUND_CONFIG[background].category).toMatch(
        /^(basic|gradient|artwork|textured)$/,
      );
    }
  });

  it('defines a model strategy for every provider', () => {
    expect(Object.keys(LLM_MODELS)).toEqual(LLM_PROVIDERS);
    expect(LLM_MODELS.local).toEqual([]);
    expect(LLM_MODELS.openrouter).toContain('custom');

    for (const provider of LLM_PROVIDERS) {
      if (provider !== 'local') {
        expect(LLM_MODELS[provider].length).toBeGreaterThan(0);
      }
    }
  });

  it('retains safe display defaults and all prompt substitutions', () => {
    expect(DEFAULT_DISPLAY_SETTINGS.fontScale).toBeGreaterThan(0);
    expect(DEFAULT_DISPLAY_SETTINGS.artworkScale).toBeGreaterThan(0);
    expect(DEFAULT_DISPLAY_SETTINGS.artworkScale).toBeLessThanOrEqual(100);
    expect(IDLE_MODES).toEqual(['off', 'clock', 'black', 'layout']);
    expect(DEFAULT_DISPLAY_SETTINGS).toMatchObject({
      idleMode: 'off',
      idleLayout: 'cover',
      idleDelayMinutes: 5,
      nightDimmingEnabled: false,
      nightDimmingStart: '22:00',
      nightDimmingEnd: '07:00',
      nightBrightness: 30,
    });

    for (const placeholder of ['{factsCount}', '{artist}', '{album}', '{title}']) {
      expect(DEFAULT_FACTS_PROMPT).toContain(placeholder);
    }
  });
});
