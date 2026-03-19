import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { z } from 'zod/v4';
import { env } from '../config/env.js';

const accessTokenPayloadSchema = z.object({
  userId: z.number(),
  role: z.string(),
  email: z.string(),
});

export type AccessTokenPayload = z.infer<typeof accessTokenPayloadSchema>;

function parseExpiresIn(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  const amountStr = match?.[1];
  const unit = match?.[2];

  if (!amountStr || !unit) {
    throw new Error(`Invalid JWT_ACCESS_EXPIRES format: ${value}`);
  }

  const amount = Number(amountStr);
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };
  const multiplier = multipliers[unit];
  if (multiplier === undefined) {
    throw new Error(`Invalid JWT_ACCESS_EXPIRES unit: ${unit}`);
  }
  return amount * multiplier;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const expiresInSeconds = parseExpiresIn(env.JWT_ACCESS_EXPIRES);
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: expiresInSeconds,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  return accessTokenPayloadSchema.parse(decoded);
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
