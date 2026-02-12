import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const WINDOW_MS = 60_000;
const MAX_HITS = 60;
const requestMap = new Map<string, { count: number; expiresAt: number }>();

export function getClientIp(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}

export function isRateLimited(key: string) {
  const now = Date.now();

  if (requestMap.size > 10_000) {
    for (const [entryKey, value] of requestMap.entries()) {
      if (value.expiresAt < now) {
        requestMap.delete(entryKey);
      }
    }
  }

  const row = requestMap.get(key);

  if (!row || row.expiresAt < now) {
    requestMap.set(key, { count: 1, expiresAt: now + WINDOW_MS });
    return false;
  }

  row.count += 1;
  return row.count > MAX_HITS;
}

export function cleanText(text: string, maxLength = 120) {
  return text.replace(/[<>]/g, "").trim().slice(0, maxLength);
}

export function cleanHttpUrl(input: string, maxLength = 500) {
  const trimmed = input.trim().slice(0, maxLength);
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function isTrustedOrigin(
  request: Request,
  options?: {
    allowMissingOrigin?: boolean;
  },
) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return options?.allowMissingOrigin ?? false;
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto");
  const expectedOrigin = host && proto ? `${proto}://${host}` : null;
  const httpOrigin = host ? `http://${host}` : null;
  const httpsOrigin = host ? `https://${host}` : null;

  const allowed = [
    expectedOrigin,
    httpOrigin,
    httpsOrigin,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter((value): value is string => Boolean(value));

  return allowed.some((value) => value === origin);
}

export function hashOrderId(orderId: string) {
  return createHash("sha256").update(orderId).digest("hex");
}

export function verifyRazorpaySignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  secret: string;
}) {
  const payload = `${params.razorpayOrderId}|${params.razorpayPaymentId}`;
  const expected = createHmac("sha256", params.secret)
    .update(payload)
    .digest("hex");

  const incomingBuffer = Buffer.from(params.razorpaySignature);
  const expectedBuffer = Buffer.from(expected);

  if (incomingBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(incomingBuffer, expectedBuffer);
}
