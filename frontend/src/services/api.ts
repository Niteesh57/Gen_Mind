export interface UserData {
  id: string;
  name: string;
  role: string;
  efficiency: number;
  status: 'active' | 'idle' | 'offline';
}

export interface MetricSummary {
  totalUsers: number;
  activeSessions: number;
  averageEfficiency: number;
}

export interface DashboardData {
  metrics: MetricSummary;
  users: UserData[];
}

// DIP: Abstraction that components or hooks depend upon, rather than concrete fetch logic.
export interface IApiService {
  getDashboardData(): Promise<DashboardData>;
}

// LSP: Concrete HTTP implementation that satisfies the interface.
export class HttpApiService implements IApiService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async getDashboardData(): Promise<DashboardData> {
    const response = await fetch(`${this.baseUrl}/api/dashboard`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }
}

// LSP: Mock implementation that can be substituted seamlessly for local testing or demo mode.
export class MockApiService implements IApiService {
  async getDashboardData(): Promise<DashboardData> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      metrics: {
        totalUsers: 1420,
        activeSessions: 843,
        averageEfficiency: 94.6,
      },
      users: [
        { id: '1', name: 'Alex Rivera', role: 'Lead Architect', efficiency: 98, status: 'active' },
        { id: '2', name: 'Sophia Chen', role: 'Senior Frontend Engineer', efficiency: 95, status: 'active' },
        { id: '3', name: 'Marcus Vance', role: 'DevOps Engineer', efficiency: 89, status: 'idle' },
        { id: '4', name: 'Elena Rostova', role: 'Security Engineer', efficiency: 96, status: 'active' },
        { id: '5', name: 'Akiro Tanaka', role: 'Data Scientist', efficiency: 91, status: 'offline' },
      ],
    };
  }
}
