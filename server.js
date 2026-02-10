import express from "express";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { google } from "googleapis";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

/* ---------------- CONFIG ---------------- */

const MAX_SPOTS = 6;
const BOOKINGS_FILE = path.join(__dirname, "bookings.json");

/* ---------------- STORAGE ---------------- */

function loadBookings() {
  if (!fs.existsSync(BOOKINGS_FILE)) return [];
  return JSON.parse(fs.readFileSync(BOOKINGS_FILE, "utf8"));
}

function saveBookings(data) {
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(data, null, 2));
}

/* ---------------- EMAIL (OAuth2) ---------------- */

const oAuth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET
);

oAuth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN
});

async function sendEmail(to, subject, text) {
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
    logger: true,       // <-- add this
    debug: true         // <-- add this
  });

  try {
    const info = await transporter.sendMail({
      from: `"Pelikan Szauna" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text
    });
    console.log("Email sent:", info);
  } catch (err) {
    console.error("Email sending failed:", err);
    throw err;
  }
}


/* ---------------- HELPERS ---------------- */

function spotsTaken(bookings, day, time) {
  return bookings
    .filter(b => b.day === day && b.time === time)
    .reduce((sum, b) => sum + b.people, 0);
}

/* ---------------- API ---------------- */

// availability for frontend
app.get("/api/availability", (req, res) => {
  const bookings = loadBookings();
  const availability = {};

  bookings.forEach(b => {
    const key = `${b.day}|${b.time}`;
    availability[key] = (availability[key] || 0) + b.people;
  });

  res.json(availability);
});

// create booking
app.post("/api/book", async (req, res) => {
  try {
    const { day, time, people, name, email, payment } = req.body;

    if (!day || !time || !people || !name || !email) {
      return res.status(400).json({ error: "Missing data" });
    }

    const bookings = loadBookings();
    const taken = spotsTaken(bookings, day, time);

    if (taken + people > MAX_SPOTS) {
      return res.status(400).json({
        error: "This session is fully booked"
      });
    }

    const bookingNumber = Date.now();

    const booking = {
      bookingNumber,
      day,
      time,
      people,
      name,
      email,
      payment,
      createdAt: new Date().toISOString()
    };

    bookings.push(booking);
    saveBookings(bookings);

    // EMAILS (non-blocking)
    const message = `
Booking number: ${bookingNumber}

Name: ${name}
Date: ${day}
Time: ${time}
People: ${people}
Payment: ${payment}
`;

    try {
      await sendEmail(
        email,
        `Pelikan Szauna Booking #${bookingNumber}`,
        `Thank you for your booking!\n${message}`
      );

      await sendEmail(
        "pelikanszauna@gmail.com",
        `New booking #${bookingNumber}`,
        message
      );
    } catch (emailError) {
      console.error("Email failed, booking still saved:", emailError.message);
    }

    res.json({
      success: true,
      bookingNumber,
      emailStatus: "attempted"
    });

  } catch (err) {
    console.error("Booking error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


/* ---------------- START ---------------- */

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
