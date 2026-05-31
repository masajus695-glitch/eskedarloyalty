interface Props { beans: number; max?: number; }

export function BeanRow({ beans, max = 5 }: Props) {
  return (
    <div className="flex justify-center gap-3 py-4">
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < beans;
        const isFree = i === max - 1;
        return (
          <div
            key={i}
            className={`flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all duration-500 ${
              filled
                ? isFree
                  ? "bg-gradient-gold border-gold scale-110 shadow-soft"
                  : "bg-gradient-warm border-primary text-primary-foreground"
                : "border-dashed border-muted-foreground/40 bg-background"
            }`}
            aria-label={filled ? "filled bean" : "empty slot"}
          >
            <span className="text-2xl">
              {filled ? (isFree ? "☕" : "🫘") : isFree ? "☕" : "·"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
