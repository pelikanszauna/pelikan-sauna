import express from "express";
import sqlite3 from "sqlite3";
import Stripe from "stripe";

const app = express();
const db = new sqlite3.Database("./db.sqlite");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(express.json());
app.use(express.static("public"));

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

app.post("/api/book", (req, res) => {
  const { day, time, people, name, email, phone } = req.body;

  db.get(
    "SELECT id FROM bookings WHERE day=? AND time=?",
    [day, time],
    (err, row) => {
      if (row) {
        return res.json({ error: "Slot already booked" });
      }

      db.run(
        "INSERT INTO bookings VALUES (NULL,?,?,?,?,?,?)",
        [day, time, people, name, email, phone],
        () => res.json({ success: true })
      );
    }
  );
});

app.post("/api/pay", async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "huf",
        product_data: { name: "Sauna Session" },
        unit_amount: req.body.amount * 100
      },
      quantity: 1
    }],
    success_url: "https://yourdomain/success.html",
    cancel_url: "https://yourdomain/cancel.html"
  });

  res.json({ url: session.url });
});

app.listen(3000);
