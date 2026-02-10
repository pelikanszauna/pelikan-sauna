import express from "express";
import fs from "fs";
import path from "path";
import Stripe from "stripe";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static("public"));
app.use(bodyParser.json());

const BOOKINGS_FILE = path.join(process.cwd(), "bookings.json");
const MAX_SPOTS = 6;
const PRICE = 2500; // HUF

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY); // Make sure this is set in Render env

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

// Availability
app.get("/api/availability", (req, res) => {
  const bookings = loadBookings();
  const availability = {};
  bookings.forEach(b => {
    const key = `${b.day}|${b.time}`;
    availability[key] = (availability[key] || 0) + b.people;
  });
  res.json(availability);
});

// Booking
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
    const booking = { bookingNumber, day, time, people, name, email, phone, payment, createdAt: new Date().toISOString() };
    bookings.push(booking);
    saveBookings(bookings);

    if (payment === "card") {
      // Stripe checkout
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "huf",
              product_data: { name: `Pelikan Sauna ${day} ${time}` },
             unit_amount: (PRICE * people) * 100, // HUF, **do not divide by 100**
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${req.protocol}://${req.get("host")}/success.html`,
        cancel_url: `${req.protocol}://${req.get("host")}/cancel.html`,
      });

      return res.json({ paymentUrl: session.url });
    }

    // Cash booking
    res.json({ bookingNumber });

  } catch (err) {
    console.error("Booking error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
