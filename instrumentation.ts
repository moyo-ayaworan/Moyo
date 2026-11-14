import type { Instrumentation } from 'next';

// Never log request URLs, headers, exception messages or customer data.
export const onRequestError: Instrumentation.onRequestError = async (_error, _request, context) => {
  console.error(JSON.stringify({ event: 'request_error', route: context.routePath, type: context.routeType }));
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { recordOperationalFailure } = await import('./lib/operations');
    await recordOperationalFailure('request_error');
  }
};
