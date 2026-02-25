import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Next.js remplace ces valeurs au build time
  const supabaseUrl = "https://bqgzxjieyfcwamyaplzf.supabase.co";
  const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxZ3p4amlleWZjd2FteWFwbHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNzk4OTQsImV4cCI6MjA4NDk1NTg5NH0.Ao1wsM11-IKOsiU-T02tmNKKGlbLuE-UZAipXoCqq2A";

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

