import express from "express";
import fs from "fs";
import path from "path";
import Stripe from "stripe";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static("public"));
app.use(bodyParser.json());

// For webhook, we need raw body
app.use("/webhook", express.raw({ type: "application/json" }));

const BOOKINGS_FILE = path.join(process.cwd(), "bookings.json");
const MAX_SPOTS = 6;
const PRICE = 210; // HUF per person

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY); // Must be set in Render env
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET; // Must be set in Render env

/* -------------------- BOOKING STORAGE -------------------- */
function loadBookings() {
  if (!fs.existsSync(BOOKINGS_FILE)) return [];
  return JSON.parse(fs.readFileSync(BOOKINGS_FILE, "utf-8"));
}

function saveBookings(bookings) {
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
}

function spotsTaken(bookings, day, time) {
  return bookings
    .filter(b => b.day === day && b.time === time)
    .reduce((sum, b) => sum + b.people, 0);
}

/* -------------------- AVAILABILITY -------------------- */
app.get("/api/availability", (req, res) => {
  const bookings = loadBookings();
  const availability = {};
  bookings.forEach(b => {
    const key = `${b.day}|${b.time}`;
    availability[key] = (availability[key] || 0) + b.people;
  });
  res.json(availability);
});

/* -------------------- CREATE BOOKING -------------------- */
app.post("/api/book", async (req, res) => {
  try {
    const { day, time, people, name, email, phone, payment } = req.body;

    if (!day || !time || !people || !name || !email || !payment) {
      return res.status(400).json({ error: "Missing booking data" });
    }

    const bookings = loadBookings();
    const taken = spotsTaken(bookings, day, time);

    if (taken + people > MAX_SPOTS) {
      return res.status(400).json({ error: "This session is fully booked" });
    }

    const bookingNumber = Date.now();

    if (payment === "card") {
      // Create Stripe Checkout session WITHOUT saving booking yet
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "huf",
              product_data: { name: `Pelikan Sauna ${day} ${time}` },
              unit_amount: PRICE * people * 100, // Multiply by 100 for Stripe
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${req.protocol}://${req.get("host")}/success.html`,
        cancel_url: `${req.protocol}://${req.get("host")}/cancel.html`,
        metadata: { bookingNumber, day, time, people, name, email, phone }, // store temporarily
      });

      return res.json({ paymentUrl: session.url });
    }

    // Cash booking — save immediately
    const booking = { bookingNumber, day, time, people, name, email, phone, payment, createdAt: new Date().toISOString() };
    bookings.push(booking);
    saveBookings(bookings);

    res.json({ bookingNumber });
  } catch (err) {
    console.error("Booking error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* -------------------- STRIPE WEBHOOK -------------------- */
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { bookingNumber, day, time, people, name, email, phone } = session.metadata;

    // Save booking after successful payment
    const bookings = loadBookings();
    const booking = { bookingNumber, day, time, people: Number(people), name, email, phone, payment: "card", createdAt: new Date().toISOString() };
    bookings.push(booking);
    saveBookings(bookings);

    console.log(`Booking confirmed via Stripe: ${bookingNumber}`);
  }

  res.status(200).end();
});

/* -------------------- START SERVER -------------------- */
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
