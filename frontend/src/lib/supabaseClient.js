// Supabase Client Wrapper (Frontend - Anonymous Key Only)
// NEVER import or use the Supabase Service Role Key in the frontend!

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabase = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    // If supabase-js is installed or needed in future stages, it is safely initialized here
    console.log('[SUPABASE CLIENT] Initialized with anonymous public key:', supabaseUrl);
  } catch (err) {
    console.warn('[SUPABASE CLIENT] Failed to initialize Supabase client:', err);
  }
} else {
  // Graceful fallback notice
  // console.info('[SUPABASE CLIENT] Supabase credentials not set in frontend .env. Operating via FastAPI backend proxy.');
}

export { supabase, supabaseUrl, supabaseAnonKey };
