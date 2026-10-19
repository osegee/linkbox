import { resend } from "../config/resend";
import AppError from "../utils/appError";

export type OtpPurpose = "VERIFY_EMAIL" | "RESET_PASSWORD";

interface SendOtpProps {
  email: string;
  otpCode: string;
  purpose: OtpPurpose;
}

const EMAIL_TEMPLATES: Record<
  OtpPurpose,
  { subject: string; html: (code: string) => string }
> = {
  VERIFY_EMAIL: {
    subject: "Verify your Linkbox Account",
    html: (code) => `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Welcome to Linkbox!</h2>
        <p>Thank you for signing up. Please use the verification code below to activate your account:</p>
        <h1 style="background: #f4f4f4; padding: 10px; display: inline-block; letter-spacing: 2px;">${code}</h1>
        <p>This code will expire in 15 minutes. If you did not create this account, please ignore this email.</p>
      </div>
    `,
  },
  RESET_PASSWORD: {
    subject: "Reset your Linkbox Password",
    html: (code) => `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Password Reset Request</h2>
        <p>We received a request to reset the password for your Linkbox account. Enter the following security code:</p>
        <h1 style="background: #f4f4f4; padding: 10px; display: inline-block; letter-spacing: 2px; color: #e53e3e;">${code}</h1>
        <p>This code will expire in 15 minutes. If you did not request a password reset, please change your password immediately to secure your account.</p>
      </div>
    `,
  },
};

export const sendOtpEmail = async ({
  email,
  otpCode,
  purpose,
}: SendOtpProps): Promise<void> => {
  try {
    const template = EMAIL_TEMPLATES[purpose];

    const { error } = await resend.emails.send({
      from: "Linkbox <onboarding@resend.dev>",
      to: email,
      subject: template.subject,
      html: template.html(otpCode),
    });

    if (error) {
      console.error("Resend API Error:", error);
      throw new AppError(500, "Failed to dispatch transactional email");
    }
  } catch (error) {
    if (error instanceof AppError) throw error;

    console.error("Fatal email network error:", error);
    throw new AppError(503, "Email distribution engine is currently offline");
  }
};
