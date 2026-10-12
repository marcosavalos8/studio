"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";

// Several admin-only pages (Employees, Clients, Users, Settings) relied
// only on the sidebar not showing a link to them — any signed-in user who
// reached the URL directly (or via a link elsewhere, like a Dashboard
// card) could still open and use the page. This wraps a page's content and
// blocks it client-side for anyone whose role isn't Admin, matching the
// same "access denied" screen withAuth.tsx already uses for the
// password-gated pages.
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  const router = useRouter();

  if (!isAdmin) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-lg font-semibold">
            You don't have permission to view this section
          </h2>
          <p className="text-sm text-muted-foreground">
            This page is only available to administrators.
          </p>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Back to dashboard
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
