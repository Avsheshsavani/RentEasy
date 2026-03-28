// supabase/functions/create-tenant/index.ts
// Called by owner to create a new tenant

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

    const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !caller) throw new Error("Invalid token");

    // Verify caller is an owner
    const { data: owner, error: ownerErr } = await callerClient
      .from("owners")
      .select("id")
      .eq("id", caller.id)
      .single();
    if (ownerErr || !owner) throw new Error("Not an owner");

    const body = await req.json();
    const { name, phone, email, emergency_contact, password } = body;

    if (!name || !phone) throw new Error("name and phone are required");

    // Format phone with country code
    const formattedPhone = phone.startsWith("+91") ? phone : `+91${phone}`;

    const emailTrim = typeof email === "string" ? email.trim() : "";
    const passwordStr = typeof password === "string" ? password : "";
    const wantsEmailLogin = emailTrim.length > 0 || passwordStr.length > 0;

    if (wantsEmailLogin) {
      if (!emailTrim) throw new Error("email is required when setting a login password");
      if (passwordStr.length < 6) {
        throw new Error("password must be at least 6 characters for email login");
      }
    }

    // Email + password → tenant uses Login → Email. Phone-only → Login → Phone OTP (needs SMS configured in Supabase).
    const { data: newUser, error: createErr } = wantsEmailLogin
      ? await adminClient.auth.admin.createUser({
        email: emailTrim,
        password: passwordStr,
        email_confirm: true,
        phone: formattedPhone,
        phone_confirm: true,
        user_metadata: { name, role: "tenant" },
      })
      : await adminClient.auth.admin.createUser({
        phone: formattedPhone,
        phone_confirm: true,
        user_metadata: { name, role: "tenant" },
      });
    if (createErr) throw createErr;

    // Insert tenant profile
    const { error: insertErr } = await adminClient
      .from("tenants")
      .insert({
        id: newUser.user.id,
        owner_id: caller.id,
        name,
        phone: formattedPhone,
        email: emailTrim || null,
        emergency_contact: emergency_contact || null,
        is_active: true,
      });

    if (insertErr) {
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      throw insertErr;
    }

    return new Response(
      JSON.stringify({ success: true, tenant_id: newUser.user.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
