// supabase/functions/toggle-owner/index.ts
// Called by super admin to enable/disable an owner

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Invalid token");

    const { data: superAdmin } = await callerClient
      .from("super_admins")
      .select("id")
      .eq("id", caller.id)
      .single();
    if (!superAdmin) throw new Error("Not authorized");

    const { owner_id, is_active } = await req.json();
    if (!owner_id || typeof is_active !== "boolean") {
      throw new Error("owner_id and is_active (boolean) required");
    }

    // Update auth user ban status
    const { error: authErr } = await adminClient.auth.admin.updateUserById(owner_id, {
      ban_duration: is_active ? "none" : "876600h",
    });
    if (authErr) throw authErr;

    // Update owner profile
    const { error: updateErr } = await adminClient
      .from("owners")
      .update({ is_active })
      .eq("id", owner_id);
    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({ success: true, owner_id, is_active }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
