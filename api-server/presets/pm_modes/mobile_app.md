# Mode: Mobile Application
## Overview
Cross-platform or native mobile app. Focus on performance, offline capability, push notifications, and app store deployment pipeline.
## Architecture Template
- React Native (cross-platform) or Swift/Kotlin (native)
- Backend: REST or GraphQL API
- Offline: SQLite local storage + sync queue
- Push: Firebase Cloud Messaging (FCM) / APNs
- Auth: Biometric + JWT
- CI/CD: Fastlane + GitHub Actions
## Task Breakdown Template
1. Core navigation + screen architecture
2. Auth (social login + biometric)
3. Core feature screens
4. Offline-first data layer + sync
5. Push notifications
6. Backend API integration
7. Performance optimization
8. Beta distribution (TestFlight / Play Console)
9. App store submission
10. Analytics + crash reporting
## Team Composition
- Mobile: 2 workers (iOS + Android or React Native)
- Backend: 1 worker
- UI/UX: 1 worker
- QA: 1 worker
- DevOps: 1 worker (CI/CD pipeline)
## Model Recommendations
- Mobile: claude-sonnet (complex native interactions)
- UI/UX: claude-haiku (design specs)
## Common Pitfalls
- App store review rejections (plan 2-3 week buffer)
- Offline sync conflicts
- Push notification opt-out rates
- iOS/Android behavioral differences
