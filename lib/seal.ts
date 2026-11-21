import crypto from "crypto";
import zlib from "zlib";

// Solo cases are stateless: the full case is encrypted into the caseId token.
// The browser carries it but cannot read it, so the culprit never leaks
// and solo mode needs no database at all.

const key = () =>
  crypto
    .createHash("sha256")
    .update(process.env.KAUN_SECRET || "kaun-dev-secret-change-me")
    .digest();

export function seal(data: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const plain = zlib.deflateSync(Buffer.from(JSON.stringify(data)));
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
}

export function unseal<T>(token: string): T {
  const raw = Buffer.from(token, "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  const plain = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
  return JSON.parse(zlib.inflateSync(plain).toString()) as T;
}
