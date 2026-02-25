import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Only protect /projects routes
     * Login and auth callback routes don't need middleware protection
     */
    "/projects/:path*",
  ],
};
