import type { Instrumentation } from 'next';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { applyStudioMailEnvironment } = await import('./lib/studioMail');
    const configured = applyStudioMailEnvironment(process.env);
    if (process.env.MOYO_GMAIL_APP_PASSWORD?.trim() && !configured)
      console.error('Studio Gmail app password has an invalid format; existing mail authentication retained.');
  }
}

// Never log request URLs, headers, exception messages or customer data.
export const onRequestError: Instrumentation.onRequestError = async (_error, _request, context) => {
  console.error(JSON.stringify({ event: 'request_error', route: context.routePath, type: context.routeType }));
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { recordOperationalFailure } = await import('./lib/operations');
    await recordOperationalFailure('request_error');
  }
};
