import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface Props {
  onScan: (decoded: string) => void;
  onError?: (err: string) => void;
}

export function QRScanner({ onScan, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const id = "qr-scanner-region";
    containerRef.current.id = id;

    const scanner = new Html5Qrcode(id, { verbose: false });
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          if (handledRef.current) return;
          handledRef.current = true;
          onScan(decodedText);
          scanner.stop().catch(() => {});
        },
        () => {},
      )
      .catch((e) => onError?.(String(e)));

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, [onScan, onError]);

  return (
    <div className="overflow-hidden rounded-xl border-2 border-accent bg-black">
      <div ref={containerRef} className="aspect-square w-full" />
    </div>
  );
}
