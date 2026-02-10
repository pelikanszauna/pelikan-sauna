const form = document.getElementById("bookingForm");
const spinner = document.getElementById("spinner");
const messageBox = document.getElementById("messageBox");

const peopleInput = document.getElementById("peopleInput");
const totalPrice = document.getElementById("totalPrice");

const daySelect = document.getElementById("daySelect");
const timeSelect = document.getElementById("timeSelect");
const cardRadio = document.getElementById("cardRadio");
const dontBotherCheckbox = document.getElementById("dontBotherCheckbox");
const nameInput = document.getElementById("nameInput");
const emailInput = document.getElementById("emailInput");
const phoneInput = document.getElementById("phoneInput");
const submitBtn = document.getElementById("submitBtn");

// -------- SESSION DAYS --------
const sessions = [
  "Arasztópart 26.02.01",
  "Arasztópart 26.02.02",
  "Arasztópart 26.02.03"
];

sessions.forEach(s => {
  const opt = document.createElement("option");
  opt.value = s;
  opt.textContent = s;
  daySelect.appendChild(opt);
});

// -------- PRICE CALCULATION --------
function updateTotal() {
  const people = Number(peopleInput.value);
  totalPrice.textContent = people * 2500;
}
updateTotal();
peopleInput.addEventListener("input", updateTotal);

// -------- AVAILABILITY CHECK --------
async function updateAvailability() {
  if (!daySelect.value || !timeSelect.value) return;

  try {
    const res = await fetch(
      `/api/availability?day=${encodeURIComponent(daySelect.value)}&time=${encodeURIComponent(timeSelect.value)}`
    );
    const data = await res.json();

    const maxPeople = data.remaining;

    if (maxPeople === 0) {
      peopleInput.value = 0;
      peopleInput.disabled = true;
      submitBtn.disabled = true;
      messageBox.textContent = "This session is fully booked";
    } else {
      peopleInput.disabled = false;
      submitBtn.disabled = false;
      peopleInput.min = 1;
      peopleInput.max = maxPeople;
      if (Number(peopleInput.value) > maxPeople) peopleInput.value = maxPeople;
      messageBox.textContent = "";
    }

    updateTotal();
  } catch (err) {
    console.error("Availability error:", err);
  }
}

// Update availability on load and on selection
window.addEventListener("DOMContentLoaded", updateAvailability);
daySelect.addEventListener("change", updateAvailability);
timeSelect.addEventListener("change", updateAvailability);

// -------- FORM SUBMIT --------
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  messageBox.textContent = "";

  if (!daySelect.value) return alert("Select day");
  if (!timeSelect.value) return alert("Select time");
  if (!nameInput.value.trim()) return alert("Enter name");
  if (!emailInput.value.trim()) return alert("Enter email");
  if (!phoneInput.value.trim()) return alert("Enter phone");
  if (!dontBotherCheckbox.checked) return alert("Accept rules");

  if (Number(peopleInput.value) === 0) return alert("No spots available");

  spinner.style.display = "inline";
  submitBtn.disabled = true;

  const people = Number(peopleInput.value);

const bookingData = {
  day: daySelect.value,
  time: document.getElementById("timeSelect").value,
  people: Number(peopleInput.value),
  name: document.getElementById("nameInput").value.trim(),
  email: document.getElementById("emailInput").value.trim(),
  payment: document.getElementById("cashRadio").checked ? "cash" : "card"
};

await fetch("/api/book", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(bookingData)
});


    const data = await res.json();

    if (data.error) {
      messageBox.textContent = data.error;
    } else {
      if (cardRadio.checked) {
        const payRes = await fetch("/api/pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: people * 2500 })
        });
        const payData = await payRes.json();
        window.location.href = payData.url;
      } else {
        messageBox.textContent = `Booking #${data.booking_number} successful!`;
        form.reset();
        updateTotal();
        updateAvailability();
      }
    }
  } catch (err) {
    console.error(err);
    messageBox.textContent = "Server error";
  }

  spinner.style.display = "none";
  submitBtn.disabled = false;
});
