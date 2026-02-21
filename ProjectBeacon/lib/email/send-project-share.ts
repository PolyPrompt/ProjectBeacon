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
  joinUrl: string;
  projectId: string;
}): Promise<{ email: string; status: "sent" }> {
  const resend = getResendClient();

  const { error } = await resend.emails.send({
    from: "Project Beacon <onboarding@resend.dev>",
    to: input.to,
    subject: "You are invited to a Project Beacon workspace",
    text: `Join project ${input.projectId} using this link: ${input.joinUrl}`,
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
