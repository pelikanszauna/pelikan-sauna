const daySelect = document.getElementById("daySelect");
const timeSelect = document.getElementById("timeSelect");
const peopleInput = document.getElementById("peopleInput");
const totalPriceEl = document.getElementById("totalPrice");
const form = document.getElementById("bookingForm");
const messageBox = document.getElementById("messageBox");
const spinner = document.getElementById("spinner");

const PRICE_PER_PERSON = 2500;
const MAX_SPOTS = 6;

const DAYS = ["2026-02-01", "2026-02-02", "2026-02-03"];
const TIMES = ["10:00", "11:30", "13:00"];

// Populate day select
DAYS.forEach(d => {
  const opt = document.createElement("option");
  opt.value = d;
  opt.textContent = d;
  daySelect.appendChild(opt);
});

// Update total price
function updatePrice() {
  totalPriceEl.textContent = Number(peopleInput.value) * PRICE_PER_PERSON;
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
    opt.value = t;

    if (remaining <= 0) {
      opt.textContent = `${t} (FULL)`;
      opt.disabled = true;
    } else {
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
      const remaining = MAX_SPOTS - (data[key] || 0);

      peopleInput.max = remaining;
      if (peopleInput.value > remaining) peopleInput.value = remaining;

      peopleInput.disabled = remaining <= 0;
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
  spinner.style.display = "inline-block";
  form.querySelector("#submitBtn").disabled = true;

  if (!daySelect.value || !timeSelect.value || peopleInput.value < 1) {
    messageBox.textContent = "Please select a session and number of people";
    spinner.style.display = "none";
    form.querySelector("#submitBtn").disabled = false;
    return;
  }

  if (!document.getElementById("nameInput").value.trim() ||
      !document.getElementById("emailInput").value.trim() ||
      !document.getElementById("phoneInput").value.trim() ||
      !document.getElementById("dontBotherCheckbox").checked) {
    messageBox.textContent = "Please fill all fields and accept sauna rules";
    spinner.style.display = "none";
    form.querySelector("#submitBtn").disabled = false;
    return;
  }

  const bookingData = {
    day: daySelect.value,
    time: timeSelect.value,
    people: Number(peopleInput.value),
    name: document.getElementById("nameInput").value.trim(),
    email: document.getElementById("emailInput").value.trim(),
    phone: document.getElementById("phoneInput").value.trim(),
    payment: document.querySelector('input[name="payment"]:checked').value
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
    } else if (data.paymentUrl) {
      // Card payment → redirect to Stripe
      window.location.href = data.paymentUrl;
    } else {
      messageBox.textContent = `Booking successful! Your number: ${data.bookingNumber}`;
      form.reset();
      loadAvailability();
    }
  } catch (err) {
    console.error("Booking error:", err);
    messageBox.textContent = "Server error. Try again later.";
  }

  spinner.style.display = "none";
  form.querySelector("#submitBtn").disabled = false;
});
