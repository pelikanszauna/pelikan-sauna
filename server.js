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

/* -------------------- STORAGE -------------------- */

const BOOKINGS_FILE = path.join(__dirname, "bookings.json");

function loadBookings() {
  if (!fs.existsSync(BOOKINGS_FILE)) return [];
  return JSON.parse(fs.readFileSync(BOOKINGS_FILE, "utf8"));
}

function saveBookings(bookings) {
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
}

/* -------------------- EMAIL (GMAIL OAUTH2) -------------------- */

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
    }
  });

  await transporter.sendMail({
    from: `"Pelikan Szauna" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text
  });
}

/* -------------------- HELPERS -------------------- */

const MAX_SLOTS = 6;

function slotsTaken(bookings, date, session) {
  return bookings
    .filter(b => b.date === date && b.session === session)
    .reduce((sum, b) => sum + b.persons, 0);
}

/* -------------------- API -------------------- */

// availability for frontend
app.get("/api/availability", (req, res) => {
  const bookings = loadBookings();
  const result = {};

  bookings.forEach(b => {
    const key = `${b.date}_${b.session}`;
    result[key] = (result[key] || 0) + b.persons;
  });

  res.json(result);
});

// create booking
app.post("/api/book", async (req, res) => {
  try {
    const {
      name,
      email,
      day,       // 👈 coming from frontend
      time,      // 👈 coming from frontend
      people,
      payment
    } = req.body;

    if (!name || !email || !day || !time || !people) {
      return res.status(400).json({ error: "Missing data" });
    }

    const bookings = loadBookings();
    const taken = bookings
      .filter(b => b.day === day && b.time === time)
      .reduce((sum, b) => sum + b.people, 0);

    if (taken + people > 6) {
      return res.status(400).json({
        error: "This session is fully booked"
      });
    }

    const bookingNumber = Date.now();

    const booking = {
      bookingNumber,
      name,
      email,
      day,
      time,
      people,
      payment,
      createdAt: new Date().toISOString()
    };

    bookings.push(booking);
    saveBookings(bookings);

    const message = `
Booking number: ${bookingNumber}

Name: ${name}
Date: ${day}
Time: ${time}
People: ${people}
Payment: ${payment}
`;

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

    res.json({ success: true, bookingNumber });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


/* -------------------- START -------------------- */

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
