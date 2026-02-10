import express from "express";
import fs from "fs";
import path from "path";
import Stripe from "stripe";

const app = express();
const PORT = process.env.PORT || 10000;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY; // Make sure this is your secret key

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });

app.use(express.json());
app.use(express.static("public"));

/* ----------------- CONFIG ----------------- */
const MAX_SPOTS = 6;
const PRICE_PER_PERSON = 2500; // HUF
const BOOKINGS_FILE = path.join(process.cwd(), "bookings.json"); // store in project root
const DAYS = ["2026-02-01", "2026-02-02", "2026-02-03"];
const TIMES = ["10:00", "11:30", "13:00"];

/* ----------------- STORAGE ----------------- */
function loadBookings() {
  if (!fs.existsSync(BOOKINGS_FILE)) return [];
  return JSON.parse(fs.readFileSync(BOOKINGS_FILE, "utf8"));
}

function saveBookings(bookings) {
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
}

function spotsTaken(bookings, day, time) {
  return bookings
    .filter(b => b.day === day && b.time === time)
    .reduce((sum, b) => sum + b.people, 0);
}

/* ----------------- API ----------------- */
// Return remaining spots
app.get("/api/availability", (req, res) => {
  const bookings = loadBookings();
  const availability = {};

  DAYS.forEach(day => {
    TIMES.forEach(time => {
      const key = `${day}|${time}`;
      const taken = spotsTaken(bookings, day, time);
      availability[key] = MAX_SPOTS - taken;
    });
  });

  res.json(availability);
});

// Create booking
app.post("/api/book", (req, res) => {
  const { day, time, people, name, email, phone, payment } = req.body;

  if (!day || !time || !people || !name || !email || !phone || !payment) {
    return res.status(400).json({ error: "Missing data" });
  }

  const bookings = loadBookings();
  const taken = spotsTaken(bookings, day, time);

  if (taken + people > MAX_SPOTS) {
    return res.status(400).json({ error: "Not enough spots left" });
  }

  const bookingNumber = Date.now();

  const booking = { bookingNumber, day, time, people, name, email, phone, payment };
  bookings.push(booking);
  saveBookings(bookings);

  res.json({ success: true, bookingNumber });
});

// Stripe checkout
app.post("/api/checkout", async (req, res) => {
  const { bookingNumber, amount } = req.body;

  if (!amount || isNaN(amount)) return res.status(400).json({ error: "Invalid amount" });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "huf",
            product_data: { name: `Pelikan Sauna Booking #${bookingNumber}` },
            unit_amount: Number(amount)
          },
          quantity: 1
        }
      ],
      mode: "payment",
      success_url: `${req.protocol}://${req.get("host")}/success.html`,
      cancel_url: `${req.protocol}://${req.get("host")}/cancel.html`
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: "Stripe session creation failed" });
  }
});

/* ----------------- START ----------------- */
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
