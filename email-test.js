import nodemailer from "nodemailer";
import { google } from "googleapis";
import dotenv from "dotenv";
dotenv.config();

const oAuth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET
);
oAuth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

async function testEmail() {
  try {
    const accessToken = await oAuth2Client.getAccessToken();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.EMAIL_USER,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        accessToken: accessToken.token
      },
      logger: true,
      debug: true
    });

    const info = await transporter.sendMail({
      from: `"Pelikan Szauna" <${process.env.EMAIL_USER}>`,
      to: "pelikanszauna@gmail.com",
      subject: "Test Email",
      text: "This is a test email from sauna booking server."
    });

    console.log("✅ Email sent:", info);
  } catch (err) {
    console.error("❌ Email sending failed:", err);
  }
}

testEmail();
// JavaScript Document