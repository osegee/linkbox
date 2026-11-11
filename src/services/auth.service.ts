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
  forgotPasswordInput,
  resetPasswordInput,
} from "../schemas/auth.schema";
import AppError from "../utils/appError";
import { prisma } from "../config/prisma";

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const OTP_TTL_MS = 15 * 60 * 1000;

export const registerUserService = async ({
  fullName,
  email,
  password,
}: signupInput) => {
  const existingUser = await prisma.user.findUnique({ where: { email } });

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
        code: hashedOtp,
        purpose: "VERIFY_EMAIL",
        expiresAt,
      },
    });
    return user;
  });

  await sendOtpEmail({
    email: newUser.email,
    otpCode: otp,
    purpose: "VERIFY_EMAIL",
  });

  return newUser;
};

export const verifyUserService = async ({ email, otp }: verifyEmailInput) => {
  const NOW = new Date();

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

  if (NOW > otpRecord.expiresAt) {
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

  await prisma.$transaction(async (tx) => {
    const result = await tx.oneTimeCode.updateMany({
      where: {
        id: otpRecord.id,
        consumedAt: null,
        purpose: "VERIFY_EMAIL",
        expiresAt: { gt: NOW },
      },
      data: { consumedAt: NOW },
    });
    if (result.count !== 1) {
      throw new AppError(400, "Invalid or expired verification token");
    }
    await tx.user.update({
      where: { id: otpRecord.userId },
      data: { isVerified: true },
    });
  });
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
  const otp = generateOtp();
  const hashedOtp = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await tx.oneTimeCode.deleteMany({
      where: { userId: user.id, purpose: "VERIFY_EMAIL", usedAt: null },
    });
    await tx.oneTimeCode.create({
      data: {
        userId: user.id,
        purpose: "VERIFY_EMAIL",
        code: hashedOtp,
        expiresAt,
      },
    });
  });
  await sendOtpEmail({
    email: user.email,
    otpCode: otp,
    purpose,
  });

  return { message: "Verification code sent successfully" };
};

export const loginUserService = async ({ email, password }: loginInput) => {
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
  const accessToken = generateAccessToken({ userId: user.id });
  const refreshToken = generateRefreshToken({
    userId: user.id,
  });
  const hashedRefreshToken = hashRefreshToken(refreshToken);
  const refreshTokenExpiry = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashedRefreshToken,
      expiresAt: refreshTokenExpiry,
    },
  });

  return { user, accessToken, refreshToken };
};

export const refreshTokenService = async (refreshToken: string) => {
  const decoded = verifyRefreshToken(refreshToken);
  const hashedToken = hashRefreshToken(refreshToken);
  const NOW = new Date();

  const token = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashedToken },
  });

  if (
    !token ||
    token.userId !== decoded.userId ||
    token.revokedAt !== null ||
    token.expiresAt <= NOW
  ) {
    throw new AppError(401, "Invalid or expired tokens");
  }

  const newAccessToken = generateAccessToken({
    userId: decoded.userId,
  });
  const newRefreshToken = generateRefreshToken({
    userId: decoded.userId,
  });
  const hashedRefreshToken = hashRefreshToken(newRefreshToken);
  const refreshTokenExpiry = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await prisma.$transaction(async (tx) => {
    const result = await tx.refreshToken.updateMany({
      where: {
        tokenHash: token.tokenHash,
        userId: decoded.userId,
        revokedAt: token.revokedAt,
        expiresAt: { gt: NOW },
      },
      data: { revokedAt: NOW },
    });
    if (result.count !== 1) {
      throw new AppError(401, "Invalid or expired refresh token");
    }
    await tx.refreshToken.create({
      data: {
        userId: decoded.userId,
        tokenHash: hashedRefreshToken,
        expiresAt: refreshTokenExpiry,
      },
    });
  });
  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

export const logoutUserService = async (refreshToken: string) => {
  const NOW = new Date();

  if (!refreshToken) return;

  const hashedRefreshToken = hashRefreshToken(refreshToken);

  await prisma.refreshToken.updateMany({
    where: {
      tokenHash: hashedRefreshToken,
    },
    data: {
      revokedAt: NOW,
    },
  });
};

export const forgotPasswordService = async ({ email }: forgotPasswordInput) => {
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
}: resetPasswordInput) => {
  const NOW = new Date();

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
