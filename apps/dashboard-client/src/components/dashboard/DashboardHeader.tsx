import { LogOut, Menu, X, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

interface User {
  name?: string;
  email?: string;
  organizationName?: string;
  role?: string;
}

interface DashboardHeaderProps {
  user: User | null;
  onLogout: () => void;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
}

export function DashboardHeader({
  user,
  onLogout,
  mobileMenuOpen,
  onToggleMobileMenu
}: DashboardHeaderProps) {
  return (
    <>
      <style>
        {`
        .dashboard-header {
          background: linear-gradient(to right, #ffffff, #f8fafc);
          border-bottom: 1px solid #e2e8f0;
          padding: 0 24px;
          height: 72px;
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
          border-radius: 10px;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .user-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-details {
          text-align: right;
          display: flex;
          flex-direction: column;
        }

        .divider {
          height: 32px;
          width: 1px;
          background: linear-gradient(to bottom, transparent, #e2e8f0, transparent);
          display: block;
        }

        .org-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .role-badge {
          padding: 5px 12px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          background: linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%);
          color: #667eea;
          border: 1px solid #c7d2fe;
          letter-spacing: 0.03em;
        }

        .logout-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
          color: #64748b;
          font-weight: 500;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          cursor: pointer;
          padding: 8px 16px;
          border-radius: 8px;
          transition: all 0.2s ease;
          height: 38px;
          white-space: nowrap;
        }

        .logout-btn:hover {
          background-color: #fef2f2;
          border-color: #fecaca;
          color: #ef4444;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(239, 68, 68, 0.15);
        }

        .mobile-menu-btn {
          display: none;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          cursor: pointer;
          color: #64748b;
          transition: all 0.2s ease;
        }

        .mobile-menu-btn:hover {
          background-color: #f1f5f9;
          color: #475569;
        }

        .mobile-dropdown {
          display: none;
          position: absolute;
          top: 80px;
          left: 20px;
          right: 20px;
          background: linear-gradient(to bottom, #ffffff, #f8fafc);
          border-bottom: 1px solid #e2e8f0;
          border-radius: 0 0 10px 10px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          padding: 20px 24px;
          flex-direction: column;
          gap: 16px;
          z-index: 99;
          animation: slideDown 0.2s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .mobile-dropdown.open {
          display: flex;
        }

        .mobile-user-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          background-color: #ffffff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .mobile-logout-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 14px;
          color: #ef4444;
          font-weight: 600;
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          cursor: pointer;
          padding: 14px 16px;
          border-radius: 10px;
          transition: all 0.2s ease;
          width: 100%;
        }

        .mobile-logout-btn:hover {
          background-color: #fee2e2;
          transform: translateY(-1px);
        }

        @media (max-width: 768px) {
          .dashboard-header {
            height: 64px;
            padding: 0 16px;
            border-radius: 10px 10px 0 0;
          }

          .header-right {
            display: none;
          }

          .org-info {
            display: none;
          }

          .divider {
            display: none;
          }

          .mobile-menu-btn {
            display: flex;
          }
        }

        @media (min-width: 769px) {
          .mobile-dropdown {
            display: none !important;
          }
        }
        `}
      </style>

      <div className="dashboard-header">
        {/* Left side - Logo and Organization */}
        <div className="header-left">
          <div style={{
            width: '42px',
            height: '42px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 800,
            fontSize: '14px',
            letterSpacing: '-0.5px',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.35)',
            flexShrink: 0
          }}>
            AAC
          </div>

          <div className="divider"></div>

          <div className="org-info">
            <h2 style={{
              fontSize: '15px',
              fontWeight: 600,
              color: '#1e293b',
              margin: 0,
              lineHeight: 1.3,
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {user?.organizationName || 'Organization'}
            </h2>
            <span style={{
              fontSize: '11px',
              color: '#94a3b8',
              textTransform: 'uppercase',
              fontWeight: 600,
              letterSpacing: '0.05em'
            }}>
              Organization
            </span>
          </div>
        </div>

        {/* Right side - Desktop */}
        <div className="header-right">
          <Link
            to="/settings"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#64748b',
              textDecoration: 'none',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#f1f5f9';
              e.currentTarget.style.color = '#475569';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.color = '#64748b';
            }}
          >
            <Settings size={18} />
            Settings
          </Link>

          <div className="user-section">
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%)',
              border: '2px solid #ffffff',
              boxShadow: '0 0 0 1px #e0e7ff',
              color: '#667eea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '16px',
              flexShrink: 0
            }}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>

            <div className="user-details">
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>
                {user?.name || 'User'}
              </span>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                {user?.email || 'email@example.com'}
              </span>
            </div>
          </div>

          <span className="role-badge">{user?.role || 'user'}</span>

          <button onClick={onLogout} className="logout-btn">
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>

        {/* Mobile menu button */}
        <button
          className="mobile-menu-btn"
          onClick={onToggleMobileMenu}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      <div className={`mobile-dropdown ${mobileMenuOpen ? 'open' : ''}`}>
        {/* Organization info & Role Badge Container */}
        <div style={{
          padding: '8px 0',
          borderBottom: '1px solid #f1f5f9',
          marginBottom: '4px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Left Side: Organization Name */}
            <div>
              <span style={{
                fontSize: '11px',
                color: '#94a3b8',
                textTransform: 'uppercase',
                fontWeight: 600,
                letterSpacing: '0.05em'
              }}>
                Organization
              </span>
              <h3 style={{
                margin: '4px 0 0 0',
                fontSize: '17px',
                fontWeight: 600,
                color: '#1e293b'
              }}>
                {user?.organizationName || 'Organization'}
              </h3>
            </div>

            {/* Right Side: Role Badge */}
            <span className="role-badge">
              {user?.role || 'user'}
            </span>
          </div>
        </div>

        {/* User card */}
        <div className="mobile-user-card">
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%)',
            border: '2px solid #ffffff',
            boxShadow: '0 0 0 1px #e0e7ff',
            color: '#667eea',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '18px',
            flexShrink: 0
          }}>
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#334155' }}>
              {user?.name || 'User'}
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
              {user?.email || 'email@example.com'}
            </div>
          </div>
        </div>

        {/* Settings Link */}
        <Link
          to="/settings"
          onClick={onToggleMobileMenu}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 16px',
            fontSize: '15px',
            fontWeight: 600,
            color: '#334155',
            textDecoration: 'none',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            transition: 'all 0.2s ease',
          }}
        >
          <Settings size={18} />
          <span>Settings</span>
        </Link>

        {/* Logout button */}
        <button
          onClick={() => {
            onToggleMobileMenu();
            onLogout();
          }}
          className="mobile-logout-btn"
        >
          <LogOut size={18} />
          <span>Sign out</span>
        </button>
      </div>
    </>
  );
}
