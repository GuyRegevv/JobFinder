import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true", // false for port 587, true for 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER, // send to yourself for testing
      subject: "Hello from Nodemailer + GMX ✅",
      text: "This is a test email sent with Nodemailer and GMX SMTP!",
    });

    console.log("Message sent:", info.messageId);
  } catch (err) {
    console.error("Error sending mail:", err);
  }
}

main();
