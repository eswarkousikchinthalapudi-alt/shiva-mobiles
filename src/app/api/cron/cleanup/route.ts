import { runCleanup } from "@/lib/cleanup";
import { timingSafeEqualString } from "@/lib/security/crypto";

/**
 * Optional: call once a day from a scheduler (for example cron-job.org or your
 * host's cron) with the header "Authorization: Bearer <CRON_SECRET>".
 * The admin panel also runs the same clean-up once a day on its own.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 16) return new Response("Not configured", { status: 404 });
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!timingSafeEqualString(token, secret)) return new Response("Unauthorized", { status: 401 });
  const report = await runCleanup({ force: true });
  return Response.json({ ok: true, report });
}
