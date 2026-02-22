import { Resend } from "resend";

import { ApiHttpError } from "@/lib/api/errors";

let resendClient: Resend | null = null;

function getResendClient() {
  if (resendClient) {
    return resendClient;
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new ApiHttpError(
      500,
      "EMAIL_NOT_CONFIGURED",
      "RESEND_API_KEY is not configured",
    );
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

export async function sendProjectShareEmail(input: {
  to: string;
  projectUrl: string;
  projectName: string;
}): Promise<{ email: string; status: "sent" }> {
  const resend = getResendClient();
  const fromAddress =
    process.env.RESEND_FROM_EMAIL ?? "Project Beacon <onboarding@resend.dev>";

  const { error } = await resend.emails.send({
    from: fromAddress,
    to: input.to,
    subject: `You are invited to ${input.projectName}`,
    text: `You are invited to project ${input.projectName}.\nOpen project: ${input.projectUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2 style="margin: 0 0 12px 0;">You're invited to TaskLogger</h2>
        <p style="margin: 0 0 12px 0;">
          You were added to project <strong>${input.projectName}</strong>.
        </p>
        <p style="margin: 0 0 16px 0;">
          Click below to open the project dashboard:
        </p>
        <p style="margin: 0 0 20px 0;">
          <a
            href="${input.projectUrl}"
            style="display: inline-block; background: #6d28d9; color: #ffffff; padding: 10px 14px; text-decoration: none; border-radius: 6px; font-weight: 600;"
          >
            Open Project
          </a>
        </p>
        <p style="margin: 0; font-size: 12px; color: #6b7280;">
          Direct link: ${input.projectUrl}
        </p>
      </div>
    `,
  });

  if (error) {
    throw new ApiHttpError(
      500,
      "EMAIL_SEND_FAILED",
      `Failed sending email to ${input.to}`,
      error.message,
    );
  }

  return {
    email: input.to,
    status: "sent",
  };
}
