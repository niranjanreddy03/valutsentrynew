import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://ac75ab409d535247a248693c630132b8@o4511383806083072.ingest.de.sentry.io/4511383821418576",

  integrations: [
    Sentry.replayIntegration(),
    Sentry.browserTracingIntegration(),
  ],

  enableLogs: true,
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  sendDefaultPii: true,
});
