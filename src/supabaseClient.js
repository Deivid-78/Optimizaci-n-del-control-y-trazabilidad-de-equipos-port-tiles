import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.tevqzvzqvbqmliklzmee.supabase.co/rest/v1/.supabase.co;
const supabaseAnonKey = import.meta.env.sb_publishable_thgs58SMUIqBwRQj2sC5Sw_lqAnct3Z;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "Faltan las variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
      "Revisa tu archivo .env (local) o las Environment Variables en Vercel."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
