import express from "express";
import sqlite3 from "sqlite3";
import Stripe from "stripe";
import nodemailer from "nodemailer";

const app = express();
const db = new sqlite3.Database("./db.sqlite");

// Use environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(express.json());
app.use(express.static("public"));

// Create bookings table
db.run(`
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT,
  time TEXT,
  people INTEGER,
  name TEXT,
  email TEXT,
  phone TEXT
)
`);

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// -------- AVAILABILITY ENDPOINT --------
app.get("/api/availability", (req, res) => {
  const { day, time } = req.query;

  db.get(
    `SELECT COALESCE(SUM(people),0) AS booked FROM bookings WHERE day=? AND time=?`,
    [day, time],
    (err, row) => {
      if (err) return res.status(500).json({ error: "Database error" });
      const remaining = 6 - row.booked;
      res.json({ remaining });
    }
  );
});

// -------- BOOKING ENDPOINT --------
app.post("/api/book", (req, res) => {
  const { day, time, people, name, email, phone } = req.body;

  if (!day || !time || !people || !name || !email || !phone) {
    return res.status(400).json({ error: "Missing booking data" });
  }

  // Check availability
  db.get(
    `SELECT COALESCE(SUM(people),0) AS booked FROM bookings WHERE day=? AND time=?`,
    [day, time],
    (err, row) => {
      if (err) return res.status(500).json({ error: "Database error" });

      const remaining = 6 - row.booked;

      if (people > remaining) {
        return res.json({ error: `Only ${remaining} places left for this session` });
      }

      // Save booking
      db.run(
        `INSERT INTO bookings (day,time,people,name,email,phone) VALUES (?,?,?,?,?,?)`,
        [day, time, people, name, email, phone],
        (err) => {
          if (err) return res.status(500).json({ error: "Database insert error" });

          // Send emails
          // 1️⃣ Customer email
          transporter.sendMail({
            from: `"Pelikan Sauna" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Booking Confirmation - Pelikan Sauna",
            text: `Hi ${name},\n\nYour booking is confirmed!\n\nDate: ${day}\nTime: ${time}\nPeople: ${people}\n\nThank you for choosing Pelikan Sauna.`
          });

          // 2️⃣ Admin email
          transporter.sendMail({
            from: `"Pelikan Sauna" <${process.env.EMAIL_USER}>`,
            to: "pelikanszauna@gmail.com",
            subject: "New Booking Received",
            text: `New booking:\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nDate: ${day}\nTime: ${time}\nPeople: ${people}`
          });

          res.json({ success: true });
        }
      );
    }
  );
});

// -------- STRIPE PAYMENT ENDPOINT --------
app.post("/api/pay", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "huf",
          product_data: { name: "Pelikan Sauna Session" },
          unit_amount: req.body.amount * 100
        },
        quantity: 1
      }],
      success_url: "https://pelikanbudapest.onrender.com/success.html",
      cancel_url: "https://pelikanbudapest.onrender.com/cancel.html"
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Stripe error" });
  }
});

// -------- START SERVER --------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
