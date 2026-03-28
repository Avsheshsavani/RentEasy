// supabase/functions/razorpay-webhook/index.ts
// Receives Razorpay payment.captured webhook

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

serve(async (req) => {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature") ?? "";
    const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!;

    // Verify signature
    const expectedSig = createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (expectedSig !== signature) {
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(body);

    if (event.event !== "payment.captured") {
      return new Response("ignored", { status: 200 });
    }

    const payment = event.payload.payment.entity;
    const razorpay_order_id = payment.order_id;
    const razorpay_payment_id = payment.id;
    const amount_paise = payment.amount;
    const amount_inr = amount_paise / 100;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find pending payment
    const { data: existingPayment } = await adminClient
      .from("payments")
      .select("id, bill_id")
      .eq("razorpay_order_id", razorpay_order_id)
      .single();

    if (existingPayment) {
      await adminClient
        .from("payments")
        .update({
          status: "confirmed",
          razorpay_id: razorpay_payment_id,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", existingPayment.id);
    } else {
      const bill_id = payment.notes?.bill_id;
      const tenant_id = payment.notes?.tenant_id;

      if (!bill_id || !tenant_id) {
        console.error("Missing bill_id/tenant_id in order notes");
        return new Response("missing metadata", { status: 200 });
      }

      await adminClient.from("payments").insert({
        bill_id,
        tenant_id,
        amount: amount_inr,
        method: "razorpay",
        razorpay_id: razorpay_payment_id,
        razorpay_order_id,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        paid_at: new Date().toISOString(),
      });
    }

    // Notify owner
    if (existingPayment) {
      const { data: bill } = await adminClient
        .from("bills")
        .select("tenant_id, leases(rooms(properties(owner_id)))")
        .eq("id", existingPayment.bill_id)
        .single();

      if (bill) {
        const owner_id = (bill as any).leases?.rooms?.properties?.owner_id;
        if (owner_id) {
          await adminClient.from("notifications").insert({
            recipient_id: owner_id,
            recipient_type: "owner",
            type: "payment_received",
            title: "Payment received via Razorpay",
            body: `₹${amount_inr} received — auto-confirmed`,
            ref_id: existingPayment.id,
            ref_type: "payment",
          });
        }
      }
    }

    return new Response("ok", { status: 200 });

  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("error", { status: 500 });
  }
});
