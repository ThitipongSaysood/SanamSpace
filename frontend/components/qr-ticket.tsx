export function QRTicket({ code }: { code: string }) {
  return (
    <div className="mx-auto w-fit overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="flex flex-col items-center gap-3 p-6">
        <div
          role="img"
          aria-label={`QR สำหรับเช็คอิน รหัส ${code}`}
          className="grid size-44 grid-cols-8 grid-rows-8 gap-px rounded-xl bg-white p-2 ring-1 ring-black/5"
        >
          {Array.from({ length: 64 }).map((_, i) => (
            <div key={i} className={((i * 7 + (i % 5)) % 3 === 0) ? "bg-black" : "bg-white"} />
          ))}
        </div>
        <div className="font-mono text-base font-semibold tracking-wider">{code}</div>
      </div>
      <div className="relative border-t border-dashed border-black/15">
        <span className="absolute -left-2 -top-2 size-4 rounded-full bg-app" />
        <span className="absolute -right-2 -top-2 size-4 rounded-full bg-app" />
      </div>
      <p className="px-6 py-3 text-center text-xs text-muted-foreground">
        แสดง QR นี้ที่เคาน์เตอร์เพื่อเช็คอิน
      </p>
    </div>
  );
}
