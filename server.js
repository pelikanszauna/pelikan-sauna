import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// ----------------- LOWDB -----------------
const adapter = new JSONFile("db.json");
const db = new Low(adapter);

await db.read();
db.data ||= { sessions: {} };

// Initialize sessions if not exist
const sessionDays = ["2026-02-01", "2026-02-02", "2026-02-03"];
const timeSlots = ["10:00", "11:30", "13:00"];
const MAX_PEOPLE = 6;

for (const day of sessionDays) {
  if (!db.data.sessions[day]) db.data.sessions[day] = {};
  for (const time of timeSlots) {
    db.data.sessions[day][time] ||= { bookings: [], remaining: MAX_PEOPLE };
  }
}
await db.write();

// ----------------- ROUTES -----------------
app.post("/api/book", async (req, res) => {
  const { day, time, people, name, email, phone, payment } = req.body;

  if (!day || !time || !people || !name || !email || !phone) {
    return res.status(400).json({ error: "Missing data" });
  }

  const session = db.data.sessions[day]?.[time];
  if (!session) return res.status(400).json({ error: "Invalid session" });

  if (people > session.remaining) {
    return res.status(400).json({ error: "Not enough spots left" });
  }

  const newBooking = {
    name,
    email,
    phone,
    people,
    payment,
    timestamp: Date.now()
  };

  session.bookings.push(newBooking);
  session.remaining -= people;

  await db.write();

  res.json({ success: true });
});

app.get("/api/sessions", async (req, res) => {
  await db.read();
  res.json(db.data.sessions);
});

// ----------------- START SERVER -----------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
