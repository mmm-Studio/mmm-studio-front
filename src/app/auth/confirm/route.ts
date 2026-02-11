import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Handles Supabase email confirmation links.
 * These links contain token_hash + type params (not code like OAuth).
 * Format: /auth/confirm?token_hash=xxx&type=email
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as
    | "email"
    | "recovery"
    | "invite"
    | "magiclink"
    | "signup"
    | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error("[auth/confirm] OTP verification failed:", error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
}
