import { createClient } from "@supabase/supabase-js";

// Replaced with your provided placeholder URL and Key
const SUPABASE_URL = "https://aqrgxqvpkyzxyjofqxbm.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_AuaS-wxjseR0qW6TDuK-3w_eqcc0gsL";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
