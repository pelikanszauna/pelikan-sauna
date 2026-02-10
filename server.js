import express from "express";
import fs from "fs";
import path from "path";
import Stripe from "stripe";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static("public"));

const BOOKINGS_FILE = path.join(process.cwd(), "bookings.json");
const MAX_SPOTS = 6;
const PRICE_PER_PERSON = 2500; // HUF

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY); // set in Render env

// Load/save bookings
function loadBookings() {
  if (!fs.existsSync(BOOKINGS_FILE)) return [];
  return JSON.parse(fs.readFileSync(BOOKINGS_FILE, "utf8"));
}

function saveBookings(bookings) {
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
}

// Spots taken helper
function spotsTaken(bookings, day, time) {
  return bookings.filter(b => b.day === day && b.time === time)
                 .reduce((sum, b) => sum + b.people, 0);
}

// ----------------- API -----------------

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

    const newBooking = { bookingNumber, day, time, people, name, email, phone, payment, createdAt: new Date().toISOString() };
    bookings.push(newBooking);
    saveBookings(bookings);

    // CARD PAYMENT → create Stripe Checkout session
    if (payment === "card") {
      const totalPrice = PRICE_PER_PERSON * people; // HUF
      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [{
            price_data: {
              currency: "huf",
              product_data: { name: `Pelikan Sauna Booking #${bookingNumber}` },
              unit_amount: totalPrice // HUF, integer_
