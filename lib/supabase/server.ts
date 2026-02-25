import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = "https://bqgzxjieyfcwamyaplzf.supabase.co";
  const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxZ3p4amlleWZjd2FteWFwbHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNzk4OTQsImV4cCI6MjA4NDk1NTg5NH0.Ao1wsM11-IKOsiU-T02tmNKKGlbLuE-UZAipXoCqq2A";

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

