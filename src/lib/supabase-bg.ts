import { createClient } from "@supabase/supabase-js";

// Background Supabase client — used in background jobs that run outside request context.
// Does not require cookies. RLS must be disabled (or service role key used) for write access.
export const supabaseBg = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
