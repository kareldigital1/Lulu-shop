import { createHash, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";

function secretsMatch(provided: string, expected: string) {
  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();

  return timingSafeEqual(providedDigest, expectedDigest);
}

export function loginAdmin(email: string, password: string) {
  const emailMatches = secretsMatch(email, env.ADMIN_EMAIL);
  const passwordMatches = secretsMatch(password, env.ADMIN_PASSWORD);

  if (!emailMatches || !passwordMatches) {
    throw new AppError("Identifiants administrateur invalides.", 401);
  }

  const token = jwt.sign(
    {
      email,
      role: "admin",
    },
    env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "12h",
    },
  );

  return {
    token,
    admin: {
      email,
      role: "admin" as const,
    },
  };
}
