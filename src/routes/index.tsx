import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Eskedar Coffee — Loyalty Rewards" },
      { name: "description", content: "Collect beans every visit. Your 5th coffee at Eskedar is on us." },
      { property: "og:title", content: "Eskedar Coffee — Loyalty Rewards" },
      { property: "og:description", content: "Collect beans every visit. Your 5th coffee at Eskedar is on us." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app" });
  }, [loading, user, navigate]);

  return (
    <main className="min-h-screen bg-gradient-warm text-primary-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-gold text-5xl shadow-soft">
          ☕
        </div>
        <h1 className="text-5xl font-bold tracking-tight">Eskedar Coffee</h1>
        <p className="mt-3 text-lg italic text-primary-foreground/80">
          Every cup, a reward.
        </p>

        <div className="mt-12 w-full rounded-2xl bg-card/10 p-6 backdrop-blur-sm ring-1 ring-cream/20">
          <p className="text-sm uppercase tracking-widest text-gold">How it works</p>
          <ol className="mt-4 space-y-3 text-left text-sm text-primary-foreground/90">
            <li><span className="font-semibold text-gold">1.</span> Order your coffee at the shop.</li>
            <li><span className="font-semibold text-gold">2.</span> Scan the QR code your barista shows you.</li>
            <li><span className="font-semibold text-gold">3.</span> Collect 4 beans — your 5th coffee is free.</li>
          </ol>
        </div>

        <div className="mt-10 flex w-full flex-col gap-3">
          <Button asChild size="lg" className="bg-gold text-primary hover:bg-gold/90 font-semibold">
            <Link to="/auth">Sign in or create account</Link>
          </Button>
          <Link to="/staff" className="text-xs uppercase tracking-widest text-primary-foreground/60 hover:text-gold">
            Staff
          </Link>
        </div>
      </div>
    </main>
  );
}
