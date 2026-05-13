import * as Sentry from "@sentry/nextjs";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

Sentry.init({
  dsn: "https://ac75ab409d535247a248693c630132b8@o4511383806083072.ingest.de.sentry.io/4511383821418576",

  integrations: [
    nodeProfilingIntegration(),
  ],

  enableLogs: true,
  tracesSampleRate: 1.0,
  profileSessionSampleRate: 1.0,
  profileLifecycle: 'trace',
  sendDefaultPii: true,
});
