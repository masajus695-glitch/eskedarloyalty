import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, scanToken, redeemFreeCoffee } from "@/lib/loyalty.functions";
import { BeanRow } from "@/components/BeanRow";
import { QRScanner } from "@/components/QRScanner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "My Beans — Eskedar Coffee" },
      { name: "description", content: "Your loyalty card and coffee beans." },
    ],
  }),
  component: AppPage,
});

function AppPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchScan = useServerFn(scanToken);
  const fetchRedeem = useServerFn(redeemFreeCoffee);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(),
    enabled: !!user,
  });

  const scanMut = useMutation({
    mutationFn: (token: string) => fetchScan({ data: { token } }),
    onSuccess: (r) => {
      toast.success(r.message);
      qc.invalidateQueries({ queryKey: ["profile"] });
      setScanning(false);
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Scan failed");
      setScanning(false);
    },
  });

  const redeemMut = useMutation({
    mutationFn: () => fetchRedeem(),
    onSuccess: () => {
      toast.success("Enjoy your free coffee! ☕");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Redeem failed"),
  });

  function handleScanned(decoded: string) {
    // Accept either raw uuid or url like .../?token=<uuid>
    let token = decoded.trim();
    const match = token.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (match) token = match[0];
    scanMut.mutate(token);
  }

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const beans = profileQuery.data?.beans ?? 0;
  const canRedeem = beans >= 5;
  const name = profileQuery.data?.display_name || user.email?.split("@")[0] || "Friend";

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-gradient-warm text-primary-foreground">
        <div className="mx-auto flex max-w-md items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-gold">Eskedar Coffee</p>
            <h1 className="text-xl font-bold">Hi, {name}</h1>
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}
            className="text-xs uppercase tracking-widest text-primary-foreground/70 hover:text-gold"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-md px-6 py-8">
        <div className="rounded-2xl bg-card p-6 shadow-soft">
          <p className="text-center text-xs uppercase tracking-widest text-muted-foreground">
            Your loyalty card
          </p>
          <BeanRow beans={beans} max={5} />
          <p className="text-center text-sm text-muted-foreground">
            {canRedeem
              ? "You've earned a free coffee!"
              : `${5 - beans} more ${5 - beans === 1 ? "bean" : "beans"} until your free coffee`}
          </p>

          {canRedeem ? (
            <Button
              onClick={() => redeemMut.mutate()}
              disabled={redeemMut.isPending}
              size="lg"
              className="mt-6 w-full bg-gradient-gold text-primary font-semibold"
            >
              {redeemMut.isPending ? "Redeeming…" : "Redeem free coffee 🎉"}
            </Button>
          ) : (
            <Button
              onClick={() => setScanning((s) => !s)}
              size="lg"
              className="mt-6 w-full bg-gradient-warm text-primary-foreground"
            >
              {scanning ? "Cancel" : "Scan QR at counter"}
            </Button>
          )}
        </div>

        {scanning && !canRedeem && (
          <div className="mt-6">
            <QRScanner
              onScan={handleScanned}
              onError={(e) => toast.error(`Camera error: ${e}`)}
            />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Point your camera at the QR code on the staff's screen.
            </p>
          </div>
        )}

        <div className="mt-8 rounded-xl bg-secondary p-4 text-center">
          <p className="text-xs uppercase tracking-widest text-secondary-foreground/70">
            Free coffees redeemed
          </p>
          <p className="mt-1 text-3xl font-bold">{profileQuery.data?.total_redeemed ?? 0}</p>
        </div>

        <div className="mt-6 text-center">
          <Link to="/staff" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
            Staff area
          </Link>
        </div>
      </div>
    </main>
  );
}
