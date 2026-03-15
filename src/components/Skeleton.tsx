/**
 * Skeleton loading states — matches card/row shapes for premium loading feel.
 * Pure design component, no functionality.
 */

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-card border border-border/40 rounded-2xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="skeleton w-10 h-10 rounded-xl" />
        <div className="skeleton w-16 h-5 rounded-full" />
      </div>
      <div className="skeleton w-24 h-8 rounded-lg mb-2" />
      <div className="skeleton w-20 h-3 rounded" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-4 border-b border-border/20">
      <div className="skeleton w-8 h-8 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="skeleton w-32 h-3.5 rounded" />
        <div className="skeleton w-48 h-2.5 rounded" />
      </div>
      <div className="skeleton w-16 h-5 rounded-full" />
      <div className="skeleton w-12 h-3.5 rounded" />
    </div>
  );
}

export function SkeletonChart({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-card border border-border/40 rounded-2xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="skeleton w-32 h-5 rounded" />
        <div className="skeleton w-20 h-7 rounded-lg" />
      </div>
      <div className="skeleton w-full h-48 rounded-xl" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-card border border-border/40 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border/30 flex items-center gap-3">
        <div className="skeleton w-48 h-8 rounded-xl" />
        <div className="skeleton w-20 h-8 rounded-lg ml-auto" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
