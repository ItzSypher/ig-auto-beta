import crypto from "node:crypto";

function b64urlToBuffer(input: string) {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/**
 * A Meta manda os callbacks de cancelamento e de exclusão como um
 * `signed_request`: "<assinatura>.<payload>", os dois em base64url, com a
 * assinatura sendo HMAC-SHA256 do payload usando a chave secreta do app.
 *
 * Devolve null quando a assinatura não confere — nesse caso o pedido não veio
 * da Meta e deve ser descartado.
 */
export function parseSignedRequest(
  signedRequest: string,
  appSecret: string,
): Record<string, unknown> | null {
  const [encodedSig, encodedPayload] = signedRequest.split(".");
  if (!encodedSig || !encodedPayload) return null;

  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(encodedPayload)
    .digest();
  const received = b64urlToBuffer(encodedSig);

  // timingSafeEqual estoura se os tamanhos diferem, então checamos antes.
  if (
    received.length !== expected.length ||
    !crypto.timingSafeEqual(received, expected)
  ) {
    return null;
  }

  try {
    return JSON.parse(b64urlToBuffer(encodedPayload).toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * Confere o cabeçalho X-Hub-Signature-256 dos webhooks.
 * O corpo precisa ser o texto cru, byte a byte — reserializar o JSON muda a
 * string e quebra a comparação.
 */
export function verifyWebhookSignature(
  rawBody: string,
  header: string | null,
  appSecret: string,
): boolean {
  if (!header?.startsWith("sha256=")) return false;

  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  const received = header.slice("sha256=".length);

  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

/** URL pública do deploy, para montar links absolutos nos callbacks. */
export function appOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "https://ig-auto-beta.vercel.app";
}
