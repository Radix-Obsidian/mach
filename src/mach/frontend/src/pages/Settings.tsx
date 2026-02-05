import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { useSession } from "@/hooks/useSession";
import { useStripe } from "@/hooks/useStripe";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const navigate = useNavigate();
  const { session } = useSession();
  const { subscription, loading: subLoading } = useSubscription();
  const { redirectToCheckout, loading: checkoutLoading, error: checkoutError } = useStripe();
  const [activeTab, setActiveTab] = useState<"billing" | "profile">("billing");

  const handleUpgrade = async (plan: "starter" | "pro") => {
    await redirectToCheckout(plan);
  };

  const planColors: Record<string, string> = {
    free: "bg-slate-600",
    starter: "bg-blue-600",
    pro: "bg-purple-600",
    enterprise: "bg-gradient-to-r from-purple-600 to-cyan-600",
  };

  const planFeatures: Record<string, string[]> = {
    free: ["3 missions/month", "Individual use only", "Community support"],
    starter: [
      "50 missions/month",
      "Up to 3 team members",
      "Basic analytics",
      "Email support",
    ],
    pro: [
      "500 missions/month",
      "Unlimited team members",
      "Advanced analytics",
      "Priority support",
      "API access",
    ],
    enterprise: [
      "Unlimited missions",
      "Custom integrations",
      "Dedicated support",
      "SLA guarantees",
    ],
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/app")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold">Settings</h1>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-24 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-8"
        >
          {/* Tab navigation */}
          <div className="flex gap-4 border-b border-border/50">
            <button
              onClick={() => setActiveTab("billing")}
              className={`pb-2 px-2 font-mono text-sm transition-colors ${
                activeTab === "billing"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Billing & Subscription
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={`pb-2 px-2 font-mono text-sm transition-colors ${
                activeTab === "profile"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Profile
            </button>
          </div>

          {/* Billing Tab */}
          {activeTab === "billing" && (
            <div className="space-y-6">
              {subLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : subscription ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                >
                  {/* Current plan */}
                  <div className={`${planColors[subscription.plan_tier]} rounded-lg p-6 text-white`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-mono uppercase opacity-80">
                          Current Plan
                        </h3>
                        <p className="text-3xl font-bold mt-2 capitalize">
                          {subscription.plan_tier}
                        </p>
                      </div>
                      {subscription.plan_tier !== "enterprise" && subscription.plan_tier !== "pro" && (
                        <Button
                          onClick={() => handleUpgrade("starter")}
                          disabled={checkoutLoading}
                          className="bg-white text-slate-900 hover:bg-slate-100"
                        >
                          {checkoutLoading ? "Loading..." : "Upgrade"}
                        </Button>
                      )}
                      {subscription.plan_tier === "starter" && (
                        <Button
                          onClick={() => handleUpgrade("pro")}
                          disabled={checkoutLoading}
                          className="bg-white text-slate-900 hover:bg-slate-100"
                        >
                          {checkoutLoading ? "Loading..." : "Upgrade to Pro"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Quota usage */}
                  <div className="bg-card border border-border rounded-lg p-6">
                    <h4 className="font-semibold mb-4">Monthly Quota</h4>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-muted-foreground">
                            Missions Used
                          </span>
                          <span className="font-mono font-semibold">
                            {subscription.missions_used}/{subscription.missions_quota}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                            style={{
                              width: `${Math.min(100, (subscription.missions_used / subscription.missions_quota) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-4">
                        Resets monthly on{" "}
                        <span className="font-mono">
                          {new Date(
                            subscription.current_period_start
                          ).toLocaleDateString()}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Plan features */}
                  <div className="bg-card border border-border rounded-lg p-6">
                    <h4 className="font-semibold mb-4">Plan Features</h4>
                    <ul className="space-y-2">
                      {planFeatures[subscription.plan_tier]?.map((feature, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    No subscription yet. Create your first mission to get started!
                  </p>
                  <Button onClick={() => navigate("/app")}>
                    Create Mission
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === "profile" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-semibold mb-4">Account Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Email</label>
                    <p className="font-mono text-sm mt-1">{session?.user?.email}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      User ID
                    </label>
                    <p className="font-mono text-xs mt-1 break-all">
                      {session?.user?.id}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <p className="text-sm text-yellow-600">
                  Profile customization coming soon. Contact us at{" "}
                  <span className="font-mono">support@getmach.com</span>
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
