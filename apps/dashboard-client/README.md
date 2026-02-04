# Dashboard Client

> Modern React-based UI for the Agnostic Automation Center

Built with React 18, TypeScript, Vite, and Tailwind CSS. Provides real-time test monitoring, team management, and organization settings.

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
- Tailwind CSS responsive design
- Mobile-first approach
- Tablet and desktop optimizations

---

## 🛠️ Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool (lightning fast HMR)
- **Tailwind CSS** - Utility-first styling
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

## 🎨 Styling with Tailwind CSS

### Responsive Breakpoints

```javascript
// Mobile first (default)
className="text-sm p-4"

// Tablet (640px+)
className="sm:text-base sm:p-6"

// Desktop (1024px+)
className="lg:text-lg lg:p-8"
```

### Component Patterns

**Responsive Grid:**
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Cards */}
</div>
```

**Responsive Text:**
```tsx
<h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
  Title
</h1>
```

**Horizontal Scroll (Mobile):**
```tsx
<div className="overflow-x-auto">
  <table className="min-w-full">
    {/* Table content */}
  </table>
</div>
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

### Tailwind Config

See `tailwind.config.js` for styling configuration:
```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
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
2. Use Tailwind CSS for styling (no inline styles)
3. Maintain mobile-responsive design (mobile-first)
4. Use TypeScript for type safety
5. Test on multiple screen sizes

---

**Built with React + Vite + Tailwind CSS**
