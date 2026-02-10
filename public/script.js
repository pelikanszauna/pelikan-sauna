const form = document.getElementById("booking-form");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const hours = Number(document.getElementById("hours").value);
  const paymentMethod = document.querySelector(
    'input[name="payment"]:checked'
  ).value;

  const pricePerHour = 2500; // HUF
  const totalPrice = hours * pricePerHour; // ✅ NO /100

  console.log("Calculated totalPrice:", totalPrice);

  const res = await fetch("/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      totalPrice,
      paymentMethod,
    }),
  });

  const data = await res.json();

  if (data.url) {
    window.location.href = data.url;
  } else {
    alert(data.error || "Checkout failed");
  }
});
