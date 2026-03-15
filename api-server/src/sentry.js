/**
 * Sentry Error Tracking — optional, requires SENTRY_DSN env var
 */

const config = require('./config');

let Sentry = null;
let initialized = false;

function initSentry() {
  const dsn = config.SENTRY_DSN;
  if (!dsn) {
    console.log('[sentry] SENTRY_DSN not set — error tracking disabled');
    return;
  }

  try {
    Sentry = require('@sentry/node');

    Sentry.init({
      dsn,
      environment: config.NODE_ENV,
      release: `project-claw@${process.env.npm_package_version || '1.2.0'}`,
      tracesSampleRate: config.isProduction ? 0.2 : 1.0,
      beforeSend(event) {
        // Strip sensitive data
        if (event.request?.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
        return event;
      },
    });

    initialized = true;
    console.log('[sentry] Error tracking initialized');
  } catch (err) {
    console.warn(`[sentry] Failed to initialize: ${err.message}`);
  }
}

function captureException(err, context) {
  if (!initialized || !Sentry) return;
  if (context) {
    Sentry.withScope(scope => {
      if (context.user) scope.setUser(context.user);
      if (context.tags) Object.entries(context.tags).forEach(([k, v]) => scope.setTag(k, v));
      if (context.extra) scope.setExtras(context.extra);
      Sentry.captureException(err);
    });
  } else {
    Sentry.captureException(err);
  }
}

function captureMessage(msg, level = 'info') {
  if (!initialized || !Sentry) return;
  Sentry.captureMessage(msg, level);
}

/**
 * Fastify error handler plugin — captures 5xx errors to Sentry
 */
function sentryErrorHandler(error, request, reply) {
  if (error.statusCode >= 500 || !error.statusCode) {
    captureException(error, {
      user: request.user ? { id: request.user.id, name: request.user.name } : undefined,
      tags: { route: request.routeOptions?.url, method: request.method },
      extra: { params: request.params, query: request.query },
    });
  }
}

async function flushSentry(timeout = 2000) {
  if (!initialized || !Sentry) return;
  try { await Sentry.close(timeout); } catch {}
}

module.exports = {
  initSentry,
  captureException,
  captureMessage,
  sentryErrorHandler,
  flushSentry,
  isInitialized: () => initialized,
};
