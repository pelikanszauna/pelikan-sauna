import express from "express";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { google } from "googleapis";
import Stripe from "stripe";

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.resolve();

// ---------------- CONFIG ----------------
const MAX_SPOTS = 6;
const PRICE = 2500;
const BOOKINGS_FILE = path.join(__dirname, "bookings.json");

app.use(express.json());
app.use(express.static("public"));

// ---------------- STORAGE ----------------
function loadBookings() {
  if (!fs.existsSync(BOOKINGS_FILE)) return [];
  return JSON.parse(fs.readFileSync(BOOKINGS_FILE, "utf8"));
}

function saveBookings(data) {
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(data, null, 2));
}

// ---------------- EMAIL (non-blocking) ----------------
const oAuth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET
);
oAuth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN
});

async function sendEmail(to, subject, text) {
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
      }
    });

    await transporter.sendMail({
      from: `"Pelikan Szauna" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text
    });
  } catch (err) {
    console.error("Email failed, booking still saved:", err.message);
  }
}

// ---------------- HELPERS ----------------
function spotsTaken(bookings, day, time) {
  return bookings
    .filter(b => b.day === day && b.time === time)
    .reduce((sum, b) => sum + b.people, 0);
}

// ---------------- API ----------------

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

    if (!day || !time || !people || !name || !email || !payment) {
      return res.status(400).json({ error: "Missing data" });
    }

    const bookings = loadBookings();
    const taken = spotsTaken(bookings, day, time);

    if (taken + people > MAX_SPOTS) {
      return res.status(400).json({ error: "This session is fully booked" });
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

    // send emails asynchronously (don't block booking)
    const message = `
Booking number: ${bookingNumber}
Name: ${name}
Date: ${day}
Time: ${time}
People: ${people}
Payment: ${payment}
`;

    sendEmail(email, `Pelikan Szauna Booking #${bookingNumber}`, `Thank you for your booking!\n${message}`);
    sendEmail("pelikanszauna@gmail.com", `New booking #${bookingNumber}`, message);

    // ---------------- STRIPE PAYMENT ----------------
    if (payment === "card" && process.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "huf",
            product_data: { name: `Sauna Booking #${bookingNumber}` },
            unit_amount: PRICE * people
          },
          quantity: 1
        }],
        mode: "payment",
        success_url: `${req.headers.origin}/success.html?booking=${bookingNumber}`,
        cancel_url: `${req.headers.origin}/cancel.html`
      });

      return res.json({ success: true, bookingNumber, stripeSessionId: session.id });
    }

    // cash booking
    res.json({ success: true, bookingNumber });
  } catch (err) {
    console.error("Booking error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------- START SERVER ----------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
