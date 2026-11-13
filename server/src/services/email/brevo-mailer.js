import { env } from "../../config/env.js";

const sendEmailUrl = "https://api.brevo.com/v3/smtp/email";

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

export async function sendAccountActionEmail({ recipientEmail, recipientName, subject, heading, description, actionLabel, actionUrl, expiryText }) {
  if (!env.BREVO_API_KEY || !env.BREVO_SENDER_NAME || !env.BREVO_SENDER_EMAIL) {
    throw Object.assign(new Error("Brevo email delivery is not configured"), { code: "BREVO_NOT_CONFIGURED" });
  }

  const safeName = escapeHtml(recipientName || "there");
  const safeHeading = escapeHtml(heading);
  const safeDescription = escapeHtml(description);
  const safeActionLabel = escapeHtml(actionLabel);
  const safeActionUrl = escapeHtml(actionUrl);
  const safeExpiryText = escapeHtml(expiryText);
  const htmlContent = `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#17212b"><main style="max-width:560px;margin:32px auto;padding:28px;background:#fff;border:1px solid #dce2e8;border-radius:10px"><p>Hello ${safeName},</p><h1 style="font-size:21px">${safeHeading}</h1><p style="font-size:15px;line-height:1.6">${safeDescription}</p><p style="margin:26px 0"><a href="${safeActionUrl}" style="display:inline-block;padding:12px 18px;background:#275ea8;color:#fff;text-decoration:none;border-radius:6px">${safeActionLabel}</a></p><p style="font-size:13px;color:#5c6874">This link expires in ${safeExpiryText}. If you did not request this, you can ignore this message.</p><p style="font-size:12px;color:#7c8792">ChainGuard account security</p></main></body></html>`;
  let response;
  try {
    response = await fetch(sendEmailUrl, {
      method: "POST",
      headers: { accept: "application/json", "api-key": env.BREVO_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        sender: { name: env.BREVO_SENDER_NAME, email: env.BREVO_SENDER_EMAIL },
        to: [{ email: recipientEmail, name: recipientName || undefined }],
        subject,
        htmlContent,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw Object.assign(new Error("Brevo email delivery request failed"), { code: "BREVO_REQUEST_FAILED" });
  }

  if (!response.ok) {
    throw Object.assign(new Error("Brevo rejected the email delivery request"), { code: "BREVO_REJECTED_REQUEST" });
  }
  return true;
}
