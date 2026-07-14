import { describe, it, expect } from 'vitest';
import { MockApiService, type IApiService } from './api';

describe('SOLID API Service Layer Tests', () => {
  it('should substitute API service implementations seamlessly (LSP & DIP)', async () => {
    // We declare a reference using the generic abstraction interface
    const apiService: IApiService = new MockApiService();
    
    // We trigger the method defined in the abstraction
    const data = await apiService.getDashboardData();

    // Verify properties match structure
    expect(data).toHaveProperty('metrics');
    expect(data).toHaveProperty('users');
    expect(data.metrics.totalUsers).toBeGreaterThan(0);
    expect(data.users.length).toBeGreaterThan(0);
    expect(data.users[0]).toHaveProperty('name');
    expect(data.users[0]).toHaveProperty('efficiency');
  });
});
