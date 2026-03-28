// supabase/functions/toggle-tenant/index.ts
// Called by owner to enable/disable a tenant

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

    const { data: owner } = await callerClient
      .from("owners")
      .select("id")
      .eq("id", caller.id)
      .single();
    if (!owner) throw new Error("Not an owner");

    const { tenant_id, is_active } = await req.json();
    if (!tenant_id || typeof is_active !== "boolean") {
      throw new Error("tenant_id and is_active (boolean) required");
    }

    // Verify tenant belongs to this owner
    const { data: tenant } = await adminClient
      .from("tenants")
      .select("id")
      .eq("id", tenant_id)
      .eq("owner_id", caller.id)
      .single();
    if (!tenant) throw new Error("Tenant not found");

    // Ban/unban auth user
    const { error: authErr } = await adminClient.auth.admin.updateUserById(tenant_id, {
      ban_duration: is_active ? "none" : "876600h",
    });
    if (authErr) throw authErr;

    // Update tenant profile
    const { error: updateErr } = await adminClient
      .from("tenants")
      .update({ is_active })
      .eq("id", tenant_id);
    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({ success: true, tenant_id, is_active }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
