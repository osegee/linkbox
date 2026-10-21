import { Request, Response, NextFunction } from "express";
import AppError from "../utils/appError";
import { verifyToken } from "../utils/jwt";

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError(401, "Authentication required");
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw new AppError(401, "Invalid authorization header");
    }
    const decoded = verifyToken(token);

    req.user = { id: decoded.userId };

    next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      next(
        new AppError(
          401,
          "Your access token has expired, Please refresh your session",
        ),
      );
    }
    console.error(error);
    next(error);
  }
};