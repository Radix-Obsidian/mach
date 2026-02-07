import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  plan_tier: "free" | "starter" | "pro" | "enterprise";
  status: "active" | "canceled" | "past_due" | "trialing";
  missions_quota: number;
  missions_used: number;
  current_period_start: string;
  current_period_end: string;
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        setLoading(true);

        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setSubscription(null);
          setLoading(false);
          return;
        }

        // Fetch subscription data
        const { data, error: fetchError } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (fetchError && fetchError.code !== "PGRST116") {
          // PGRST116 = no rows found (which is expected for new users)
          throw fetchError;
        }

        if (data) {
          setSubscription(data as Subscription);
        } else {
          // New user - subscription will be auto-created on first mission
          setSubscription(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch subscription";
        setError(message);
        console.error("Subscription fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("subscriptions_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
        },
        (payload) => {
          if (payload.new) {
            setSubscription(payload.new as Subscription);
          }
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const devBypass = import.meta.env.VITE_DEV_UNLIMITED_QUOTA === "1";

  const canCreateMission = (): boolean => {
    if (devBypass) return true;
    if (!subscription) {
      // No subscription yet - free tier allows first mission
      return true;
    }

    return subscription.missions_used < subscription.missions_quota;
  };

  const remainingMissions = (): number => {
    if (devBypass) return 999;
    if (!subscription) return 3; // Free tier default
    return Math.max(0, subscription.missions_quota - subscription.missions_used);
  };

  const quotaPercentage = (): number => {
    if (!subscription) return 0;
    return (subscription.missions_used / subscription.missions_quota) * 100;
  };

  return {
    subscription,
    loading,
    error,
    canCreateMission,
    remainingMissions,
    quotaPercentage,
  };
}
