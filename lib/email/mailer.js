import nodemailer from "nodemailer";
import "dotenv/config.js";

function toBool(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

export function createMailTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = toBool(process.env.SMTP_SECURE);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) throw new Error("SMTP_HOST is required");

  const auth = user && pass ? { user, pass } : undefined;

  const transport = nodemailer.createTransport({ host, port, secure, auth });
  return transport;
}

export async function sendEmail({
  subject,
  html,
  text,
  attachments,
  to,
  from,
} = {}) {
  const transporter = createMailTransport();

  const resolvedFrom = from || process.env.FROM_EMAIL;
  const resolvedTo = to || process.env.TO_EMAIL;

  if (!resolvedFrom) throw new Error("FROM_EMAIL is required");
  if (!resolvedTo) throw new Error("TO_EMAIL is required");
  if (!subject) throw new Error("subject is required");
  if (!html && !text) throw new Error("html or text is required");

  return transporter.sendMail({
    from: resolvedFrom,
    to: resolvedTo,
    subject,
    text,
    html,
    attachments,
  });
}
