# Dashboard Client

> Modern React-based UI for the Agnostic Automation Center

Built with React 19, TypeScript, Vite, and Tailwind CSS. Provides real-time test monitoring, team management, and organization settings — with a full GitHub-style light/dark mode.

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

### Visual Identity & Theming
- **Dynamic Logo Switching** — black logo in light mode, white logo in dark mode (driven by `ThemeContext`)
- **GitHub-style Dark Mode** — full `dark:` Tailwind class coverage on every surface (sidebar, header, tables, modals, filter bar, settings tabs)
- **Semantic Token Palette** — `gh-bg`, `gh-border`, `gh-text`, `gh-accent` tokens map exactly to GitHub's `#0d1117` / `#161b22` / `#30363d` dark surfaces and `#ffffff` / `#f6f8fa` light surfaces
- **Zero flash** — theme is read from `localStorage` before first paint so the correct `dark` class is applied to `<html>` on load

### Mobile Responsive
- Tailwind CSS responsive design (utility classes + responsive prefixes)
- Mobile-first approach with `useIsMobile` hook for complex layout switches
- Tablet and desktop optimizations

---

## 🛠️ Technology Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool (lightning fast HMR)
- **Tailwind CSS** - Utility-first styling with `dark:` class-based theming
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
│       ├── ProfileTab.tsx
│       ├── OrganizationTab.tsx
│       ├── MembersTab.tsx
│       ├── BillingTab.tsx
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

## 🎨 Styling & Visual Identity

### Styling Approach

This project uses **Tailwind CSS** (utility classes, no inline styles, no separate CSS modules) for maximum consistency and dark mode support.

```tsx
// Component example — Tailwind only, no style={{ ... }}
<div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gh-bg-dark border border-slate-200 dark:border-gh-border-dark rounded-xl">
  <span className="text-sm font-semibold text-slate-900 dark:text-gh-text-dark">Label</span>
</div>
```

### GitHub-style Dark Mode

Dark mode is driven by the `ThemeContext` which:
1. Reads `localStorage.getItem('aac:theme')` on mount (default `'light'`)
2. Applies/removes the `dark` class on `<html>` before first paint — **zero flash**
3. Exposes `useTheme()` → `{ theme, toggleTheme }` to any component

```tsx
import { useTheme } from '../context/ThemeContext';

function MyComponent() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>{theme === 'dark' ? 'Light' : 'Dark'}</button>;
}
```

### Semantic Token Palette (`tailwind.config.js`)

| Token | Light value | Dark counterpart |
|-------|------------|-----------------|
| `gh-bg` | `#ffffff` | `gh-bg-dark` → `#0d1117` |
| `gh-bg-subtle` | `#f6f8fa` | `gh-bg-subtle-dark` → `#161b22` |
| `gh-border` | `#d0d7de` | `gh-border-dark` → `#30363d` |
| `gh-text` | `#1f2328` | `gh-text-dark` → `#e6edf3` |
| `gh-accent` | `#0969da` | `gh-accent-dark` → `#2f81f7` |

### Dynamic Logo Switching

The sidebar logo switches automatically based on the active theme:
- **Light mode** → black logo (`logo-full.png`)
- **Dark mode** → white logo (`logo.png`)

This is handled in `Sidebar.tsx` via the `useTheme()` hook — no CSS filter tricks needed.

### Responsive Design Patterns

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

// Usage: switch between table (desktop) and card (mobile) layouts
const isMobile = useIsMobile();
{isMobile ? <MemberCards ... /> : <MemberTable ... />}
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

### Tailwind Token Reference

Custom semantic tokens are defined in `tailwind.config.js` under `theme.extend.colors`:
```js
// Usage in components
'bg-white dark:bg-gh-bg-dark'         // card background
'border-slate-200 dark:border-gh-border-dark'  // borders
'text-slate-900 dark:text-gh-text-dark'        // primary text
'text-gh-accent dark:text-gh-accent-dark'      // links / active states
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
2. Use **Tailwind CSS only** — no inline `style={{...}}` props, no new CSS files
3. Every surface must have a `dark:` counterpart using the `gh-*` semantic tokens
4. Use TypeScript for type safety
5. Test on multiple screen sizes in both light and dark mode
6. Never use `console.log` — use the designated logger utilities
7. All new API calls must include the `organizationId` tenant filter

---

**Built with React 19 + Vite + Tailwind CSS + GitHub-style Dark Mode**
