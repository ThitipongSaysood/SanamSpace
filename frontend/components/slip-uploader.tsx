"use client";
import { useState } from "react";
import { Upload, CheckCircle2 } from "lucide-react";
import { validateSlip } from "@/lib/booking/slip";

export function SlipUploader({ onValid }: { onValid: (file: File) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <div>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-brand/30 bg-brand/5 px-4 py-8 text-center transition hover:border-brand/50">
        {fileName ? (
          <>
            <CheckCircle2 className="size-8 text-brand" />
            <span className="text-sm font-medium text-brand">{fileName}</span>
            <span className="text-xs text-muted-foreground">แตะเพื่อเปลี่ยนสลิป</span>
          </>
        ) : (
          <>
            <Upload className="size-8 text-brand/70" />
            <span className="text-sm font-medium">แตะเพื่อแนบสลิป</span>
            <span className="text-xs text-muted-foreground">รองรับไฟล์ JPG หรือ PNG</span>
          </>
        )}
        <input
          type="file"
          className="sr-only"
          aria-label="แนบสลิปการโอนเงิน"
          accept="image/jpeg,image/png"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            const res = validateSlip(f);
            if (!res.ok) { setError(res.error); setFileName(null); return; }
            setError(null); setFileName(f!.name); onValid(f!);
          }}
        />
      </label>
      {error && <p className="mt-1 text-sm text-brand-danger">{error}</p>}
    </div>
  );
}
