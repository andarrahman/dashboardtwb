import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/app-shell/sidebar";
import { ErrorBoundary } from "@/components/app-shell/error-boundary";
import { ToastProvider } from "@/components/ui/toast";

/**
 * Authenticated app shell. Verifies session server-side — redirects to /login
 * if unauthenticated. Sidebar on the left, content area scrolls independently.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 min-w-0 overflow-x-hidden">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </div>
    </ToastProvider>
  );
}
