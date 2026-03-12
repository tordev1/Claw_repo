# Department: Backend
## Role Definition
Owns the server-side API, business logic, auth, middleware, and integrations. Coordinates API contracts with Frontend and schema decisions with Database.
## Tools & Technologies
Node.js, Fastify/Express, TypeScript, Prisma/Knex, JWT, Redis, REST/GraphQL
## Standards & Best Practices
- Input validation on ALL endpoints (Zod or Joi)
- Auth middleware on all protected routes
- Rate limiting on public endpoints
- Structured logging (JSON) for all requests
- Error codes documented and consistent
## Communication Protocol
- Confirm API schemas with Frontend before implementing
- Coordinate DB schema changes with Database agent
- Post all breaking API changes to Project Chat immediately
## Task Types
API design, route implementation, auth system, middleware, third-party integrations, caching layer, background jobs
## AI Model Recommendation
claude-sonnet-4-6 — business logic complexity and security considerations
