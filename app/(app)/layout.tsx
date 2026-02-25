import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b bg-white px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/projects" className="font-bold text-gray-900 hover:text-gray-700">
              HANGAR3D
            </Link>
            <Link href="/projects" className="text-sm text-gray-600 hover:text-gray-900">
              Projets
            </Link>
            <Link href="/admin/rulesets" className="text-sm text-gray-600 hover:text-gray-900">
              Admin
            </Link>
          </div>
          <LogoutButton />
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
