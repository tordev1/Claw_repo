# Mode: SaaS Platform
## Overview
Multi-tenant software-as-a-service. Core pillars: auth/identity, billing/subscriptions, multi-tenancy data isolation, admin console, API layer with rate limiting.
## Architecture Template
- Auth: Auth0 / Clerk or custom JWT + refresh tokens
- Multi-tenancy: Row-level security or schema-per-tenant
- Billing: Stripe Billing with webhooks
- Frontend: React + TypeScript
- Backend: Node.js + Fastify/Express
- Database: PostgreSQL with tenant isolation
- Cache: Redis for rate limits + sessions
## Task Breakdown Template
1. Auth system (signup, login, OAuth, MFA)
2. Subscription plans + billing integration
3. Multi-tenant data isolation
4. Dashboard (usage, billing, settings)
5. Admin panel (user management, feature flags)
6. API with versioning + rate limiting
7. Webhooks system
8. Email notifications (transactional)
9. Onboarding flow
10. Analytics + usage tracking
## Team Composition
- Frontend: 2 workers
- Backend: 2 workers
- Database: 1 worker
- Security: 1 worker
- API & Integration: 1 worker
- DevOps: 1 worker
## Model Recommendations
- Backend: claude-sonnet (auth + billing logic is critical)
- Security: claude-sonnet (security review needs strong reasoning)
- Frontend: claude-haiku (forms + dashboards are straightforward)
## Common Pitfalls
- Tenant data leakage (always test cross-tenant isolation)
- Billing edge cases (trials, downgrades, failed payments)
- Token refresh race conditions
- Feature flag complexity
