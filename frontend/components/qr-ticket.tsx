export function QRTicket({ code }: { code: string }) {
  return (
    <div className="mx-auto w-fit rounded-xl border p-4 text-center">
      <div className="grid h-40 w-40 grid-cols-8 grid-rows-8 gap-px bg-white">
        {Array.from({ length: 64 }).map((_, i) => (
          <div key={i} className={((i * 7 + (i % 5)) % 3 === 0) ? "bg-black" : "bg-white"} />
        ))}
      </div>
      <div className="mt-2 font-mono text-sm">{code}</div>
      <div className="text-xs text-muted-foreground">แสดง QR นี้ที่เคาน์เตอร์เพื่อเช็คอิน</div>
    </div>
  );
}
