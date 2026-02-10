import express from "express";
import fs from "fs";
import path from "path";
import Stripe from "stripe";

const app = express();
const PORT = process.env.PORT || 10000;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(express.json());
app.use(express.static("public"));

const BOOKINGS_FILE = path.join(process.cwd(), "bookings.json");
const MAX_SPOTS = 6;

// ---------------- HELPERS ----------------
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

// ---------------- ROUTES ----------------
app.get("/api/availability", (req, res) => {
  const bookings = loadBookings();
  const availability = {};
  bookings.forEach(b => {
    const key = `${b.day}|${b.time}`;
    availability[key] = (availability[key] || 0) + b.people;
  });
  res.json(availability);
});

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
    const totalAmountHUF = people * 2500;

    const booking = { bookingNumber, day, time, people, name, email, payment, createdAt: new Date().toISOString() };
    bookings.push(booking);
    saveBookings(bookings);

    if (payment === "card") {
      // Stripe session
      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [{
            price_data: {
              currency: "huf",
              product_data: { name: `Pelikan Sauna booking #${bookingNumber}` },
              unit_amount: totalAmountHUF // make sure this is a number
            },
            quantity: 1
          }],
          mode: "payment",
          success_url: `${req.headers.origin}/success.html`,
          cancel_url: `${req.headers.origin}/cancel.html`
        });
        return res.json({ paymentUrl: session.url });
      } catch (err) {
        console.error("Stripe session creation error:", err);
        return res.status(500).json({ error: "Stripe checkout failed" });
      }
    }

    // Cash payment
    res.json({ success: true, bookingNumber });
  } catch (err) {
    console.error("Booking error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------- START SERVER ----------------
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
