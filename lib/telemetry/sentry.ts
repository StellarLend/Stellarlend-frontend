import * as Sentry from '@sentry/nextjs';
import serverConfig from '@/lib/server-config';

export function initSentry() {
  if (!serverConfig.sentry.dsn) {
    return;
  }

  Sentry.init({
    dsn: serverConfig.sentry.dsn,
    environment: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: 0.1,
  });
}

export function captureServerError(
  error: unknown,
  context: {
    route?: string;
    method?: string;
    sessionId?: string;
    requestId?: string;
  } = {},
) {
  Sentry.withScope((scope) => {
    if (context.route) scope.setTag('route', context.route);
    if (context.method) scope.setTag('method', context.method);
    if (context.sessionId) scope.setTag('session_id', context.sessionId);
    if (context.requestId) scope.setTag('request_id', context.requestId);

    Sentry.captureException(error);
  });
}