import { Router } from "express";
import crypto from "node:crypto";
import { processMission } from "../worker.js";

const router = Router();

const WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET;

function verifyWebhookSignature(signature: string | undefined, body: unknown): boolean {
  // Skip verification in development or if no secret configured
  if (process.env.NODE_ENV === "development" || !WEBHOOK_SECRET) {
    return true;
  }

  if (!signature) {
    return false;
  }

  try {
    const payload = JSON.stringify(body);
    const expectedSignature = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(payload)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: {
    id: string;
    objective: string;
    status: string;
    flight_plan?: string;
    agent_prompt?: string;
    created_at: string;
    updated_at: string;
  };
  old_record?: unknown;
};

router.post("/webhook", async (req, res) => {
  const { type, record } = req.body as WebhookPayload;

  // Verify webhook signature (security)
  const signature = req.headers["x-supabase-signature"] as string | undefined;
  if (!verifyWebhookSignature(signature, req.body)) {
    console.warn("[Mach Webhook] ⚠️ Invalid signature rejected");
    return res.status(401).json({ error: "Invalid signature" });
  }

  console.log(`[Mach Webhook] Received ${type} event`);

  // Handle INSERT event for pending missions
  if (type === "INSERT" && record?.status === "pending") {
    console.log(`[Mach Webhook] 🚀 New mission: ${record.id}`);

    // Process asynchronously (don't block webhook response)
    processMission(record.id, record.objective).catch((err) =>
      console.error(`[Mach Webhook] Mission ${record.id} failed:`, err)
    );

    return res.status(200).json({ received: true, mission_id: record.id });
  }

  // Acknowledge other events without processing
  return res.status(200).json({ received: true, ignored: true });
});

// Manual trigger endpoint for testing
router.post("/webhook/test", async (req, res) => {
  const { mission_id, objective } = req.body as { mission_id?: string; objective?: string };

  if (!mission_id || !objective) {
    return res.status(400).json({ error: "mission_id and objective required" });
  }

  console.log(`[Mach Webhook] 🧪 Test trigger for mission: ${mission_id}`);

  processMission(mission_id, objective).catch((err) =>
    console.error(`[Mach Webhook] Test mission ${mission_id} failed:`, err)
  );

  return res.status(200).json({ triggered: true, mission_id });
});

export { router as webhookRouter };
