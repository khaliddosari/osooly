import { afterEach, describe, expect, it } from "vitest";
import { openValue, resetKeyCache, sealValue } from "./pii";

// A deterministic 32-byte test key (hex). Real keys come from the
// PII_ENCRYPTION_KEY secret.
const KEY_HEX = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

function withKey(key: string | undefined) {
  if (key === undefined) delete process.env.PII_ENCRYPTION_KEY;
  else process.env.PII_ENCRYPTION_KEY = key;
  resetKeyCache();
}

afterEach(() => withKey(undefined));

describe("sealValue / openValue", () => {
  it("round-trips a value with a configured key", () => {
    withKey(KEY_HEX);
    const plaintext = JSON.stringify({ note: "VIN JT123, deed 456" });
    const sealed = sealValue(plaintext);
    expect(sealed.startsWith("v1:")).toBe(true);
    expect(sealed).not.toContain("VIN");
    expect(openValue(sealed)).toBe(plaintext);
  });

  it("produces a fresh IV each time (ciphertexts differ, both decrypt)", () => {
    withKey(KEY_HEX);
    const a = sealValue("same");
    const b = sealValue("same");
    expect(a).not.toBe(b);
    expect(openValue(a)).toBe("same");
    expect(openValue(b)).toBe("same");
  });

  it("passes plaintext through unchanged when no key is configured", () => {
    withKey(undefined);
    expect(sealValue("hello")).toBe("hello");
    expect(openValue("hello")).toBe("hello");
  });

  it("reads legacy unprefixed plaintext even after a key is configured", () => {
    withKey(KEY_HEX);
    // A row written while the seam was a pass-through (S1–S9) has no prefix.
    expect(openValue("legacy plaintext")).toBe("legacy plaintext");
  });

  it("accepts a base64 key as well as hex", () => {
    withKey(Buffer.from(KEY_HEX, "hex").toString("base64"));
    const sealed = sealValue("secret");
    expect(openValue(sealed)).toBe("secret");
  });

  it("rejects a tampered ciphertext (GCM auth tag)", () => {
    withKey(KEY_HEX);
    const sealed = sealValue("secret");
    const body = Buffer.from(sealed.slice(3), "base64");
    body[body.length - 1] ^= 0xff; // flip a ciphertext bit
    const tampered = "v1:" + body.toString("base64");
    expect(() => openValue(tampered)).toThrow();
  });

  it("throws on a misconfigured (wrong-length) key", () => {
    withKey("tooshort");
    expect(() => sealValue("x")).toThrow(/32 bytes/);
  });

  it("throws when a sealed value is read with no key configured", () => {
    withKey(KEY_HEX);
    const sealed = sealValue("secret");
    withKey(undefined);
    expect(() => openValue(sealed)).toThrow(/not configured/);
  });
});
