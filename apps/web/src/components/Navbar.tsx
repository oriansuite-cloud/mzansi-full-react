import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Cloud, LockKeyhole } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { signOut, useSession } from "@/lib/auth-client";
import { queryKeys } from "@/lib/query-keys";

export function Navbar() {
  const queryClient = useQueryClient();
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const signedIn = Boolean(session?.user);

  function handleSignOut() {
    void signOut({
      fetchOptions: {
        onSuccess: () => {
          queryClient.removeQueries({ queryKey: queryKeys.auth.session() });
          void navigate({ to: "/" });
        },
      },
    });
  }

  return (
    <header className="border-b border-slate-700 bg-[#071525] px-4 py-3 text-white md:px-8">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <Link to={signedIn ? "/dashboard" : "/"} className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
            <Cloud className="size-6" />
          </span>
          <span className="flex flex-col">
            <span className="text-lg font-bold leading-tight tracking-tight">
              Mzansi<span className="text-cyan-400">Cloud</span>
            </span>
            <span className="hidden text-[10px] uppercase tracking-widest text-slate-400 sm:block">
              Private Hosting in a Box
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          {!isPending && (
            signedIn ? (
              <>
                <Link to="/dashboard" className="text-sm text-slate-300 hover:text-white">Workspace</Link>
                <span className="hidden text-xs text-slate-400 md:inline">{session?.user.name}</span>
                <Button size="sm" variant="outline" onClick={handleSignOut}>Sign out</Button>
              </>
            ) : (
              <>
                <span className="hidden items-center gap-1 text-xs text-slate-400 md:flex">
                  <LockKeyhole className="size-3.5" /> Private operator access
                </span>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
              </>
            )
          )}
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
