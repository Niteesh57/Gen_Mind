import React, { useState } from 'react';
import { useData } from './hooks/useData';
import { ApiProvider } from './context/ApiContext';
import styles from './App.module.css';

// SVG Icons defined locally to avoid external dependency issues
const DashboardIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
  </svg>
);

const UsersIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const BoltIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12" />
  </svg>
);

const AppContent: React.FC = () => {
  const { data, loading, error, refresh } = useData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    // Keep spin active slightly longer for visual satisfaction
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const filteredUsers = data?.users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className={styles.container}>
      {/* Sidebar Section */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}></div>
          <span className={styles.logoText}>GenMind AI</span>
        </div>
        
        <nav className={styles.nav}>
          <div 
            className={`${styles.navItem} ${activeTab === 'dashboard' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <DashboardIcon />
            <span>Dashboard</span>
          </div>
          <div 
            className={`${styles.navItem} ${activeTab === 'users' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <UsersIcon />
            <span>Team Overview</span>
          </div>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userProfile}>
            <div className={styles.avatar}></div>
            <div className={styles.profileInfo}>
              <span className={styles.profileName}>Admin Operator</span>
              <span className={styles.profileRole}>System Architect</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Board Section */}
      <main className={styles.mainContent}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.titleSection}>
            <h1>Control Panel</h1>
            <p>System Overview & Node Efficiency Analytics</p>
          </div>
          <div className={styles.actions}>
            <button 
              className={styles.refreshButton}
              onClick={handleRefresh}
              disabled={loading || isRefreshing}
            >
              <span className={`${styles.refreshIcon} ${isRefreshing ? styles.spinning : ''}`}>
                <RefreshIcon />
              </span>
              <span>{isRefreshing ? 'Syncing...' : 'Sync Database'}</span>
            </button>
          </div>
        </header>

        {error && (
          <div className={styles.errorAlert}>
            <strong>Error Syncing Data:</strong> {error.message}
          </div>
        )}

        {loading && !isRefreshing ? (
          <div className={styles.loadingSpinner}>
            <div className={styles.spinner}></div>
            <span>Fetching environment metrics...</span>
          </div>
        ) : (
          <>
            {/* Stats Metrics (SRP/OCP: Purely showing data structure from service) */}
            <section className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statHeader}>
                  <span className={styles.statTitle}>Total Monitored Nodes</span>
                  <div className={`${styles.statIconWrapper} ${styles.usersIconBg}`}>
                    <UsersIcon />
                  </div>
                </div>
                <span className={styles.statValue}>{data?.metrics.totalUsers ?? 0}</span>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statHeader}>
                  <span className={styles.statTitle}>Active Node Containers</span>
                  <div className={`${styles.statIconWrapper} ${styles.sessionsIconBg}`}>
                    <DashboardIcon />
                  </div>
                </div>
                <span className={styles.statValue}>{data?.metrics.activeSessions ?? 0}</span>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statHeader}>
                  <span className={styles.statTitle}>Mean Efficiency Metric</span>
                  <div className={`${styles.statIconWrapper} ${styles.efficiencyIconBg}`}>
                    <BoltIcon />
                  </div>
                </div>
                <span className={styles.statValue}>{data?.metrics.averageEfficiency ?? 0}%</span>
              </div>
            </section>

            {/* Interactive Section */}
            <section className={styles.tableCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                <h2 className={styles.tableTitle} style={{ margin: 0 }}>Active Node Operators</h2>
                <input 
                  type="text" 
                  placeholder="Filter nodes by operator or role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '14px',
                    width: '260px'
                  }}
                />
              </div>

              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Operator</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Efficiency Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <div className={styles.userNameCell}>
                              <div className={styles.userAvatar}>
                                {user.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <span style={{ fontWeight: 500 }}>{user.name}</span>
                            </div>
                          </td>
                          <td>
                            <span className={styles.userRole}>{user.role}</span>
                          </td>
                          <td>
                            <span className={`${styles.statusBadge} ${
                              user.status === 'active' ? styles.statusActive :
                              user.status === 'idle' ? styles.statusIdle : styles.statusOffline
                            }`}>
                              <span className={styles.pulseDot}></span>
                              <span style={{ textTransform: 'capitalize' }}>{user.status}</span>
                            </span>
                          </td>
                          <td>
                            <div className={styles.progressWrapper}>
                              <div className={styles.progressBarContainer}>
                                <div 
                                  className={styles.progressBar} 
                                  style={{ width: `${user.efficiency}%` }}
                                ></div>
                              </div>
                              <span className={styles.progressText}>{user.efficiency}%</span>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: '#6b7280', padding: '32px 0' }}>
                          No operators match your filter query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

// Wrap App component in the ApiProvider to satisfy DIP dependency resolution.
const App: React.FC = () => {
  return (
    <ApiProvider>
      <AppContent />
    </ApiProvider>
  );
};

export default App;
