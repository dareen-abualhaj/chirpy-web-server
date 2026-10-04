import argon2 from "argon2";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import { Request } from "express";
import crypto from "crypto";

export async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password);
}

export async function checkPasswordHash(password: string, hash: string): Promise<boolean> {
  return await argon2.verify(hash, password);
}

export function makeJWT(userID: string, expiresIn: number, secret: string): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: Pick<JwtPayload, "iss" | "sub" | "iat" | "exp"> = {
    iss: "chirpy",
    sub: userID,
    iat: issuedAt,
    exp: issuedAt + expiresIn,
  };
  return jwt.sign(payload, secret);
}

export function validateJWT(tokenString: string, secret: string): string {
  try {
    const decoded = jwt.verify(tokenString, secret) as JwtPayload;
    if (!decoded.sub) {
      throw new Error("Invalid token subject");
    }
    return decoded.sub;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
}
export function getBearerToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error("No authorization header provided");
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw new Error("Malformed authorization header");
  }

  return parts[1];
}

export function makeRefreshToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getAPIKey(req: Request): string {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error("No authorization header included");
  }

  const splitAuth = authHeader.split(" ");
  if (splitAuth.length !== 2 || splitAuth[0] !== "ApiKey") {
    throw new Error("Malformed authorization header");
  }

  return splitAuth[1];
}
