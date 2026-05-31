import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_BEANS = 5;

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, beans, total_redeemed")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      // Fallback: ensure profile exists
      await supabaseAdmin.from("profiles").insert({ user_id: userId });
      return { display_name: null, beans: 0, total_redeemed: 0 };
    }
    return data;
  });

export const generateStaffToken = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ pin: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data }) => {
    const expected = process.env.STAFF_PIN;
    if (!expected) throw new Error("Staff PIN not configured");
    if (data.pin !== expected) throw new Error("Invalid PIN");

    const { data: row, error } = await supabaseAdmin
      .from("scan_tokens")
      .insert({})
      .select("token, expires_at")
      .single();
    if (error) throw new Error(error.message);
    return { token: row.token as string, expiresAt: row.expires_at as string };
  });

export const scanToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: tok, error: tErr } = await supabaseAdmin
      .from("scan_tokens")
      .select("token, used_at, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!tok) throw new Error("Invalid code");
    if (tok.used_at) throw new Error("This code has already been used");
    if (new Date(tok.expires_at) < new Date()) throw new Error("This code has expired");

    // Mark used atomically (guard against races)
    const { data: claimed, error: cErr } = await supabaseAdmin
      .from("scan_tokens")
      .update({ used_at: new Date().toISOString(), used_by: userId })
      .eq("token", data.token)
      .is("used_at", null)
      .select("token")
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!claimed) throw new Error("This code has already been used");

    // Increment beans (cap at MAX_BEANS)
    const { data: prof, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("beans")
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);

    const current = prof?.beans ?? 0;
    if (current >= MAX_BEANS) {
      // Already at free coffee — refund the token claim
      return { beans: current, message: "You already have a free coffee waiting! Redeem it first." };
    }
    const next = Math.min(current + 1, MAX_BEANS);

    const { error: uErr } = await supabaseAdmin
      .from("profiles")
      .upsert({ user_id: userId, beans: next, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (uErr) throw new Error(uErr.message);

    return {
      beans: next,
      message: next === MAX_BEANS
        ? "You earned a FREE coffee! ☕"
        : `Bean ${next} of ${MAX_BEANS} collected!`,
    };
  });

export const redeemFreeCoffee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: prof, error } = await supabaseAdmin
      .from("profiles")
      .select("beans, total_redeemed")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!prof || prof.beans < MAX_BEANS) {
      throw new Error("You don't have a free coffee to redeem yet");
    }
    const { error: uErr } = await supabaseAdmin
      .from("profiles")
      .update({ beans: 0, total_redeemed: (prof.total_redeemed ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (uErr) throw new Error(uErr.message);
    await supabaseAdmin.from("redemptions").insert({ user_id: userId });
    return { beans: 0 };
  });
