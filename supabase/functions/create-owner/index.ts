// supabase/functions/create-owner/index.ts
// Called by super admin to create a new owner account

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", !!authHeader);
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    console.log("Env vars present:", { 
      url: !!supabaseUrl, 
      serviceRole: !!serviceRoleKey, 
      anon: !!anonKey 
    });

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client with service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Client to verify caller's JWT
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the caller
    const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
    console.log("Caller:", caller?.email, "Auth error:", authErr?.message);
    
    if (authErr || !caller) {
      return new Response(
        JSON.stringify({ error: "Invalid token: " + (authErr?.message || "No user") }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is a super admin
    const { data: superAdmin, error: saErr } = await adminClient
      .from("super_admins")
      .select("id")
      .eq("id", caller.id)
      .single();
    
    console.log("Super admin check:", { found: !!superAdmin, error: saErr?.message });
    
    if (saErr || !superAdmin) {
      return new Response(
        JSON.stringify({ error: "Not authorized - user is not a super admin" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { name, phone, email, upi_id, password } = body;
    console.log("Request body:", { name, phone, email, hasPassword: !!password });

    if (!name || !phone || !email || !password) {
      return new Response(
        JSON.stringify({ error: "name, phone, email, and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create auth user
    console.log("Creating auth user for:", email);
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { name, role: "owner" },
    });
    
    if (createErr) {
      console.log("Create user error:", createErr.message);
      return new Response(
        JSON.stringify({ error: "Failed to create user: " + createErr.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User created:", newUser.user.id);

    // Insert owner profile
    const { error: insertErr } = await adminClient
      .from("owners")
      .insert({
        id: newUser.user.id,
        name,
        phone,
        email,
        upi_id: upi_id || null,
        is_active: true,
        created_by: caller.id,
      });

    if (insertErr) {
      console.log("Insert owner error:", insertErr.message);
      // Rollback: delete the auth user
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: "Failed to create owner profile: " + insertErr.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Owner created successfully:", newUser.user.id);

    return new Response(
      JSON.stringify({ success: true, owner_id: newUser.user.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
