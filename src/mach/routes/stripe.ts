import { Router } from "express";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { authenticateUser, AuthenticatedRequest } from "../middleware/auth.js";
import crypto from "crypto";

const router = Router();

// Initialize Stripe
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

// Lazy Supabase init
let _supabase: ReturnType<typeof createClient> | null | undefined;
function getSupabase() {
  if (_supabase === undefined) {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    _supabase = url && key ? createClient(url, key) : null;
  }
  return _supabase;
}

// Create checkout session
router.post(
  "/stripe/create-checkout-session",
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    if (!stripe) {
      return res.status(503).json({ error: "Stripe not configured" });
    }

    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { plan_tier } = req.body as { plan_tier?: string };

    if (!plan_tier || !["starter", "pro"].includes(plan_tier)) {
      return res.status(400).json({ error: "Invalid plan_tier" });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ error: "Supabase not configured" });
    }

    try {
      // Get or create Stripe customer
      let customerId: string;

      // Check if user already has a Stripe customer
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", req.user.id)
        .single();

      if (subscription?.stripe_customer_id) {
        customerId = subscription.stripe_customer_id;
      } else {
        // Create new Stripe customer
        const customer = await stripe.customers.create({
          email: req.user.email,
          metadata: {
            user_id: req.user.id,
          },
        });
        customerId = customer.id;
      }

      // Get price ID from environment
      const priceId =
        plan_tier === "starter"
          ? process.env.STRIPE_PRICE_STARTER
          : process.env.STRIPE_PRICE_PRO;

      if (!priceId) {
        return res.status(500).json({ error: `Price not configured for ${plan_tier}` });
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${process.env.VITE_APP_URL || "http://localhost:8080/app"}/settings?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.VITE_APP_URL || "http://localhost:8080/app"}/settings`,
        metadata: {
          user_id: req.user.id,
          plan_tier,
        },
      });

      return res.json({ session_id: session.id, client_secret: session.client_secret });
    } catch (err) {
      console.error("[Mach Stripe] Checkout failed:", err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : "Checkout failed",
      });
    }
  }
);

// Webhook handler for Stripe events
router.post("/stripe/webhook", async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: "Stripe not configured" });
  }

  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature using raw body
    const rawBody = (req as any).rawBody || req.body;
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      webhookSecret
    ) as Stripe.Event;
  } catch (err) {
    console.error("[Mach Stripe] Webhook signature verification failed:", err);
    return res.status(400).json({ error: "Webhook signature verification failed" });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Get customer to find user ID
        const customer = await stripe.customers.retrieve(customerId);
        const userId = (customer as Stripe.Customer).metadata?.user_id;

        if (!userId) {
          console.warn("[Mach Stripe] No user_id found in customer metadata");
          return res.status(400).json({ error: "User ID not found" });
        }

        // Extract plan tier from subscription
        const priceId = (subscription.items.data[0]?.price as Stripe.Price)?.id;
        let planTier = "free";

        if (priceId === process.env.STRIPE_PRICE_STARTER) {
          planTier = "starter";
        } else if (priceId === process.env.STRIPE_PRICE_PRO) {
          planTier = "pro";
        }

        // Update or create subscription record
        const { error: upsertError } = await supabase
          .from("subscriptions")
          .upsert(
            {
              user_id: userId,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscription.id,
              plan_tier: planTier,
              status: subscription.status as "active" | "past_due" | "trialing" | "canceled",
              current_period_start: new Date(
                subscription.current_period_start * 1000
              ).toISOString(),
              current_period_end: new Date(
                subscription.current_period_end * 1000
              ).toISOString(),
              missions_quota: planTier === "starter" ? 50 : planTier === "pro" ? 500 : 3,
            },
            { onConflict: "user_id" }
          );

        if (upsertError) {
          console.error("[Mach Stripe] Failed to update subscription:", upsertError);
          return res.status(500).json({ error: "Failed to update subscription" });
        }

        console.log(
          `[Mach Stripe] Updated subscription for user ${userId}: ${planTier}`
        );
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Get customer to find user ID
        const customer = await stripe.customers.retrieve(customerId);
        const userId = (customer as Stripe.Customer).metadata?.user_id;

        if (userId) {
          // Revert to free plan
          const { error: updateError } = await supabase
            .from("subscriptions")
            .update({
              plan_tier: "free",
              status: "canceled",
              missions_quota: 3,
            })
            .eq("user_id", userId);

          if (updateError) {
            console.error("[Mach Stripe] Failed to cancel subscription:", updateError);
          } else {
            console.log(`[Mach Stripe] Cancelled subscription for user ${userId}`);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn(`[Mach Stripe] Payment failed for invoice ${invoice.id}`);
        break;
      }

      default:
        console.log(`[Mach Stripe] Unhandled event type: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("[Mach Stripe] Webhook processing failed:", err);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});

export { router as stripeRouter };
