/**
 * Test Plan: Logger
 *
 * Scenario: Log messages at different levels
 *   Given the logger is configured
 *   When logging at various levels
 *   Then only messages at or above the configured level should appear
 *
 * Scenario: Log formatting
 *   Given a log message
 *   When it is logged
 *   Then it should include timestamp, level, and message
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Logger', () => {
  const originalEnv = process.env.LOG_LEVEL;

  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.LOG_LEVEL = originalEnv;
  });

  it('should export logger object with all methods', async () => {
    const { logger } = await import('./logger.js');

    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should call console methods when logging', async () => {
    process.env.LOG_LEVEL = 'debug';

    // Re-import to pick up new env
    vi.resetModules();
    const { logger } = await import('./logger.js');

    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');

    expect(console.debug).toHaveBeenCalled();
    expect(console.info).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it('should include timestamp in log output', async () => {
    process.env.LOG_LEVEL = 'info';
    vi.resetModules();
    const { logger } = await import('./logger.js');

    logger.info('test message');

    expect(console.info).toHaveBeenCalledWith(
      expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
      // No additional args for this call
    );
  });

  it('should include level in log output', async () => {
    process.env.LOG_LEVEL = 'info';
    vi.resetModules();
    const { logger } = await import('./logger.js');

    logger.info('test message');

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('[INFO]'),
    );
  });

  it('should pass additional arguments to console', async () => {
    process.env.LOG_LEVEL = 'info';
    vi.resetModules();
    const { logger } = await import('./logger.js');

    const extraData = { key: 'value' };
    logger.info('test message', extraData);

    expect(console.info).toHaveBeenCalledWith(
      expect.any(String),
      extraData,
    );
  });
});
