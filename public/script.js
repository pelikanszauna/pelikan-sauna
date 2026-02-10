const daySelect = document.getElementById("daySelect");
const timeSelect = document.getElementById("timeSelect");
const peopleInput = document.getElementById("peopleInput");
const totalPrice = document.getElementById("totalPrice");
const messageBox = document.getElementById("messageBox");
const form = document.getElementById("bookingForm");
const spinner = document.getElementById("spinner");

const PRICE = 2500;
const MAX_SPOTS = 6;
const TIMES = ["10:00", "11:30", "13:00"];
const DAYS = ["26.02.01", "26.02.02", "26.02.03"];

// ---------------- INIT ----------------
DAYS.forEach(d => {
  const opt = document.createElement("option");
  opt.value = d;
  opt.textContent = d;
  daySelect.appendChild(opt);
});

// ---------------- PRICE ----------------
function updatePrice() {
  totalPrice.textContent = peopleInput.value * PRICE;
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

      updatePrice();
    });
}

daySelect.addEventListener("change", loadAvailability);
timeSelect.addEventListener("change", adjustPeopleLimit);

loadAvailability();

// ---------------- SUBMIT ----------------
form.addEventListener("submit", async e => {
  e.preventDefault();
  messageBox.textContent = "";
  spinner.style.display = "inline-block";
  document.getElementById("submitBtn").disabled = true;

  if (!timeSelect.value || peopleInput.value < 1) {
    messageBox.textContent = "This session is fully booked.";
    spinner.style.display = "none";
    document.getElementById("submitBtn").disabled = false;
    return;
  }

  const paymentMethod = document.querySelector('input[name="payment"]:checked')?.id === "cardRadio" ? "card" : "cash";

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
      messageBox.textContent = `Booking successful! Your number: ${data.bookingNumber}`;

      if (data.stripeSessionId) {
        // Stripe checkout redirect
        const stripe = Stripe("pk_live_51SwkvQPlKb0t3bXyXekkalxeZrtiEYJijjpWJTGBVU0kcNtpEy1MKyrBbEjuwknlLEoaqoT9MqXsVjnPbAsjTU7200ScbEHI4b");
        stripe.redirectToCheckout({ sessionId: data.stripeSessionId });
        return;
      }

      form.reset();
      loadAvailability();
    }
  } catch (err) {
    console.error(err);
    messageBox.textContent = "Server error. Try again later.";
  }

  spinner.style.display = "none";
  document.getElementById("submitBtn").disabled = false;
});
