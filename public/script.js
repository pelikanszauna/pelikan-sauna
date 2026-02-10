// script.js
const daySelect = document.getElementById("daySelect");
const timeSelect = document.getElementById("timeSelect");
const peopleInput = document.getElementById("peopleInput");
const totalPrice = document.getElementById("totalPrice");
const messageBox = document.getElementById("messageBox");
const form = document.getElementById("bookingForm");
const spinner = document.getElementById("spinner");

const PRICE_PER_PERSON = 2500;
const MAX_SPOTS = 6;

// ----------------- PRICE -----------------
function updateTotal() {
  totalPrice.textContent = peopleInput.value * PRICE_PER_PERSON;
}
peopleInput.addEventListener("input", updateTotal);
updateTotal();

// ----------------- SESSIONS -----------------
const DAYS = ["2026-02-01", "2026-02-02", "2026-02-03"];
const TIMES = ["10:00", "11:30", "13:00"];

DAYS.forEach(d => {
  const opt = document.createElement("option");
  opt.value = d;
  opt.textContent = d;
  daySelect.appendChild(opt);
});

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
      opt.textContent = `${t} (${remaining} spots left)`;
      opt.value = t;
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
        if (peopleInput.value > remaining) peopleInput.value = remaining;
      }

      updateTotal();
    });
}

daySelect.addEventListener("change", loadAvailability);
timeSelect.addEventListener("change", adjustPeopleLimit);

loadAvailability();

// ----------------- FORM SUBMIT -----------------
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  messageBox.textContent = "";
  spinner.style.display = "inline-block";
  document.getElementById("submitBtn").disabled = true;

  const paymentMethod = document.getElementById("cardRadio").checked ? "card" : "cash";

  const bookingData = {
    day: daySelect.value,
    time: timeSelect.value,
    people: Number(peopleInput.value),
    name: document.getElementById("nameInput").value.trim(),
    email: document.getElementById("emailInput").value.trim(),
    phone: document.getElementById("phoneInput").value.trim(),
    payment: paymentMethod
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
    } else {
      if (paymentMethod === "cash") {
        messageBox.textContent = `Booking successful! Your number: ${data.bookingNumber}`;
        form.reset();
        loadAvailability();
      } else {
        // CARD PAYMENT: create Stripe checkout session
        const checkoutRes = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingNumber: data.bookingNumber,
            amount: data.people * PRICE_PER_PERSON
          })
        });

        const checkoutData = await checkoutRes.json();
        if (checkoutData.url) {
          window.location.href = checkoutData.url;
        } else {
          messageBox.textContent = "Stripe checkout failed.";
        }
      }
    }
  } catch (err) {
    console.error(err);
    messageBox.textContent = "Server error. Try again later.";
  }

  spinner.style.display = "none";
  document.getElementById("submitBtn").disabled = false;
});
