export default function ContactsLoading() {
  return (
    <main className="px-12 py-10 max-w-[1760px] mx-auto animate-pulse">
      {/* Header */}
      <div className="h-3 w-28 rounded bg-border" />
      <div className="mt-3 flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-8 w-40 rounded bg-border" />
          <div className="h-3 w-24 rounded bg-border" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-28 rounded-full bg-border" />
          <div className="h-10 w-32 rounded-full bg-border" />
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-8 flex gap-2">
        {[120, 100, 140].map((w, i) => (
          <div key={i} className="h-9 rounded-full bg-border" style={{ width: w }} />
        ))}
      </div>

      {/* Filters */}
      <div className="mt-5 flex gap-2">
        {[80, 70, 90, 80, 80].map((w, i) => (
          <div key={i} className="h-10 rounded-full bg-border" style={{ width: w }} />
        ))}
      </div>

      {/* Table */}
      <div className="mt-6 rounded-xl border border-border overflow-hidden">
        <div className="h-11 bg-background-subtle border-b border-border" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-border last:border-b-0">
            <div className="size-4 rounded bg-border" />
            <div className="size-9 rounded-full bg-border shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-40 rounded bg-border" />
              <div className="h-2.5 w-52 rounded bg-border" />
            </div>
            {[60, 80, 90, 70, 80, 60, 60].map((w, j) => (
              <div key={j} className="h-3 rounded bg-border shrink-0" style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
