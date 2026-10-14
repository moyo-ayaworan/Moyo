import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
export const MAX_UPLOAD = 4 * 1024 * 1024;
export const MAX_WORKSPACE = 200 * 1024 * 1024;
export const MAX_VERSION = 40 * 1024 * 1024;
export const OWNER = "moyo";
export const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const secret = () => randomBytes(32).toString("base64url");
export class StudioError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
export function assertStudio(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new StudioError(message, status);
}
function key() {
  const value = process.env.ADMIN_SESSION_SECRET;
  assertStudio(value, "Studio signing is not configured.", 503);
  return createHash("sha256").update(`stillbounds-review:${value}`).digest();
}
export function encryptCode(code: string) {
  const nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), nonce);
  const encrypted = Buffer.concat([
    cipher.update(code, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
export function decryptCode(value: string) {
  const b = Buffer.from(value, "base64url"),
    decipher = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  decipher.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([
    decipher.update(b.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}
export function draftInput(raw: unknown) {
  assertStudio(raw && typeof raw === "object", "Invalid book version.");
  const v = raw as Record<string, unknown>;
  assertStudio(
    typeof v.bookId === "string" && uuid.test(v.bookId),
    "Invalid book ID.",
  );
  assertStudio(
    typeof v.title === "string" &&
      v.title.trim().length > 0 &&
      v.title.length <= 200,
    "Enter a book title.",
  );
  assertStudio(
    Array.isArray(v.spreadIds) &&
      v.spreadIds.length > 0 &&
      v.spreadIds.length <= 101 &&
      v.spreadIds.every((id) => typeof id === "string" && uuid.test(id)) &&
      new Set(v.spreadIds).size === v.spreadIds.length,
    "Invalid book spreads.",
  );
  assertStudio(typeof v.watermark === "boolean", "Choose a watermark setting.");
  assertStudio(
    Number.isInteger(v.retentionDays) &&
      Number(v.retentionDays) >= 1 &&
      Number(v.retentionDays) <= 30,
    "Retention must be 1–30 days.",
  );
  return {
    bookId: v.bookId,
    title: v.title.trim(),
    spreadIds: v.spreadIds as string[],
    watermark: v.watermark,
    retentionDays: Number(v.retentionDays),
  };
}
export async function boundedBody(request: Request, limit: number) {
  const declared = Number(request.headers.get("content-length"));
  assertStudio(
    !Number.isFinite(declared) || declared <= limit,
    "Request exceeds the upload limit.",
    413,
  );
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const parts: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.length;
      if (bytes > limit) {
        await reader.cancel();
        throw new StudioError("Request exceeds the upload limit.", 413);
      }
      parts.push(next.value);
    }
    return Buffer.concat(parts);
  } finally {
    reader.releaseLock();
  }
}
export async function bodyJSON(request: Request) {
  try {
    const value = JSON.parse(
      (await boundedBody(request, 32 * 1024)).toString("utf8"),
    );
    assertStudio(
      value && typeof value === "object" && !Array.isArray(value),
      "Invalid JSON object.",
    );
    return value;
  } catch (error) {
    if (error instanceof StudioError) throw error;
    throw new StudioError("Invalid JSON.");
  }
}
