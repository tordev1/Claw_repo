# Mode: Web Store / E-commerce
## Overview
Full-stack e-commerce platform. Handles product catalog, cart, checkout, payments, inventory, and order management. Typically involves high traffic patterns and transaction integrity requirements.
## Architecture Template
- Frontend: React SPA or Next.js SSR for SEO
- Backend: REST API with Node.js/Fastify
- Database: PostgreSQL (transactions) + Redis (cart sessions, cache)
- Payments: Stripe or PayPal integration
- Search: Elasticsearch or Algolia for product search
- CDN: Cloudflare for static assets + image optimization
## Task Breakdown Template
1. Product catalog (CRUD, categories, variants, images)
2. User auth + account management
3. Cart & wishlist (session-based + persistent)
4. Checkout flow (address, shipping, payment)
5. Payment integration + webhooks
6. Order management + fulfillment
7. Inventory tracking
8. Admin dashboard
9. Search + filtering
10. Performance + caching layer
## Team Composition
- Frontend: 2 workers (product pages + checkout flow)
- Backend: 2 workers (API + payments)
- Database: 1 worker
- DevOps: 1 worker
- UI/UX: 1 worker
- QA: 1 worker
## Model Recommendations
- Frontend: claude-sonnet (complex UI state)
- Backend: claude-sonnet (payment logic is critical)
- Database: claude-haiku (schema/query work)
- DevOps: claude-haiku (infra configs)
## Common Pitfalls
- Cart race conditions under load
- Payment webhook idempotency
- Inventory overselling
- Image optimization forgotten until too late
- PCI compliance scope creep
## Boilerplate
```
/src /components /pages /api /db/migrations /tests /infra
```
