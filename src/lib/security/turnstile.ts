import "server-only";

/**
 * Cloudflare Turnstile check for public forms. Set TURNSTILE_SITE_KEY and
 * TURNSTILE_SECRET_KEY to switch it on. Without keys the forms still have a
 * hidden honeypot field and rate limits, and a warning is logged.
 */
export function turnstileSiteKey(): string | null {
  const key = process.env.TURNSTILE_SITE_KEY?.trim();
  return key ? key : null;
}

let warned = false;

export async function verifyTurnstile(token: string | null | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  // Both keys are needed: without the site key no check box is shown, so nobody could pass.
  if (!secret || !turnstileSiteKey()) {
    if (!warned) {
      console.warn("[turnstile] TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY not both set; public forms rely on honeypot + rate limits only.");
      warned = true;
    }
    return true;
  }
  if (!token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = (await response.json()) as { success?: boolean };
    return data.success === true;
  } catch (error) {
    console.error("[turnstile] verification failed", error);
    return false;
  }
}
