/**
 * Test Plan: Shared Types
 *
 * Scenario: Type exports are valid
 *   Given the shared package is imported
 *   When types are used
 *   Then they should be correctly typed
 */

import { describe, it, expect } from 'vitest';
import {
  LAYOUTS,
  FONTS,
  FONT_CONFIG,
  LLM_PROVIDERS,
  LLM_MODELS,
  BACKGROUNDS,
  BACKGROUND_CONFIG,
  type Zone,
  type Track,
  type NowPlaying,
  type PlaybackState,
  type LayoutType,
  type FontType,
  type ClientMessage,
  type ServerMessage,
} from './index';

describe('Shared Types', () => {
  describe('Zone', () => {
    it('should allow valid zone objects', () => {
      const zone: Zone = {
        id: '123',
        display_name: 'Living Room',
      };
      expect(zone.id).toBe('123');
      expect(zone.display_name).toBe('Living Room');
    });
  });

  describe('Track', () => {
    it('should allow valid track objects', () => {
      const track: Track = {
        title: 'Test Song',
        artist: 'Test Artist',
        album: 'Test Album',
        duration_seconds: 180,
        artwork_key: 'abc123',
      };
      expect(track.title).toBe('Test Song');
      expect(track.duration_seconds).toBe(180);
    });

    it('should allow null artwork_key', () => {
      const track: Track = {
        title: 'Test Song',
        artist: 'Test Artist',
        album: 'Test Album',
        duration_seconds: 180,
        artwork_key: null,
      };
      expect(track.artwork_key).toBeNull();
    });
  });

  describe('NowPlaying', () => {
    it('should allow valid now playing objects', () => {
      const nowPlaying: NowPlaying = {
        zone_id: '123',
        state: 'playing',
        track: {
          title: 'Test',
          artist: 'Artist',
          album: 'Album',
          duration_seconds: 100,
          artwork_key: null,
        },
        seek_position: 50,
      };
      expect(nowPlaying.state).toBe('playing');
      expect(nowPlaying.seek_position).toBe(50);
    });

    it('should allow null track when stopped', () => {
      const nowPlaying: NowPlaying = {
        zone_id: '123',
        state: 'stopped',
        track: null,
        seek_position: 0,
      };
      expect(nowPlaying.track).toBeNull();
    });
  });

  describe('PlaybackState', () => {
    it('should only allow valid states', () => {
      const states: PlaybackState[] = ['playing', 'paused', 'stopped'];
      expect(states).toHaveLength(3);
    });
  });

  describe('LayoutType', () => {
    it('should export LAYOUTS constant', () => {
      expect(LAYOUTS).toContain('detailed');
      expect(LAYOUTS).toContain('minimal');
      expect(LAYOUTS).toContain('fullscreen');
      expect(LAYOUTS).toContain('ambient');
      expect(LAYOUTS).toContain('cover');
    });

    it('should have correct number of layouts', () => {
      expect(LAYOUTS).toHaveLength(9);
    });
  });

  describe('FontType', () => {
    it('should export FONTS constant', () => {
      expect(FONTS).toContain('system');
      expect(FONTS).toContain('patua-one');
      expect(FONTS).toContain('comfortaa');
      expect(FONTS).toContain('noto-sans-display');
      expect(FONTS).toContain('coda');
      expect(FONTS).toContain('bellota-text');
      expect(FONTS).toContain('big-shoulders');
    });

    it('should have correct number of fonts', () => {
      expect(FONTS).toHaveLength(7);
    });

    it('should have FONT_CONFIG for each font', () => {
      for (const font of FONTS) {
        expect(FONT_CONFIG[font]).toBeDefined();
        expect(FONT_CONFIG[font].displayName).toBeTruthy();
      }
    });

    it('should have null googleFont for system font only', () => {
      expect(FONT_CONFIG['system'].googleFont).toBeNull();
      for (const font of FONTS) {
        if (font !== 'system') {
          expect(FONT_CONFIG[font].googleFont).toBeTruthy();
        }
      }
    });
  });

  describe('ClientMessage', () => {
    it('should allow subscribe message', () => {
      const msg: ClientMessage = {
        type: 'subscribe',
        zone_id: '123',
      };
      expect(msg.type).toBe('subscribe');
    });

    it('should allow unsubscribe message', () => {
      const msg: ClientMessage = {
        type: 'unsubscribe',
      };
      expect(msg.type).toBe('unsubscribe');
    });
  });

  describe('ServerMessage', () => {
    it('should allow zones message', () => {
      const msg: ServerMessage = {
        type: 'zones',
        zones: [{ id: '1', display_name: 'Zone 1' }],
      };
      expect(msg.type).toBe('zones');
    });

    it('should allow now_playing message', () => {
      const msg: ServerMessage = {
        type: 'now_playing',
        zone_id: '123',
        state: 'playing',
        track: null,
        seek_position: 0,
      };
      expect(msg.type).toBe('now_playing');
    });

    it('should allow seek message', () => {
      const msg: ServerMessage = {
        type: 'seek',
        zone_id: '123',
        seek_position: 42,
      };
      expect(msg.type).toBe('seek');
    });
  });

describe('Facts Types', () => {
    it('should include facts layouts in LAYOUTS', () => {
      expect(LAYOUTS).toContain('facts-columns');
      expect(LAYOUTS).toContain('facts-overlay');
      expect(LAYOUTS).toContain('facts-carousel');
    });

    it('should have correct total number of layouts', () => {
      expect(LAYOUTS).toHaveLength(9); // 5 existing + 3 facts + 1 basic
    });

    it('should export LLM_PROVIDERS constant', () => {
      expect(LLM_PROVIDERS).toContain('anthropic');
      expect(LLM_PROVIDERS).toContain('openai');
    });

    it('should export LLM_MODELS for each provider', () => {
      expect(LLM_MODELS.anthropic).toContain('claude-sonnet-4-20250514');
      expect(LLM_MODELS.anthropic).toContain('claude-haiku-4-20250514');
      expect(LLM_MODELS.openai).toContain('gpt-4o');
      expect(LLM_MODELS.openai).toContain('gpt-4o-mini');
    });
  });

  describe('LLM_PROVIDERS and LLM_MODELS', () => {
    it('should include openrouter in LLM_PROVIDERS', () => {
      expect(LLM_PROVIDERS).toContain('openrouter');
    });

    it('should include local in LLM_PROVIDERS', () => {
      expect(LLM_PROVIDERS).toContain('local');
    });

    it('should have correct number of LLM_PROVIDERS', () => {
      expect(LLM_PROVIDERS).toHaveLength(4);
    });

    it('should have openrouter models including custom option', () => {
      expect(LLM_MODELS.openrouter).toContain('meta-llama/llama-3.1-70b-instruct');
      expect(LLM_MODELS.openrouter).toContain('custom');
    });

    it('should have empty local models array', () => {
      expect(LLM_MODELS.local).toEqual([]);
    });
  });

  describe('BACKGROUNDS', () => {
    it('should include all 14 background types', () => {
      expect(BACKGROUNDS).toContain('black');
      expect(BACKGROUNDS).toContain('white');
      expect(BACKGROUNDS).toContain('dominant');
      expect(BACKGROUNDS).toContain('gradient-radial');
      expect(BACKGROUNDS).toContain('gradient-linear');
      // New types
      expect(BACKGROUNDS).toContain('gradient-linear-multi');
      expect(BACKGROUNDS).toContain('gradient-radial-corner');
      expect(BACKGROUNDS).toContain('gradient-mesh');
      expect(BACKGROUNDS).toContain('blur-subtle');
      expect(BACKGROUNDS).toContain('blur-heavy');
      expect(BACKGROUNDS).toContain('duotone');
      expect(BACKGROUNDS).toContain('posterized');
      expect(BACKGROUNDS).toContain('gradient-noise');
      expect(BACKGROUNDS).toContain('blur-grain');
      expect(BACKGROUNDS.length).toBe(14);
    });

    it('should have display names for all background types', () => {
      for (const bg of BACKGROUNDS) {
        expect(BACKGROUND_CONFIG[bg]).toBeDefined();
        expect(BACKGROUND_CONFIG[bg].displayName).toBeTruthy();
      }
    });

    it('should have category for all background types', () => {
      for (const bg of BACKGROUNDS) {
        expect(BACKGROUND_CONFIG[bg].category).toMatch(/^(basic|gradient|artwork|textured)$/);
      }
    });
  });
});
