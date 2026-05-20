export default function ContactDetailLoading() {
  return (
    <main className="px-12 py-8 max-w-[1760px] mx-auto animate-pulse">
      {/* Back button */}
      <div className="h-9 w-36 rounded-full bg-border" />

      {/* Header card */}
      <div className="mt-6 rounded-xl border border-border bg-background p-8">
        <div className="flex items-start gap-6">
          <div className="size-20 rounded-full bg-border shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-8 w-64 rounded bg-border" />
            <div className="h-4 w-96 rounded bg-border" />
            <div className="flex gap-2 mt-2">
              <div className="h-6 w-24 rounded-full bg-border" />
              <div className="h-6 w-20 rounded-full bg-border" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 shrink-0">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 w-32 rounded-full bg-border" />
            ))}
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-8 border-t border-border pt-6 grid grid-cols-5 gap-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-2.5 w-24 rounded bg-border" />
              <div className="h-6 w-16 rounded bg-border" />
            </div>
          ))}
        </div>
      </div>

      {/* Two-column */}
      <div className="mt-6 grid grid-cols-[1fr_360px] gap-6">
        <div className="rounded-xl border border-border bg-background h-96" />
        <div className="rounded-xl border border-border bg-background h-96" />
      </div>
    </main>
  );
}
