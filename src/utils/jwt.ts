import jwt from "jsonwebtoken";
import { env } from "../config/env";
import crypto from "node:crypto";

export interface AccessTokenPayload {
  userId: string;
}

export interface RefreshTokenPayload {
  userId: string;
  familyId: string;
  jti?: string; 
}

const JWT_COMMON_OPTIONS = {
  issuer: "linkbox-api",
  audience: "linkbox-mobile",
} as const;

export const generateAccessToken = (payload: AccessTokenPayload): string => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    ...JWT_COMMON_OPTIONS,
    expiresIn: "15m",
  });
};

export const generateRefreshToken = (payload: RefreshTokenPayload): string => {
  const tokenPayload = {
    userId: payload.userId,
    familyId: payload.familyId,
    jti: payload.jti ?? crypto.randomUUID(),
  };

  return jwt.sign(tokenPayload, env.JWT_REFRESH_SECRET, {
    ...JWT_COMMON_OPTIONS,
    expiresIn: "30d",
  });
};


export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(
    token,
    env.JWT_ACCESS_SECRET,
    JWT_COMMON_OPTIONS
  ) as AccessTokenPayload;
};


export const verifyToken = verifyAccessToken;


export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(
    token,
    env.JWT_REFRESH_SECRET,
    JWT_COMMON_OPTIONS
  ) as RefreshTokenPayload;
};

export const hashRefreshToken = (refreshToken: string) => {
  return crypto.createHash("sha256").update(refreshToken).digest("hex");
};