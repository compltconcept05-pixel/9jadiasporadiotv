import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('REPLACE')) {
    console.warn('⚠️ Supabase credentials missing. Real-time sync disabled.');
}

export const supabase = (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('REPLACE'))
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
