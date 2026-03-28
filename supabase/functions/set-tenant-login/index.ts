// Owner sets or updates email + password for an existing tenant (auth user id = tenants.id)

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
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !caller) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: owner, error: ownerErr } = await callerClient
      .from("owners")
      .select("id")
      .eq("id", caller.id)
      .single();
    if (ownerErr || !owner) {
      return new Response(
        JSON.stringify({ error: "Not an owner" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const tenantId = body.tenant_id as string | undefined;
    const emailRaw = body.email as string | undefined;
    const password = body.password as string | undefined;

    const emailTrim = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "tenant_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!emailTrim) {
      return new Response(
        JSON.stringify({ error: "email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: "password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: tenant, error: tenantErr } = await adminClient
      .from("tenants")
      .select("id, owner_id")
      .eq("id", tenantId)
      .single();

    if (tenantErr || !tenant) {
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (tenant.owner_id !== caller.id) {
      return new Response(
        JSON.stringify({ error: "Not allowed for this tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Email first (adds identity for phone-only users), then password — clearer errors if email is taken.
    const { error: emailErr } = await adminClient.auth.admin.updateUserById(tenantId, {
      email: emailTrim,
      email_confirm: true,
    });

    if (emailErr) {
      const msg = emailErr.message || String(emailErr);
      return new Response(
        JSON.stringify({
          error: msg.includes("already been registered") || msg.includes("already registered")
            ? "This email is already used by another account. Use a different email."
            : msg,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: pwdErr } = await adminClient.auth.admin.updateUserById(tenantId, {
      password,
    });
    if (pwdErr) {
      const msg = pwdErr.message || String(pwdErr);
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: profileErr } = await adminClient
      .from("tenants")
      .update({ email: emailTrim })
      .eq("id", tenantId)
      .eq("owner_id", caller.id);

    if (profileErr) {
      return new Response(
        JSON.stringify({ error: "Auth updated but profile email failed: " + profileErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
