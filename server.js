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
const PRICE = 2500; // HUF per person

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ---------- STORAGE ----------

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

// ---------- AVAILABILITY ----------

app.get("/api/availability", (req, res) => {
  const bookings = loadBookings();
  const availability = {};

  bookings.forEach(b => {
    const key = `${b.day}|${b.time}`;
    availability[key] = (availability[key] || 0) + b.people;
  });

  res.json(availability);
});

// ---------- BOOKING ----------

app.post("/api/book", async (req, res) => {
  try {
    const { day, time, people, name, email, phone, payment } = req.body;

    // 🔒 HARD VALIDATION
    const peopleInt = parseInt(people, 10);

    if (
      !day ||
      !time ||
      !name ||
      !email ||
      !payment ||
      !Number.isInteger(peopleInt) ||
      peopleInt < 1 ||
      peopleInt > MAX_SPOTS
    ) {
      return res.status(400).json({ error: "Invalid booking data" });
    }

    const bookings = loadBookings();
    const taken = spotsTaken(bookings, day, time);

    if (taken + peopleInt > MAX_SPOTS) {
      return res.status(400).json({ error: "This session is fully booked" });
    }

    const bookingNumber = Date.now();

    const booking = {
      bookingNumber,
      day,
      time,
      people: peopleInt, // 👈 INTEGER ONLY
      name,
      email,
      phone,
      payment,
      createdAt: new Date().toISOString()
    };

    bookings.push(booking);
    saveBookings(bookings);

    // ---------- STRIPE ----------
    if (payment === "card") {
      const totalAmount = PRICE * peopleInt; // 2500 * people

      console.log("Stripe amount (HUF):", totalAmount);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "huf",
              product_data: {
                name: `Pelikan Sauna ${day} ${time}`
              },
              unit_amount: totalAmount // 🔒 NEVER DIVIDED
            },
            quantity: 1
          }
        ],
        success_url: `${req.protocol}://${req.get("host")}/success.html`,
        cancel_url: `${req.protocol}://${req.get("host")}/cancel.html`
      });

      return res.json({ paymentUrl: session.url });
    }

    // ---------- CASH ----------
    res.json({ bookingNumber });

  } catch (err) {
    console.error("Booking error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- START ----------

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
