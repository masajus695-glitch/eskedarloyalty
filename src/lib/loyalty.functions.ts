import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_BEANS = 5;
const GENERIC_ERROR = "Something went wrong. Please try again.";

function dbFail(context: string, error: unknown): never {
  console.error(`[loyalty:${context}]`, error);
  throw new Error(GENERIC_ERROR);
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, beans, total_redeemed")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) dbFail("getMyProfile", error);
    if (!data) {
      await supabaseAdmin.from("profiles").insert({ user_id: userId });
      return { display_name: null, beans: 0, total_redeemed: 0 };
    }
    return data;
  });

export const generateStaffToken = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ pin: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data }) => {
    const expected = process.env.STAFF_PIN;
    if (!expected) {
      console.error("[loyalty:generateStaffToken] STAFF_PIN not configured");
      throw new Error("Invalid PIN");
    }
    if (data.pin !== expected) throw new Error("Invalid PIN");

    const { data: row, error } = await supabaseAdmin
      .from("scan_tokens")
      .insert({})
      .select("token, expires_at")
      .single();
    if (error) dbFail("generateStaffToken", error);
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
    if (tErr) dbFail("scanToken:lookup", tErr);
    if (!tok) throw new Error("Invalid code");
    if (tok.used_at) throw new Error("This code has already been used");
    if (new Date(tok.expires_at) < new Date()) throw new Error("This code has expired");

    const { data: claimed, error: cErr } = await supabaseAdmin
      .from("scan_tokens")
      .update({ used_at: new Date().toISOString(), used_by: userId })
      .eq("token", data.token)
      .is("used_at", null)
      .select("token")
      .maybeSingle();
    if (cErr) dbFail("scanToken:claim", cErr);
    if (!claimed) throw new Error("This code has already been used");

    const { data: prof, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("beans")
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr) dbFail("scanToken:profile", pErr);

    const current = prof?.beans ?? 0;
    if (current >= MAX_BEANS) {
      return { beans: current, message: "You already have a free coffee waiting! Redeem it first." };
    }
    const next = Math.min(current + 1, MAX_BEANS);

    const { error: uErr } = await supabaseAdmin
      .from("profiles")
      .upsert({ user_id: userId, beans: next, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (uErr) dbFail("scanToken:update", uErr);

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
    if (error) dbFail("redeem:lookup", error);
    if (!prof || prof.beans < MAX_BEANS) {
      throw new Error("You don't have a free coffee to redeem yet");
    }
    const { error: uErr } = await supabaseAdmin
      .from("profiles")
      .update({ beans: 0, total_redeemed: (prof.total_redeemed ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (uErr) dbFail("redeem:update", uErr);
    await supabaseAdmin.from("redemptions").insert({ user_id: userId });
    return { beans: 0 };
  });
