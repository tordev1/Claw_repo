import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock the api module before importing Dashboard
vi.mock('../services/api', () => ({
  projectsApi: {
    list: vi.fn().mockResolvedValue({
      projects: [
        { id: 'p1', name: 'Project Alpha', status: 'active', type: 'saas', stats: { activeTasks: 3, totalTasks: 10, todayCost: 0.5, monthCost: 12, monthBudget: 100 } },
        { id: 'p2', name: 'Project Beta', status: 'standby', type: 'content', stats: { activeTasks: 0, totalTasks: 5, todayCost: 0, monthCost: 3, monthBudget: 50 } },
      ],
    }),
  },
  machinesApi: {
    list: vi.fn().mockResolvedValue({
      machines: [
        { id: 'm1', hostname: 'mac-mini-01', ip_address: '192.168.1.10', last_seen: new Date().toISOString() },
      ],
    }),
    delete: vi.fn().mockResolvedValue({ success: true }),
  },
  agentsApi: {
    list: vi.fn().mockResolvedValue({
      agents: [
        { id: 'a1', name: 'Agent-1', status: 'online' },
        { id: 'a2', name: 'Agent-2', status: 'offline' },
      ],
    }),
  },
  costsApi: {
    getSummary: vi.fn().mockResolvedValue({ total: 15.5 }),
  },
}));

import Dashboard from './Dashboard';

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    expect(screen.getByText('LOADING DASHBOARD...')).toBeInTheDocument();
  });

  it('renders stat cards after loading', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('LOADING DASHBOARD...')).not.toBeInTheDocument();
    });

    // Should show agent count
    expect(screen.getByText('2')).toBeInTheDocument();
    // Should show active projects count
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders project list after loading', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });
    expect(screen.getByText('Project Beta')).toBeInTheDocument();
  });

  it('renders machine fleet section', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('mac-mini-01')).toBeInTheDocument();
    });
  });

  it('handles API failure gracefully', async () => {
    const { projectsApi } = await import('../services/api');
    (projectsApi.list as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('LOADING DASHBOARD...')).not.toBeInTheDocument();
    });
  });
});
