import crypto from "crypto";
import { hashPassword, comparePassword } from "../utils/hash";
import { hashOtp, generateOtp } from "../utils/otp";
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import { sendOtpEmail } from "./email.service";
import {
  signupInput,
  verifyEmailInput,
  loginInput,
  resendVerificationInput,
} from "../schemas/auth.schema";
import AppError from "../utils/appError";
import { prisma } from "../config/prisma";

export interface DeviceContext {
  deviceId: string;
  deviceName?: string;
}

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const OTP_TTL_MS = 15 * 60 * 1000;
const GRACE_PERIOD_MS = 10 * 1000; // 10 seconds leeway for mobile network drops

export const registerUserService = async ({
  fullName,
  email,
  password,
}: signupInput) => {
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });
  if (existingUser) {
    throw new AppError(409, "User already exists");
  }

  const hashedPassword = await hashPassword(password);
  const otp = generateOtp();
  const hashedOtp = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  const newUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        fullName,
        email,
        passwordHash: hashedPassword,
      },
    });

    await tx.oneTimeCode.create({
      data: {
        userId: user.id,
        expiresAt,
        code: hashedOtp,
        purpose: "VERIFY_EMAIL",
      },
    });

    return user;
  });

  await sendOtpEmail({
    email: newUser.email,
    otpCode: otp,
    purpose: "VERIFY_EMAIL",
  });

  return {
    id: newUser.id,
    fullName: newUser.fullName,
    email: newUser.email,
  };
};

export const verifyUserService = async (
  { email, otp }: verifyEmailInput,
  deviceContext: DeviceContext,
) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError(400, "User account not found");
  }
  if (user.isVerified) {
    throw new AppError(400, "Account is already verified");
  }

  const otpRecord = await prisma.oneTimeCode.findFirst({
    where: {
      userId: user.id,
      purpose: "VERIFY_EMAIL",
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otpRecord) {
    throw new AppError(400, "Invalid or expired verification code");
  }

  if (otpRecord.attempts >= 3) {
    throw new AppError(
      429,
      "Too many failed attempts. Please request a new code",
    );
  }

  if (new Date() > otpRecord.expiresAt) {
    await prisma.oneTimeCode.delete({ where: { id: otpRecord.id } });
    throw new AppError(
      400,
      "Verification code has expired. Please request a new one",
    );
  }

  const hashOtpInput = hashOtp(otp);
  if (hashOtpInput !== otpRecord.code) {
    await prisma.oneTimeCode.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AppError(400, "Invalid verification code");
  }

  const newFamilyId = crypto.randomUUID();
  const accessToken = generateAccessToken({ userId: user.id });
  const refreshToken = generateRefreshToken({
    userId: user.id,
    familyId: newFamilyId,
    jti: crypto.randomUUID(),
  });
  const hashedRefreshToken = hashRefreshToken(refreshToken);
  const refreshTokenExpiry = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    }),
    prisma.oneTimeCode.update({
      where: { id: otpRecord.id },
      data: { consumedAt: new Date() },
    }),
    // Upsert ensures 1 row per (userId + deviceId) without P2002 collisions
    prisma.refreshToken.upsert({
      where: {
        userId_deviceId: {
          userId: user.id,
          deviceId: deviceContext.deviceId,
        },
      },
      update: {
        familyId: newFamilyId,
        currentTokenHash: hashedRefreshToken,
        previousTokenHash: null,
        deviceName: deviceContext.deviceName,
        rotatedAt: new Date(),
        expiresAt: refreshTokenExpiry,
      },
      create: {
        familyId: newFamilyId,
        userId: user.id,
        currentTokenHash: hashedRefreshToken,
        deviceId: deviceContext.deviceId,
        deviceName: deviceContext.deviceName,
        expiresAt: refreshTokenExpiry,
      },
    }),
  ]);

  return {
    user: { id: user.id, email: user.email, fullName: user.fullName },
    accessToken,
    refreshToken,
  };
};

export const loginUserService = async (
  { email, password }: loginInput,
  deviceContext: DeviceContext,
) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  const isMatch = await comparePassword(password, user.passwordHash);
  if (!isMatch) {
    throw new AppError(401, "Invalid email or password");
  }

  if (!user.isVerified) {
    throw new AppError(
      403,
      "Please verify your email address before logging in",
    );
  }

  const newFamilyId = crypto.randomUUID();
  const accessToken = generateAccessToken({ userId: user.id });
  const refreshToken = generateRefreshToken({
    userId: user.id,
    familyId: newFamilyId,
    jti: crypto.randomUUID(),
  });
  const hashedRefreshToken = hashRefreshToken(refreshToken);
  const refreshTokenExpiry = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await prisma.refreshToken.upsert({
    where: {
      userId_deviceId: {
        userId: user.id,
        deviceId: deviceContext.deviceId,
      },
    },
    update: {
      familyId: newFamilyId,
      currentTokenHash: hashedRefreshToken,
      previousTokenHash: null,
      deviceName: deviceContext.deviceName,
      rotatedAt: new Date(),
      expiresAt: refreshTokenExpiry,
    },
    create: {
      familyId: newFamilyId,
      userId: user.id,
      currentTokenHash: hashedRefreshToken,
      deviceId: deviceContext.deviceId,
      deviceName: deviceContext.deviceName,
      expiresAt: refreshTokenExpiry,
    },
  });

  return {
    user: { id: user.id, email: user.email, fullName: user.fullName },
    accessToken,
    refreshToken,
  };
};

export const resendVerification = async ({
  email,
  purpose,
}: resendVerificationInput) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });
  if (!user) {
    throw new AppError(400, "User account not found");
  }
  if (purpose === "VERIFY_EMAIL" && user.isVerified) {
    throw new AppError(400, "User already verified. Please login");
  }

  // Optional 60-second rate-limit check so users can't spam your email quota
  const existingOtp = await prisma.oneTimeCode.findFirst({
    where: { userId: user.id, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (existingOtp && Date.now() - existingOtp.createdAt.getTime() < 60 * 1000) {
    throw new AppError(
      429,
      "Please wait 60 seconds before requesting a new code",
    );
  }

  const otp = generateOtp();
  const hashedOtp = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  // Delete any old unconsumed codes for this purpose and create the fresh one
  await prisma.$transaction([
    prisma.oneTimeCode.deleteMany({
      where: { userId: user.id, purpose, consumedAt: null },
    }),
    prisma.oneTimeCode.create({
      data: {
        code: hashedOtp,
        expiresAt,
        userId: user.id,
        purpose,
      },
    }),
  ]);

  await sendOtpEmail({
    email: user.email,
    otpCode: otp,
    purpose,
  });

  return { message: "Verification code sent successfully" };
};

export const rotateTokensService = async (
  incomingRefreshToken: string,
  deviceContext: DeviceContext,
) => {
  if (!incomingRefreshToken) {
    throw new AppError(401, "Refresh token is required");
  }

  // 1. Verify JWT signature & expiration before touching Postgres
  let payload: { userId: string; familyId: string; jti?: string };
  try {
    payload = verifyRefreshToken(incomingRefreshToken);
  } catch {
    throw new AppError(
      401,
      "Invalid or expired refresh token. Please log in again",
    );
  }

  const incomingHash = hashRefreshToken(incomingRefreshToken);

  // 2. Look up the single session row by its unique familyId
  const session = await prisma.refreshToken.findUnique({
    where: { familyId: payload.familyId },
  });

  if (!session) {
    throw new AppError(401, "Session no longer exists. Please log in again");
  }

  // 3. Check database expiration
  if (new Date() > session.expiresAt) {
    await prisma.refreshToken.delete({ where: { id: session.id } });
    throw new AppError(401, "Refresh token expired. Please log in again");
  }

  // 4. Device-Binding Check: Ensure the token hasn't been moved to a different physical phone
  if (
    session.deviceId !== "unknown-device" &&
    deviceContext.deviceId !== "unknown-device" &&
    session.deviceId !== deviceContext.deviceId
  ) {
    // Stolen token used on another device! Nuke the session immediately.
    await prisma.refreshToken.delete({ where: { id: session.id } });
    throw new AppError(401, "Device mismatch detected. Session revoked");
  }

  // ============================================================================
  // CASE A: NORMAL ROTATION (Incoming token matches currentTokenHash)
  // ============================================================================
  if (session.currentTokenHash === incomingHash) {
    const newRefreshToken = generateRefreshToken({
      userId: session.userId,
      familyId: session.familyId,
      jti: crypto.randomUUID(),
    });

    const newHash = hashRefreshToken(newRefreshToken);
    const newExpiry = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    // Atomic optimistic lock: only updates if currentTokenHash hasn't changed 1ms ago
    const updated = await prisma.refreshToken.updateMany({
      where: {
        id: session.id,
        currentTokenHash: incomingHash,
      },
      data: {
        previousTokenHash: incomingHash, // Slide old hash into previous
        currentTokenHash: newHash, // Save new hash
        rotatedAt: new Date(),
        expiresAt: newExpiry,
      },
    });

    if (updated.count === 0) {
      throw new AppError(
        409,
        "Concurrent token refresh in progress. Please retry",
      );
    }

    return {
      accessToken: generateAccessToken({ userId: session.userId }),
      refreshToken: newRefreshToken,
    };
  }

  // ============================================================================
  // CASE B: MOBILE GRACE PERIOD (Matches previousTokenHash within 10 seconds)
  // ============================================================================
  const timeSinceLastRotation = Date.now() - session.rotatedAt.getTime();
  const isWithinGraceWindow =
    session.previousTokenHash === incomingHash &&
    timeSinceLastRotation <= GRACE_PERIOD_MS;

  if (isWithinGraceWindow) {
    const retryRefreshToken = generateRefreshToken({
      userId: session.userId,
      familyId: session.familyId,
      jti: crypto.randomUUID(),
    });

    await prisma.refreshToken.update({
      where: { id: session.id },
      data: {
        currentTokenHash: hashRefreshToken(retryRefreshToken),
      },
    });

    return {
      accessToken: generateAccessToken({ userId: session.userId }),
      refreshToken: retryRefreshToken,
    };
  }

  // ============================================================================
  // CASE C: TOKEN REUSE DETECTED! (Valid JWT for this family, but outdated hash)
  // ============================================================================
  await prisma.refreshToken.delete({
    where: { id: session.id },
  });

  throw new AppError(401, "Compromised session detected. Please log in again");
};

export const forgotPasswordService = async ({ email }: { email: string }) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return {
      message:
        "If an account with that email exists, a reset code has been sent",
    };
  }

  const existingOtp = await prisma.oneTimeCode.findFirst({
    where: {
      userId: user.id,
      purpose: "RESET_PASSWORD",
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingOtp && Date.now() - existingOtp.createdAt.getTime() < 60 * 1000) {
    throw new AppError(
      429,
      "Please wait 60 seconds before requesting a new code",
    );
  }

  const otp = generateOtp();
  const hashedOtp = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.$transaction([
    prisma.oneTimeCode.deleteMany({
      where: { userId: user.id, purpose: "RESET_PASSWORD", consumedAt: null },
    }),
    prisma.oneTimeCode.create({
      data: {
        userId: user.id,
        code: hashedOtp,
        expiresAt,
        purpose: "RESET_PASSWORD",
      },
    }),
  ]);

  await sendOtpEmail({
    email: user.email,
    otpCode: otp,
    purpose: "RESET_PASSWORD",
  });

  return {
    message: "If an account with that email exists, a reset code has been sent",
  };
};

export const resetPasswordService = async ({
  email,
  otp,
  newPassword,
}: {
  email: string;
  otp: string;
  newPassword: string;
}) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError(400, "Invalid or expired reset code");
  }

  const otpRecord = await prisma.oneTimeCode.findFirst({
    where: {
      userId: user.id,
      purpose: "RESET_PASSWORD",
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otpRecord) {
    throw new AppError(400, "Invalid or expired reset code");
  }

  if (otpRecord.attempts >= 3) {
    throw new AppError(
      429,
      "Too many failed attempts. Please request a new reset code",
    );
  }

  if (new Date() > otpRecord.expiresAt) {
    await prisma.oneTimeCode.delete({ where: { id: otpRecord.id } });
    throw new AppError(400, "Reset code has expired. Please request a new one");
  }

  const hashOtpInput = hashOtp(otp);
  if (hashOtpInput !== otpRecord.code) {
    await prisma.oneTimeCode.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AppError(400, "Invalid reset code");
  }

  const isSamePassword = await comparePassword(newPassword, user.passwordHash);
  if (isSamePassword) {
    throw new AppError(
      400,
      "New password cannot be the same as your old password",
    );
  }

  const newPasswordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        isVerified: true,
      },
    }),
    prisma.oneTimeCode.update({
      where: { id: otpRecord.id },
      data: { consumedAt: new Date() },
    }),

    prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    }),
  ]);

  return {
    message: "Password reset successful. Please log in with your new password",
  };
};

export const logoutDeviceService = async (incomingRefreshToken: string) => {
  if (!incomingRefreshToken) return;

  try {
    const payload = verifyRefreshToken(incomingRefreshToken);
    await prisma.refreshToken.deleteMany({
      where: {
        familyId: payload.familyId,
        userId: payload.userId,
      },
    });
  } catch {
    // Ignore expired/invalid token errors on logout so client still logs out cleanly
    return;
  }
};

export const logoutAllDevicesService = async (userId: string) => {
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
};
