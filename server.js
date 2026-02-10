import express from "express";
import fs from "fs";
import path from "path";
import Stripe from "stripe";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static("public"));

// ---------------- CONFIG ----------------
const BOOKINGS_FILE = path.join(__dirname, "bookings.json");
const MAX_SPOTS = 6;
const PRICE_PER_PERSON = 2500; // HUF

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ---------------- STORAGE ----------------
function loadBookings() {
  if (!fs.existsSync(BOOKINGS_FILE)) return [];
  return JSON.parse(fs.readFileSync(BOOKINGS_FILE, "utf8"));
}

function saveBookings(data) {
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(data, null, 2));
}

function spotsTaken(bookings, day, time) {
  return bookings
    .filter(b => b.day === day && b.time === time)
    .reduce((sum, b) => sum + b.people, 0);
}

// ---------------- API ----------------

// Get availability
app.get("/api/availability", (req, res) => {
  const bookings = loadBookings();
  const availability = {};
  bookings.forEach(b => {
    const key = `${b.day}|${b.time}`;
    availability[key] = (availability[key] || 0) + b.people;
  });
  res.json(availability);
});

// Create booking
app.post("/api/book", async (req, res) => {
  try {
    const { day, time, people, name, email, phone, payment } = req.body;

    if (!day || !time || !people || !name || !email || !phone) {
      return res.status(400).json({ error: "Missing booking info" });
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

    // Stripe Checkout for card payments
    if (payment === "card") {
      let session;
      try {
        session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "huf",
                product_data: {
                  name: `Pelikan Sauna Booking #${bookingNumber}`,
                },
                unit_amount: PRICE_PER_PERSON * people, // must be a number
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: `${req.protocol}://${req.get("host")}/success.html`,
          cancel_url: `${req.protocol}://${req.get("host")}/cancel.html`,
        });
      } catch (err) {
        console.error("Stripe session creation failed:", err);
        return res.status(500).json({ error: "Stripe session creation failed" });
      }

      return res.json({
        bookingNumber,
        redirectUrl: session.url,
      });
    }

    // Cash booking
    res.json({ bookingNumber });

  } catch (err) {
    console.error("Booking error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
