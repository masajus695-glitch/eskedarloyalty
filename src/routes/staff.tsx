import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { generateStaffToken } from "@/lib/loyalty.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [
      { title: "Staff — Eskedar Coffee" },
      { name: "description", content: "Generate a one-time QR code for a customer's bean." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StaffPage,
});

function StaffPage() {
  const generate = useServerFn(generateStaffToken);
  const [pin, setPin] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const mut = useMutation({
    mutationFn: () => generate({ data: { pin } }),
    onSuccess: (r) => { setToken(r.token); setExpiresAt(r.expiresAt); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remaining = expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000)) : 0;
  const expired = expiresAt !== null && remaining === 0;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
        <Link to="/" className="mb-6 text-sm text-muted-foreground hover:text-foreground">← Back</Link>
        <div className="rounded-2xl bg-card p-6 shadow-soft">
          <p className="text-xs uppercase tracking-widest text-accent-foreground/70">Eskedar Coffee</p>
          <h1 className="text-2xl font-bold">Staff: generate bean QR</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the staff PIN, then show the QR code to the customer to scan.
          </p>

          <div className="mt-6 space-y-3">
            <Label htmlFor="pin">Staff PIN</Label>
            <Input
              id="pin"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              autoComplete="off"
            />
            <Button
              onClick={() => mut.mutate()}
              disabled={mut.isPending || !pin}
              size="lg"
              className="w-full bg-gradient-warm text-primary-foreground"
            >
              {mut.isPending ? "Generating…" : token ? "Generate new code" : "Generate bean QR"}
            </Button>
          </div>

          {token && (
            <div className="mt-8 flex flex-col items-center">
              <div className={`rounded-xl bg-white p-4 ${expired ? "opacity-40" : ""}`}>
                <QRCodeSVG value={token} size={220} level="M" />
              </div>
              <p className="mt-4 text-center text-sm">
                {expired ? (
                  <span className="font-semibold text-destructive">Expired — generate a new one</span>
                ) : (
                  <>
                    Expires in <span className="font-mono font-bold">{remaining}s</span>
                  </>
                )}
              </p>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                One use only. Ask the customer to scan it now.
              </p>
            </div>
          )}
        </div>
        <div className="mt-6 text-center">
          <Link to="/auth" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
            Customer sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
