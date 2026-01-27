/**
 * Test Plan: usePreferences Composable
 *
 * Scenario: Load preferences from URL params
 *   Given URL contains zone and layout params
 *   When loadPreferences is called
 *   Then preferences should match URL params
 *
 * Scenario: Fall back to localStorage
 *   Given no URL params but localStorage has values
 *   When loadPreferences is called
 *   Then preferences should match localStorage values
 *
 * Scenario: Save zone preference
 *   Given a zone is selected
 *   When saveZonePreference is called
 *   Then localStorage should be updated
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePreferences } from './usePreferences';

describe('usePreferences', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset URL
    window.history.replaceState({}, '', '/');
  });

  it('should initialize with default layout', () => {
    const { layout } = usePreferences();
    expect(layout.value).toBe('detailed');
  });

  it('should load zone from URL param', () => {
    window.history.replaceState({}, '', '/?zone=Living%20Room');

    const { preferredZone, loadPreferences } = usePreferences();
    loadPreferences();

    expect(preferredZone.value).toBe('Living Room');
  });

  it('should load layout from URL param', () => {
    window.history.replaceState({}, '', '/?layout=minimal');

    const { layout, loadPreferences } = usePreferences();
    loadPreferences();

    expect(layout.value).toBe('minimal');
  });

  it('should fall back to localStorage when no URL params', () => {
    localStorage.setItem('roon-screen-cover:zone', 'Office');
    localStorage.setItem('roon-screen-cover:layout', 'fullscreen');

    const { preferredZone, layout, loadPreferences } = usePreferences();
    loadPreferences();

    expect(preferredZone.value).toBe('Office');
    expect(layout.value).toBe('fullscreen');
  });

  it('should save zone preference to localStorage', () => {
    const { saveZonePreference, preferredZone } = usePreferences();

    saveZonePreference('Kitchen');

    expect(preferredZone.value).toBe('Kitchen');
    expect(localStorage.getItem('roon-screen-cover:zone')).toBe('Kitchen');
  });

  it('should save layout preference to localStorage', () => {
    const { saveLayoutPreference, layout } = usePreferences();

    saveLayoutPreference('minimal');

    expect(layout.value).toBe('minimal');
    expect(localStorage.getItem('roon-screen-cover:layout')).toBe('minimal');
  });

  it('should clear zone preference', () => {
    localStorage.setItem('roon-screen-cover:zone', 'Office');

    const { clearZonePreference, preferredZone, loadPreferences } = usePreferences();
    loadPreferences();

    expect(preferredZone.value).toBe('Office');

    clearZonePreference();

    expect(preferredZone.value).toBeNull();
    expect(localStorage.getItem('roon-screen-cover:zone')).toBeNull();
  });

  it('should ignore invalid layout in URL', () => {
    window.history.replaceState({}, '', '/?layout=invalid');

    const { layout, loadPreferences } = usePreferences();
    loadPreferences();

    expect(layout.value).toBe('detailed'); // Default
  });

  it('should prioritize URL params over localStorage', () => {
    localStorage.setItem('roon-screen-cover:layout', 'fullscreen');
    window.history.replaceState({}, '', '/?layout=minimal');

    const { layout, loadPreferences } = usePreferences();
    loadPreferences();

    expect(layout.value).toBe('minimal');
  });
});
