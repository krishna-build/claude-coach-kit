import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://YOUR_SUPABASE_REF.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_SUPABASE_KEY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
