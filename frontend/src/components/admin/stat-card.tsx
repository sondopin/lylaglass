export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 font-heading text-2xl font-medium">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
