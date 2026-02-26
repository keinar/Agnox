# Producer Service

> Backend API service for Agnox

High-performance Fastify-based API providing authentication, multi-tenant data management, real-time WebSocket updates, and test execution orchestration.

---

## 🚀 Features

- **RESTful API** - Complete API for test automation platform
- **Multi-Tenant** - Organization-based data isolation
- **Authentication** - JWT-based auth with bcrypt password hashing
- **RBAC** - Role-based access control (Admin/Developer/Viewer)
- **Real-time** - Socket.io WebSocket server for live updates
- **Rate Limiting** - Redis-based per-org and per-IP rate limiting
- **Billing** - Stripe subscription integration
- **Email** - SendGrid transactional emails

---

## 🛠️ Technology Stack

- **Fastify** - High-performance web framework
- **TypeScript** - Type-safe backend
- **MongoDB** - Multi-tenant data storage
- **Redis** - Cache, rate limiting, sessions
- **RabbitMQ** - Message queue for workers
- **Socket.io** - Real-time WebSocket server
- **Stripe** - Payment processing
- **SendGrid** - Email delivery

---

## 📁 Project Structure

```
src/
├── routes/              # API route modules
│   ├── auth.ts          # /api/auth/* - Signup, login, profile
│   ├── users.ts         # /api/users/* - User management
│   ├── invitations.ts   # /api/invitations/* - Team invites
│   ├── organization.ts  # /api/organization - Org settings
│   ├── billing.ts       # /api/billing/* - Stripe integration
│   └── execution.ts     # /api/execution/* - Test runs
├── middleware/          # Request middleware
│   ├── auth.ts          # JWT verification, RBAC
│   └── rateLimit.ts     # Redis rate limiting
├── utils/               # Utility functions
│   ├── jwt.ts           # Token signing/verification
│   ├── password.ts      # bcrypt hashing
│   ├── email.ts         # SendGrid integration
│   └── invitation.ts    # Invitation token handling
└── server.ts            # Entry point
```

---

## 🚀 Development

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Redis
- RabbitMQ

### Environment Variables

Create `.env` file:

```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB
MONGODB_URL=mongodb://localhost:27017/automation_platform

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# SendGrid
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=noreply@agnox.dev

# Google AI
GOOGLE_AI_API_KEY=your-gemini-key

# CORS
CORS_ORIGIN=http://localhost:5173
```

### Run Development Server

```bash
npm install
npm run dev
# Server runs on http://localhost:3000
```

### Run with Docker Compose

```bash
docker-compose up producer-service
```

---

## 📡 API Routes

### Authentication
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/signup` | Create account + organization |
| POST | `/api/auth/login` | Login, get JWT token |
| GET | `/api/auth/me` | Get current user info |
| PATCH | `/api/auth/profile` | Update user name |
| POST | `/api/auth/logout` | Logout |

### Users
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/users` | List org members |
| PATCH | `/api/users/:id/role` | Change user role (admin) |
| DELETE | `/api/users/:id` | Remove user (admin) |

### Organization
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/organization` | Get org details + limits |
| PATCH | `/api/organization` | Update org settings (admin) |

### Invitations
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/invitations` | Send invite (admin) |
| GET | `/api/invitations` | List pending invites |
| DELETE | `/api/invitations/:id` | Revoke invite |
| POST | `/api/invitations/accept` | Accept invitation |

### Billing
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/billing/plans` | Get available plans |
| POST | `/api/billing/checkout` | Create Stripe session |
| POST | `/api/billing/webhook` | Stripe webhook handler |

---

## 🧪 Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration
```

---

## 📖 Related Documentation

- [Main README](../../README.md)
- [API Documentation](../../docs/api/README.md)
- [Authentication API](../../docs/api/authentication.md)
- [Deployment Guide](../../docs/setup/deployment.md)

---

**Built with Fastify + TypeScript**
