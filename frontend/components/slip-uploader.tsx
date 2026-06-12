"use client";
import { useState } from "react";
import { validateSlip } from "@/lib/booking/slip";

export function SlipUploader({ onValid }: { onValid: (file: File) => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <input type="file" accept="image/jpeg,image/png" onChange={(e) => {
        const f = e.target.files?.[0] ?? null;
        const res = validateSlip(f);
        if (!res.ok) { setError(res.error); return; }
        setError(null); onValid(f!);
      }} />
      {error && <p className="mt-1 text-sm text-brand-danger">{error}</p>}
    </div>
  );
}
