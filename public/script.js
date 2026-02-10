const daySelect = document.getElementById("daySelect");
const timeSelect = document.getElementById("timeSelect");
const peopleInput = document.getElementById("peopleInput");
const totalPrice = document.getElementById("totalPrice");
const messageBox = document.getElementById("messageBox");
const form = document.getElementById("bookingForm");

const PRICE_PER_PERSON = 2500;
const MAX_SPOTS = 6;
const TIMES = ["10:00", "11:30", "13:00"];
const DAYS = ["2026-02-01", "2026-02-02", "2026-02-03"];

// Populate day select
DAYS.forEach(day => {
  const opt = document.createElement("option");
  opt.value = day;
  opt.textContent = day;
  daySelect.appendChild(opt);
});

// ---------------- PRICE ----------------
function updatePrice() {
  const people = Number(peopleInput.value) || 1;
  totalPrice.textContent = PRICE_PER_PERSON * people;
}
peopleInput.addEventListener("input", updatePrice);
updatePrice();

// ---------------- AVAILABILITY ----------------
async function loadAvailability() {
  const res = await fetch("/api/availability");
  const data = await res.json();

  timeSelect.innerHTML = "";
  TIMES.forEach(t => {
    const key = `${daySelect.value}|${t}`;
    const taken = data[key] || 0;
    const remaining = MAX_SPOTS - taken;

    const opt = document.createElement("option");
    if (remaining <= 0) {
      opt.textContent = `${t} (FULL)`;
      opt.disabled = true;
    } else {
      opt.value = t;
      opt.textContent = `${t} (${remaining} spots left)`;
    }
    timeSelect.appendChild(opt);
  });

  adjustPeopleLimit();
}

function adjustPeopleLimit() {
  const selectedTime = timeSelect.value;
  if (!selectedTime) return;

  fetch("/api/availability")
    .then(r => r.json())
    .then(data => {
      const key = `${daySelect.value}|${selectedTime}`;
      const taken = data[key] || 0;
      const remaining = MAX_SPOTS - taken;

      if (remaining <= 0) {
        peopleInput.disabled = true;
        peopleInput.value = 0;
      } else {
        peopleInput.disabled = false;
        peopleInput.min = 1;
        peopleInput.max = remaining;
        if (Number(peopleInput.value) > remaining) peopleInput.value = remaining;
      }

      updatePrice();
    });
}

daySelect.addEventListener("change", loadAvailability);
timeSelect.addEventListener("change", adjustPeopleLimit);

loadAvailability();

// ---------------- FORM SUBMIT ----------------
form.addEventListener("submit", async e => {
  e.preventDefault();
  messageBox.textContent = "";

  const name = document.getElementById("nameInput").value.trim();
  const email = document.getElementById("emailInput").value.trim();
  const phone = document.getElementById("phoneInput").value.trim();
  const payment = document.getElementById("cardRadio").checked ? "card" : "cash";

  if (!daySelect.value || !timeSelect.value || !peopleInput.value || !name || !email || !phone) {
    messageBox.textContent = "Please fill all fields.";
    return;
  }

  if (!document.getElementById("dontBotherCheckbox").checked) {
    messageBox.textContent = "You must accept sauna rules.";
    return;
  }

  const bookingData = {
    day: daySelect.value,
    time: timeSelect.value,
    people: Number(peopleInput.value),
    name,
    email,
    phone,
    payment
  };

  document.getElementById("submitBtn").disabled = true;

  try {
    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingData)
    });

    const data = await res.json();

    if (data.error) {
      messageBox.textContent = data.error;
      document.getElementById("submitBtn").disabled = false;
      return;
    }

    if (payment === "card" && data.redirectUrl) {
      // Redirect to Stripe
      window.location.href = data.redirectUrl;
    } else {
      messageBox.textContent = `Booking successful! Your number: ${data.bookingNumber}`;
      form.reset();
      loadAvailability();
      document.getElementById("submitBtn").disabled = false;
    }

  } catch (err) {
    console.error("Booking error:", err);
    messageBox.textContent = "Server error. Try again later.";
    do
