import { describe, it, expect, beforeAll } from "vitest";
import { makeJWT, validateJWT, hashPassword, checkPasswordHash } from "./auth.js";

describe("Password Hashing", () => {
  const password1 = "correctPassword123!";
  let hash1: string;

  beforeAll(async () => {
    hash1 = await hashPassword(password1);
  });

  it("should return true for the correct password", async () => {
    const result = await checkPasswordHash(password1, hash1);
    expect(result).toBe(true);
  });
});

describe("JWT Creation and Validation", () => {
  const secret = "test-secret-key";
  const userId = "123e4567-e89b-12d3-a456-426614174000";

  it("should successfully create and validate a JWT", () => {
    const token = makeJWT(userId, 3600, secret);
    const validatedId = validateJWT(token, secret);
    expect(validatedId).toBe(userId);
  });

  it("should reject an expired JWT", () => {
    // إنشاء رمز منتهي الصلاحية (مر عليه ثانية واحدة في الماضي)
    const token = makeJWT(userId, -1, secret);
    expect(() => validateJWT(token, secret)).toThrow();
  });

  it("should reject a JWT signed with the wrong secret", () => {
    const token = makeJWT(userId, 3600, secret);
    const wrongSecret = "wrong-secret-key";
    expect(() => validateJWT(token, wrongSecret)).toThrow();
  });
});
