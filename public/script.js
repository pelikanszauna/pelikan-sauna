const daySelect = document.getElementById("daySelect");
const timeSelect = document.getElementById("timeSelect");
const peopleInput = document.getElementById("peopleInput");
const totalPrice = document.getElementById("totalPrice");
const messageBox = document.getElementById("messageBox");
const form = document.getElementById("bookingForm");

const PRICE = 2500;
const MAX_SPOTS = 6;

/* --------- STATIC DAYS & TIMES --------- */
const DAYS = [
  "2026-02-01",
  "2026-02-02",
  "2026-02-03"
];
const TIMES = ["10:00", "11:30", "13:00"];

/* --------- INIT DAYS --------- */
function initDays() {
  daySelect.innerHTML = "";
  DAYS.forEach((day, index) => {
    const opt = document.createElement("option");
    opt.value = day;
    opt.textContent = day;
    if (index === 0) opt.selected = true;
    daySelect.appendChild(opt);
  });
}

/* --------- PRICE --------- */
function updatePrice() {
  totalPrice.textContent = peopleInput.value * PRICE;
}
peopleInput.addEventListener("input", updatePrice);

/* --------- AVAILABILITY --------- */
async function loadAvailability() {
  const res = await fetch("/api/availability");
  const data = await res.json();

  timeSelect.innerHTML = "";
  TIMES.forEach(time => {
    const key = `${daySelect.value}|${time}`;
    const taken = data[key] || 0;
    const remaining = MAX_SPOTS - taken;

    const opt = document.createElement("option");
    if (remaining <= 0) {
      opt.textContent = `${time} (FULL)`;
      opt.disabled = true;
    } else {
      opt.textContent = `${time} (${remaining} spots left)`;
      opt.value = time;
    }

    timeSelect.appendChild(opt);
  });

  adjustPeopleLimit();
}

function adjustPeopleLimit() {
  const selectedTime = timeSelect.value;
  if (!selectedTime) return;

  fetch("/api/availability")
    .then(res => res.json())
    .then(data => {
      const key = `${daySelect.value}|${selectedTime}`;
      const taken = data[key] || 0;
      const remaining = MAX_SPOTS - taken;

      peopleInput.disabled = remaining <= 0;
      peopleInput.min = 1;
      peopleInput.max = remaining;
      if (peopleInput.value > remaining) peopleInput.value = remaining;

      updatePrice();
    });
}

daySelect.addEventListener("change", loadAvailability);
timeSelect.addEventListener("change", adjustPeopleLimit);

/* --------- SUBMIT --------- */
form.addEventListener("submit", async e => {
  e.preventDefault();
  messageBox.textContent = "";

  const payment = document.querySelector('input[name="payment"]:checked').value;

  const bookingData = {
    day: daySelect.value,
    time: timeSelect.value,
    people: Number(peopleInput.value),
    name: document.getElementById("nameInput").value.trim(),
    email: document.getElementById("emailInput").value.trim(),
    phone: document.getElementById("phoneInput").value.trim(),
    payment
  };

  try {
    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingData)
    });

    const data = await res.json();

    if (data.error) {
      messageBox.textContent = data.error;
      return;
    }

    if (data.paymentUrl) {
      // For card payments, just redirect to Stripe
      window.location.href = data.paymentUrl;
    } else {
      // For cash payments, show success immediately
      messageBox.textContent = `Booking successful! Your number: ${data.bookingNumber}`;
      form.reset();
      initDays();
      loadAvailability();
      updatePrice();
    }
  } catch (err) {
    console.error(err);
    messageBox.textContent = "Server error. Try again later.";
  }
});

/* --------- INITIAL LOAD --------- */
initDays();
updatePrice();
loadAvailability();
