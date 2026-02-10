import express from "express";
import Stripe from "stripe";
import cors from "cors";

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

app.post("/create-checkout-session", async (req, res) => {
  try {
    const { totalPrice, paymentMethod } = req.body;

    console.log("RAW totalPrice from frontend:", totalPrice);

    // 🔒 HARD SAFETY CHECK
    const amount = Number(totalPrice);

    if (!Number.isInteger(amount) || amount < 200) {
      return res.status(400).json({
        error: "Invalid amount. Minimum is ~200 HUF.",
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types:
        paymentMethod === "cash" ? [] : ["card"],

      line_items: [
        {
          price_data: {
            currency: "huf",
            product_data: {
              name: "Sauna booking",
            },
            unit_amount: amount, // ✅ NO DIVISION
          },
          quantity: 1,
        },
      ],
      success_url: "https://pelikanszauna.onrender.com/success.html",
      cancel_url: "https://pelikanszauna.onrender.com/cancel.html",
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: "Stripe checkout failed" });
  }
});

app.listen(10000, () => {
  console.log("Server running on port 10000");
});
