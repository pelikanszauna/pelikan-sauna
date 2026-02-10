const daySelect = document.getElementById("daySelect");
const timeSelect = document.getElementById("timeSelect");
const peopleInput = document.getElementById("peopleInput");
const totalPrice = document.getElementById("totalPrice");
const messageBox = document.getElementById("messageBox");
const form = document.getElementById("bookingForm");

const PRICE_PER_PERSON = 2500;
const MAX_SPOTS = 6;

const DAYS = ["2026-02-01", "2026-02-02", "2026-02-03"];
const TIMES = ["10:00", "11:30", "13:00"];

// Populate days
DAYS.forEach(d => {
  const opt = document.createElement("option");
  opt.value = d;
  opt.textContent = d;
  daySelect.appendChild(opt);
});

// Price update
function updatePrice() {
  totalPrice.textContent = peopleInput.value * PRICE_PER_PERSON;
}
peopleInput.addEventListener("input", updatePrice);
updatePrice();

// Load availability
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
  const key = `${daySelect.value}|${timeSelect.value}`;
  fetch("/api/availability")
    .then(r => r.json())
    .then(data => {
      const taken = data[key] || 0;
      const remaining = MAX_SPOTS - taken;

      if (remaining <= 0) {
        peopleInput.disabled = true;
        peopleInput.value = 0;
      } else {
        peopleInput.disabled = false;
        peopleInput.min = 1;
        peopleInput.max = remaining;
        if (peopleInput.value > remaining) peopleInput.value = remaining;
      }
      updatePrice();
    });
}

daySelect.addEventListener("change", loadAvailability);
timeSelect.addEventListener("change", adjustPeopleLimit);
loadAvailability();

// Form submit
form.addEventListener("submit", async e => {
  e.preventDefault();
  messageBox.textContent = "";

  if (!daySelect.value || !timeSelect.value) {
    messageBox.textContent = "Select session and time";
    return;
  }

  const bookingData = {
    day: daySelect.value,
    time: timeSelect.value,
    people: Number(peopleInput.value),
    name: document.getElementById("nameInput").value.trim(),
    email: document.getElementById("emailInput").value.trim(),
    phone: document.getElementById("phoneInput").value.trim(),
    payment: document.getElementById("cardRadio").checked ? "card" : "cash"
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

    // Redirect to Stripe if card
    if (data.redirectUrl) {
      window.location.href = data.redirectUrl;
    } else {
      messageBox.textContent = `Booking successful! Your number: ${data.bookingNumber}`;
      form.reset();
      loadAvailability();
    }

  } catch (err) {
    console.error(err);
    messageBox.textContent = "Server error. Try again later.";
  }
});
