// Scheduled endpoint: pulls the configured Goan event/news feeds.
// Protected by a shared secret so only the scheduler can trigger it.
import { createFileRoute } from "@tanstack/react-router";
import { runEventImport } from "@/lib/automation.functions";

export const Route = createFileRoute("/api/public/cron/import-events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        const provided = request.headers.get("x-cron-secret");
        if (!secret || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const reports = await runEventImport();
        return Response.json({ ok: true, reports });
      },
    },
  },
});
