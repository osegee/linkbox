import { Router } from "express";
import {
  registerController,
  verifyEmailController,
  loginController,
  resendOtpController,
  forgotPasswordController,
  resetPasswordController,
  logoutAllController,
  logoutController,
  refreshController,
} from "../controllers/auth.controller";
import {
  signupSchema,
  verifyEmailSchema,
  loginSchema,
  forgotPasswordSchema,
  resendVerificationSchema,
  resetPasswordSchema,
} from "../schemas/auth.schema";
import { validate } from "../middleware/validate";

const router = Router();

router.post("/register", validate(signupSchema), registerController);
router.post(
  "/verify-email",
  validate(verifyEmailSchema),
  verifyEmailController,
);
router.post("/login", validate(loginSchema), loginController);
router.post(
  "/resend-otp",
  validate(resendVerificationSchema),
  resendOtpController,
);
router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  forgotPasswordController,
);
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  resetPasswordController,
);
router.post("/logout", logoutController);
router.post("/logout-all", logoutAllController);
router.post("/refresh", refreshController);

export default router;
