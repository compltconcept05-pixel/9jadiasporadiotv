import { createClient } from '@supabase/supabase-js';

let supabaseUrl: string | undefined;
let supabaseAnonKey: string | undefined;

if (typeof process !== 'undefined' && process.env) {
    supabaseUrl = process.env.VITE_SUPABASE_URL;
    supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
}

if (!supabaseUrl || !supabaseAnonKey) {
    try {
        // @ts-ignore - Vite specific
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            supabaseUrl = supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
            supabaseAnonKey = supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY;
        }
    } catch (e) {
        // Silent catch for environments where import.meta is problematic
    }
}

// Validation: Ensure URL is present, not a placeholder, and starts with https://
const hasUrl = !!supabaseUrl;
const isPlaceholder = supabaseUrl?.includes('REPLACE');
const isHttps = supabaseUrl?.startsWith('https://');

// Diagnostics for the user
console.log('🔍 Supabase URL Check:', {
    exists: hasUrl,
    startsHttps: isHttps,
    prefix: supabaseUrl ? supabaseUrl.substring(0, 8) + '...' : 'none'
});

console.log('🔍 Supabase Key Check:', {
    exists: !!supabaseAnonKey,
    length: supabaseAnonKey ? supabaseAnonKey.length : 0,
    prefix: supabaseAnonKey ? supabaseAnonKey.substring(0, 10) + '...' : 'none'
});

if (!hasUrl) console.error('❌ Supabase Error: VITE_SUPABASE_URL is missing in Vercel settings.');
else if (isPlaceholder) console.error('❌ Supabase Error: VITE_SUPABASE_URL is still set to placeholder.');
else if (!isHttps) console.error('❌ Supabase Error: VITE_SUPABASE_URL must start with https://');

if (!supabaseAnonKey) console.error('❌ Supabase Error: VITE_SUPABASE_ANON_KEY is missing in Vercel settings.');

const isValidUrl = hasUrl && !isPlaceholder && isHttps;

export const supabase = (isValidUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

if (supabase) {
    console.log('✅ Supabase Client Initialized Successfully.');
}
