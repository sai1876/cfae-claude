import { describe, it, expect } from 'vitest';
import * as dbService from '../lib/dbService';

describe('dbService barrel exports', () => {
  it('should still export expected functions from domain services', () => {
    // Check key functions are present and are indeed functions
    expect(typeof dbService.fetchMenuItems).toBe('function');
    expect(typeof dbService.fetchOffers).toBe('function');
    expect(typeof dbService.fetchOutlets).toBe('function');
    expect(typeof dbService.updateUserProfile).toBe('function');
    expect(typeof dbService.streamUserOrders).toBe('function');
    expect(typeof dbService.updateOrderStatus).toBe('function');
  });

  it('should not contain any unimplemented stubs', () => {
    for (const [_key, value] of Object.entries(dbService)) {
      if (typeof value === 'function') {
        expect(value.toString()).not.toContain('Unimplemented stub called');
      }
    }
  });
});
