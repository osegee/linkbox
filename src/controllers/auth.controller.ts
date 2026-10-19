import { Request, Response, NextFunction } from "express";
import {
  registerUserService,
  verifyUserService,
  loginUserService,
  resendVerification,
  rotateTokensService,
  forgotPasswordService,
  resetPasswordService,
  logoutDeviceService,
  logoutAllDevicesService,
  DeviceContext,
} from "../services/auth.service";

const extractDeviceContext = (req: Request): DeviceContext => {
  const deviceId =
    (req.headers["x-device-id"] as string) ||
    req.body?.deviceId ||
    "unknown-device";

  const deviceName =
    (req.headers["x-device-name"] as string) ||
    req.headers["user-agent"] ||
    "LinkBox Mobile Client";

  return { deviceId, deviceName };
};

const extractRefreshToken = (req: Request): string => {
  if (req.body?.refreshToken) {
    return req.body.refreshToken;
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  return "";
};

export const registerController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await registerUserService(req.body);
    return res.status(201).json({
      status: "success",
      message: "Registration successful. Please check your email for the verification code.",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};


export const verifyEmailController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const deviceContext = extractDeviceContext(req);
    const result = await verifyUserService(req.body, deviceContext);

    return res.status(200).json({
      status: "success",
      message: "Email verified successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};


export const loginController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const deviceContext = extractDeviceContext(req);
    const result = await loginUserService(req.body, deviceContext);

    return res.status(200).json({
      status: "success",
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const resendOtpController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await resendVerification(req.body);
    return res.status(200).json({
      status: "success",
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

export const refreshController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const incomingRefreshToken = extractRefreshToken(req);
    const deviceContext = extractDeviceContext(req);

    const tokens = await rotateTokensService(incomingRefreshToken, deviceContext);

    return res.status(200).json({
      status: "success",
      data: tokens,
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPasswordController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await forgotPasswordService(req.body);
    return res.status(200).json({
      status: "success",
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};


export const resetPasswordController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await resetPasswordService(req.body);
    return res.status(200).json({
      status: "success",
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

export const logoutController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const incomingRefreshToken = extractRefreshToken(req);
    await logoutDeviceService(incomingRefreshToken);

    return res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};


export const logoutAllController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    await logoutAllDevicesService(userId);

    return res.status(200).json({
      status: "success",
      message: "Logged out from all devices successfully",
    });
  } catch (error) {
    next(error);
  }
};