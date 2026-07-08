import nodemailer from "nodemailer";

type SendReportEmailInput = {
  to: string;
  subject: string;
  html: string;
  pdf: Buffer;
  filename: string;
};

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST);
}

export async function sendReportEmail({ to, subject, html, pdf, filename }: SendReportEmailInput) {
  const from = process.env.EMAIL_FROM || "Reddify Reports <reports@reddify.me>";

  if (process.env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        attachments: [
          {
            filename,
            content: pdf.toString("base64"),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend email failed with ${response.status}: ${await response.text()}`);
    }

    return;
  }

  if (process.env.SMTP_HOST) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
    });

    await transporter.sendMail({
      from,
      to,
      subject,
      html,
      attachments: [{ filename, content: pdf, contentType: "application/pdf" }],
    });
    return;
  }

  throw new Error("Email is not configured. Add RESEND_API_KEY or SMTP_HOST settings.");
}
