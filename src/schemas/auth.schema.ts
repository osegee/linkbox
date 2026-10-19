import { email, z } from "zod";

export const signupSchema = z.object({
  fullName: z.string().min(1, "fullname is required"),
  email: z.email({ error: "Invalid email adress format" }).toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

export type signupInput = z.infer<typeof signupSchema>;

export const verifyEmailSchema = z.object({
  email: z.email({ error: "Invalid email adress format" }).toLowerCase(),
  otp: z
    .string()
    .min(6, "OTP must be 6 digits long")
    .length(6, "OTP must be 6 digits long"),
});

export type verifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const loginSchema = z.object({
  email: z.email({ error: "Invalid email adress format" }).toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

export type loginInput = z.infer<typeof loginSchema>;

export const resendVerificationSchema = z.object({
  email: z.email({ error: "Invalid email adress format" }).toLowerCase(),
  purpose: z.enum(["VERIFY_EMAIL", "RESET_PASSWORD"]),
});

export type resendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const forgotPasswordSchema = z.object({
  email: z.email({ error: "Invalid email address format" }).toLowerCase(),
});

export type forgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  email: z.email({ error: "Invalid email adress format" }).toLowerCase(),
  otp: z
    .string()
    .min(6, "OTP must be 6 digits long")
    .length(6, "OTP must be 6 digits long"),
  newPassword: z.string().min(8, "Password must be at least 8 characters long"),
});

export type resetPasswordInput = z.infer<typeof resetPasswordSchema>;
