/**
 * Test Plan: ExternalSourceManager
 *
 * Scenario: Create a new zone on first update
 *   Given an external source manager with no zones
 *   When updateZone is called for a new zone
 *   Then a new zone should be created with the provided data
 *   And the zones list should contain the new zone
 *
 * Scenario: Emit zones event on new zone
 *   Given an external source manager
 *   When a new zone is created
 *   Then a 'zones' event should be emitted
 *
 * Scenario: Emit now_playing event on update
 *   Given an external source manager
 *   When updateZone is called
 *   Then a 'now_playing' event should be emitted with track data
 *
 * Scenario: Update existing zone without emitting zones event
 *   Given an external source manager with an existing zone
 *   When updateZone is called for that zone
 *   Then 'now_playing' should be emitted
 *   But 'zones' should not be emitted
 *
 * Scenario: Remove zone and emit zones event
 *   Given an external source manager with a zone
 *   When deleteZone is called
 *   Then the zone should be removed
 *   And a 'zones' event should be emitted
 *
 * Scenario: Return false for non-existent zone deletion
 *   Given an external source manager with no zones
 *   When deleteZone is called for a non-existent zone
 *   Then it should return false
 *
 * Scenario: Return null for non-existent zone now playing
 *   Given an external source manager with no zones
 *   When getNowPlaying is called for a non-existent zone
 *   Then it should return null
 *
 * Scenario: Return now playing for existing zone
 *   Given an external source manager with a zone
 *   When getNowPlaying is called for that zone
 *   Then it should return the now playing data
 *
 * Scenario: Return all external zones with metadata
 *   Given an external source manager with zones
 *   When getExternalZones is called
 *   Then it should return all zones with source status
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { ExternalSourceManager } from './externalSources.js';

const TEST_ZONES_PATH = './test-external-zones.json';

describe('ExternalSourceManager', () => {
  let manager: ExternalSourceManager;

  beforeEach(() => {
    manager = new ExternalSourceManager(TEST_ZONES_PATH);
  });

  afterEach(async () => {
    manager.stopTimeoutChecker();
    try {
      await fs.unlink(TEST_ZONES_PATH);
    } catch {
      // File may not exist
    }
  });

  describe('updateZone', () => {
    it('should create a new zone on first update', async () => {
      const result = await manager.updateZone('spotify-office', {
        zone_name: 'Office Spotify',
        state: 'playing',
        title: 'Test Song',
        artist: 'Test Artist',
      });

      expect(result.success).toBe(true);
      expect(result.zone_id).toBe('spotify-office');

      const zones = manager.getZones();
      expect(zones).toHaveLength(1);
      expect(zones[0].id).toBe('spotify-office');
      expect(zones[0].display_name).toBe('Office Spotify');
    });

    it('should emit zones event on new zone', async () => {
      const zonesHandler = vi.fn();
      manager.on('zones', zonesHandler);

      await manager.updateZone('spotify-office', {
        zone_name: 'Office Spotify',
        state: 'playing',
        title: 'Test Song',
        artist: 'Test Artist',
      });

      expect(zonesHandler).toHaveBeenCalledTimes(1);
    });

    it('should emit now_playing event on update', async () => {
      const nowPlayingHandler = vi.fn();
      manager.on('now_playing', nowPlayingHandler);

      await manager.updateZone('spotify-office', {
        zone_name: 'Office Spotify',
        state: 'playing',
        title: 'Test Song',
        artist: 'Test Artist',
        album: 'Test Album',
        duration_seconds: 180,
        seek_position: 45,
      });

      expect(nowPlayingHandler).toHaveBeenCalledWith({
        zone_id: 'spotify-office',
        state: 'playing',
        track: {
          title: 'Test Song',
          artist: 'Test Artist',
          album: 'Test Album',
          duration_seconds: 180,
          artwork_key: null,
        },
        seek_position: 45,
      });
    });

    it('should update existing zone without emitting zones event', async () => {
      await manager.updateZone('spotify-office', {
        zone_name: 'Office Spotify',
        state: 'playing',
        title: 'Song 1',
        artist: 'Artist 1',
      });

      const zonesHandler = vi.fn();
      manager.on('zones', zonesHandler);

      await manager.updateZone('spotify-office', {
        zone_name: 'Office Spotify',
        state: 'playing',
        title: 'Song 2',
        artist: 'Artist 2',
      });

      expect(zonesHandler).not.toHaveBeenCalled();
    });
  });

  describe('deleteZone', () => {
    it('should remove zone and emit zones event', async () => {
      await manager.updateZone('spotify-office', {
        zone_name: 'Office Spotify',
        state: 'stopped',
      });

      const zonesHandler = vi.fn();
      manager.on('zones', zonesHandler);

      const result = manager.deleteZone('spotify-office');
      expect(result).toBe(true);
      expect(manager.getZones()).toHaveLength(0);
      expect(zonesHandler).toHaveBeenCalledWith([]);
    });

    it('should return false for non-existent zone', () => {
      const result = manager.deleteZone('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getNowPlaying', () => {
    it('should return null for non-existent zone', () => {
      expect(manager.getNowPlaying('non-existent')).toBeNull();
    });

    it('should return now playing for existing zone', async () => {
      await manager.updateZone('spotify-office', {
        zone_name: 'Office Spotify',
        state: 'playing',
        title: 'Test Song',
        artist: 'Test Artist',
      });

      const nowPlaying = manager.getNowPlaying('spotify-office');
      expect(nowPlaying).not.toBeNull();
      expect(nowPlaying?.zone_id).toBe('spotify-office');
      expect(nowPlaying?.track?.title).toBe('Test Song');
    });
  });

  describe('getExternalZones', () => {
    it('should return all external zones with metadata', async () => {
      await manager.updateZone('spotify-office', {
        zone_name: 'Office Spotify',
        state: 'playing',
        title: 'Test Song',
        artist: 'Test Artist',
      });

      const zones = manager.getExternalZones();
      expect(zones).toHaveLength(1);
      expect(zones[0].zone_id).toBe('spotify-office');
      expect(zones[0].source_status).toBe('connected');
    });
  });
});
