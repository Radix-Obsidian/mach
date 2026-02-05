import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8080";

export function useStripe() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectToCheckout = async (planTier: "starter" | "pro") => {
    setLoading(true);
    setError(null);

    try {
      // Get Stripe publishable key from environment
      const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
      if (!publishableKey) {
        throw new Error("Stripe publishable key not configured");
      }

      // Load Stripe
      const stripe = await loadStripe(publishableKey);
      if (!stripe) {
        throw new Error("Failed to load Stripe");
      }

      // Get session ID from backend
      const response = await fetch(`${API_BASE}/api/stripe/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getSessionToken()}`,
        },
        body: JSON.stringify({ plan_tier: planTier }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create checkout session");
      }

      const { session_id } = await response.json();

      // Redirect to Stripe checkout
      const { error: redirectError } = await stripe.redirectToCheckout({
        sessionId: session_id,
      });

      if (redirectError) {
        throw redirectError;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Checkout failed";
      setError(message);
      console.error("Stripe error:", err);
    } finally {
      setLoading(false);
    }
  };

  async function getSessionToken(): Promise<string> {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("No authentication token found");
    }
    return session.access_token;
  }

  return {
    redirectToCheckout,
    loading,
    error,
  };
}
