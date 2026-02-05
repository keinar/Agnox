# Dashboard Client

> Modern React-based UI for the Agnostic Automation Center

Built with React 19, TypeScript, Vite, and Pure CSS. Provides real-time test monitoring, team management, and organization settings.

---

## 🚀 Features

### Real-Time Test Monitoring
- Live test logs via WebSocket (Socket.io)
- Execution status updates in real-time
- AI-powered root cause analysis display

### Team Management
- Invite team members via email
- Role management (Admin, Developer, Viewer)
- User list with status indicators

### Organization Settings
- Organization details and configuration
- Plan limits and usage tracking
- AI analysis privacy controls
- Security settings

### Mobile Responsive
- Pure CSS responsive design (inline styles + custom CSS)
- Mobile-first approach
- Tablet and desktop optimizations

---

## 🛠️ Technology Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool (lightning fast HMR)
- **Pure CSS** - Inline styles + custom CSS modules
- **Socket.io Client** - Real-time WebSocket
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Lucide React** - Icon library

---

## 📁 Project Structure

```
src/
├── components/           # Reusable components
│   ├── Dashboard.tsx    # Main dashboard view
│   ├── ExecutionModal.tsx
│   └── settings/        # Settings components
│       ├── OrganizationTab.tsx
│       ├── MembersTab.tsx
│       ├── SecurityTab.tsx
│       ├── UsageTab.tsx
│       └── InviteModal.tsx
├── pages/               # Route pages
│   ├── Login.tsx
│   ├── Signup.tsx
│   └── Settings.tsx
├── context/             # React context providers
│   └── AuthContext.tsx  # Global auth state
├── hooks/               # Custom React hooks
│   └── useSettings.ts   # Settings data management
└── main.tsx            # App entry point
```

---

## 🚀 Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
# Open http://localhost:5173
```

### Build for Production
```bash
npm run build
# Output: dist/
```

### Preview Production Build
```bash
npm run preview
```

---

## 🔌 API Integration

The dashboard connects to the Producer Service API:

**Local Development:**
```env
VITE_API_URL=http://localhost:3000
```

**Production:**
```env
VITE_API_URL=https://your-api-domain.com
```

### WebSocket Connection

```typescript
import io from 'socket.io-client';

const socket = io(API_URL, {
  auth: {
    token: localStorage.getItem('jwt_token')
  }
});

// Listen for real-time updates
socket.on('execution-updated', (data) => {
  // Update UI
});

socket.on('execution-log', ({ taskId, log }) => {
  // Display live logs
});
```

---

## 🎨 Styling with Pure CSS

### Styling Approach

This project uses **Pure CSS** (inline styles + custom CSS files) for maximum control and performance.

**Inline Styles (Preferred for component-specific styling):**
```tsx
<div style={{
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '16px',
  backgroundColor: '#1e293b',
  borderRadius: '8px'
}}>
  {/* Component content */}
</div>
```

**Custom CSS Classes (Shared styles in App.css):**
```tsx
// App.css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
}

// Component
<span className="badge passed">PASSED</span>
```

### Responsive Design Patterns

**Media Queries (CSS):**
```css
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
```

**Responsive Hook (TypeScript):**
```tsx
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}

// Usage
const isMobile = useIsMobile();
{isMobile ? <MobileView /> : <DesktopView />}
```

---

## 🔐 Authentication

### Auth Context

The dashboard uses React Context for global authentication state:

```tsx
import { useAuth } from '../context/AuthContext';

function MyComponent() {
  const { user, token, login, logout, isAuthenticated } = useAuth();

  // Access user info
  console.log(user?.email, user?.role, user?.organizationName);

  // Check if authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return <div>Protected content</div>;
}
```

### Protected Routes

```tsx
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

function ProtectedPage() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return <div>Protected content</div>;
}
```

---

## 🧪 Testing

### Run Tests
```bash
npm test
```

### Test Structure
```
src/
└── __tests__/
    ├── components/
    ├── pages/
    └── hooks/
```

---

## 📦 Build & Deploy

### Environment Variables

Create `.env` file:
```env
VITE_API_URL=http://localhost:3000
```

### Docker Build

The dashboard is built and served via Docker Compose:

```yaml
# docker-compose.yml
services:
  dashboard-client:
    build:
      context: ./apps/dashboard-client
      dockerfile: Dockerfile
    ports:
      - "8080:80"
    environment:
      - VITE_API_URL=${API_URL}
```

### Production Deployment

**Option 1: Docker Compose** (recommended)
```bash
docker-compose -f docker-compose.prod.yml up -d
```

**Option 2: Static Hosting** (Vercel, Netlify, S3)
```bash
npm run build
# Upload dist/ folder to hosting provider
```

---

## 🔧 Configuration

### Vite Config

See `vite.config.ts` for build configuration:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})
```

### CSS Variables

Global CSS variables are defined in `App.css`:
```css
:root {
  --bg-color: #0f172a;       /* Slate 900 */
  --card-bg: #1e293b;        /* Slate 800 */
  --text-primary: #f8fafc;   /* Slate 50 */
  --text-secondary: #94a3b8; /* Slate 400 */
  --accent-blue: #3b82f6;    /* Blue 500 */
  --border-color: #334155;   /* Slate 700 */
}

/* Usage */
.stat-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}
```

---

## 🐛 Troubleshooting

### Hot Reload Not Working

```bash
# Check Vite server is running
npm run dev

# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

### WebSocket Connection Failed

```bash
# Check API_URL is correct
console.log(import.meta.env.VITE_API_URL)

# Check JWT token exists
console.log(localStorage.getItem('jwt_token'))

# Check Producer Service is running
curl http://localhost:3000/api/auth/me
```

### Build Errors

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Check TypeScript errors
npm run build
```

---

## 📖 Related Documentation

- [Main README](../../README.md)
- [API Documentation](../../docs/api/README.md)
- [Architecture Overview](../../docs/architecture/overview.md)
- [Deployment Guide](../../docs/setup/deployment.md)

---

## 🤝 Contributing

When contributing to the dashboard:

1. Follow the existing component structure
2. Use Pure CSS (inline styles preferred, shared styles in App.css)
3. Maintain mobile-responsive design (mobile-first with useIsMobile hook)
4. Use TypeScript for type safety
5. Test on multiple screen sizes
6. Prefer inline styles for component-specific styling
7. Use CSS classes for shared/reusable styles

---

**Built with React 19 + Vite + Pure CSS**
