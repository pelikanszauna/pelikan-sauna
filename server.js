import express from "express";
import sqlite3 from "sqlite3";
import Stripe from "stripe";
import nodemailer from "nodemailer";

const app = express();
const db = new sqlite3.Database("./db.sqlite");

// Stripe & environment
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(express.json());
app.use(express.static("public"));

// Database table
db.run(`
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_number INTEGER UNIQUE,
  day TEXT,
  time TEXT,
  people INTEGER,
  name TEXT,
  email TEXT,
  phone TEXT
)
`);

// Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// -------- AVAILABILITY --------
app.get("/api/availability", (req, res) => {
  const { day, time } = req.query;
  db.get(
    `SELECT COALESCE(SUM(people),0) AS booked FROM bookings WHERE day=? AND time=?`,
    [day, time],
    (err, row) => {
      if (err) return res.status(500).json({ error: "Database error" });
      const remaining = Math.max(0, 6 - row.booked);
      res.json({ remaining });
    }
  );
});

// -------- BOOKING --------
app.post("/api/book", (req, res) => {
  const { day, time, people, name, email, phone } = req.body;

  if (!day || !time || !people || !name || !email || !phone) {
    return res.status(400).json({ error: "Missing booking data" });
  }

  db.get(
    `SELECT COALESCE(SUM(people),0) AS booked FROM bookings WHERE day=? AND time=?`,
    [day, time],
    (err, row) => {
      if (err) return res.status(500).json({ error: "Database error" });

      const remaining = 6 - row.booked;
      if (people > remaining) {
        return res.json({ error: `Only ${remaining} spots left for this session` });
      }

      // Generate booking number
      db.get(`SELECT MAX(booking_number) AS maxNumber FROM bookings`, [], (err, row2) => {
        if (err) return res.status(500).json({ error: "DB error" });
        const booking_number = (row2?.maxNumber || 0) + 1;

        db.run(
          `INSERT INTO bookings (booking_number, day, time, people, name, email, phone) VALUES (?,?,?,?,?,?,?)`,
          [booking_number, day, time, people, name, email, phone],
          async (err) => {
            if (err) return res.status(500).json({ error: "Database insert error" });

            // Send emails
            try {
              await transporter.sendMail({
                from: `"Pelikan Sauna" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: `Booking #${booking_number} Confirmation`,
                text: `Hi ${name},\n\nYour booking #${booking_number} is confirmed!\nDate: ${day}\nTime: ${time}\nPeople: ${people}\n\nThank you for choosing Pelikan Sauna.`
              });

              await transporter.sendMail({
                from: `"Pelikan Sauna" <${p
