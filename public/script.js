const form = document.getElementById("bookingForm");
const spinner = document.getElementById("spinner");
const messageBox = document.getElementById("messageBox");

const peopleInput = document.getElementById("peopleInput");
const totalPrice = document.getElementById("totalPrice");
const daySelect = document.getElementById("daySelect");
const timeSelect = document.getElementById("timeSelect");

const PRICE_PER_PERSON = 2500;

// ---------------- PRICE CALCULATION ----------------
function updateTotal() {
  const people = Number(peopleInput.value);
  totalPrice.textContent = people * PRICE_PER_PERSON;
}
updateTotal();
peopleInput.addEventListener("input", updateTotal);

// ---------------- LOAD SESSIONS ----------------
async function loadSessions() {
  const res = await fetch("/api/sessions");
  const sessions = await res.json();

  daySelect.innerHTML = "";
  for (const day in sessions) {
    const opt = document.createElement("option");
    opt.value = day;
    opt.textContent = day;
    daySelect.appendChild(opt);
  }

  updateTimeSlots();
}

async function updateTimeSlots() {
  const res = await fetch("/api/sessions");
  const sessions = await res.json();
  const day = daySelect.value;
  const sessionTimes = sessions[day];

  timeSelect.innerHTML = "";
  for (const time in sessionTimes) {
    const remaining = sessionTimes[time].remaining;
    const opt = document.createElement("option");
    opt.value = time;
    opt.textContent =
      remaining === 0 ? `${time} (Fully booked)` : `${time} (${remaining} left)`;
    opt.disabled = remaining === 0;
    timeSelect.appendChild(opt);
  }

  // Update people input max
  const remainingForSelectedTime = sessionTimes[timeSelect.value]?.remaining || 6;
  peopleInput.max = remainingForSelectedTime;
  if (Number(peopleInput.value) > remainingForSelectedTime) peopleInput.value = remainingForSelectedTime;
  updateTotal();
}

daySelect.addEventListener("change", updateTimeSlots);
timeSelect.addEventListener("change", updateTimeSlots);

// ---------------- FORM SUBMIT ----------------
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  messageBox.textContent = "";

  if (!daySelect.value || !timeSelect.value) {
    alert("Please select a session and time");
    return;
  }

  if (!document.getElementById("nameInput").value.trim()) {
    alert("Please enter your name");
    return;
  }
  if (!document.getElementById("emailInput").value.trim()) {
    alert("Please enter your email");
    return;
  }
  if (!document.getElementById("phoneInput").value.trim()) {
    alert("Please enter your phone number");
    return;
  }
  if (!document.getElementById("dontBotherCheckbox").checked) {
    alert("You must accept sauna rules");
    return;
  }

  spinner.style.display = "inline-block";
  document.getElementById("submitBtn").disabled = true;

  const bookingData = {
    day: daySelect.value,
    time: timeSelect.value,
    people: Number(peopleInput.value),
    name: document.getElementById("nameInput").value,
    email: document.getElementById("emailInput").value,
    phone: document.getElementById("phoneInput").value,
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
    } else {
      messageBox.textContent = `Booking successful!`;
      form.reset();
      updateTotal();
      await loadSessions(); // refresh remaining slots
    }
  } catch (err) {
    console.error(err);
    messageBox.textContent = "Server error. Try again later.";
  }

  spinner.style.display = "none";
  document.getElementById("submitBtn").disabled = false;
});

// Initial load
loadSessions();
