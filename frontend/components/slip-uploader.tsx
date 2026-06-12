"use client";
import { useState } from "react";
import { Upload, CheckCircle2 } from "lucide-react";
import { validateSlip } from "@/lib/booking/slip";

export function SlipUploader({ onValid }: { onValid: (file: File) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <div>
      <label
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
          fileName
            ? "border-brand bg-brand/5"
            : "border-black/15 bg-app hover:border-brand/50 hover:bg-brand/5"
        }`}
      >
        {fileName ? (
          <>
            <span className="grid size-12 place-items-center rounded-full bg-brand/10">
              <CheckCircle2 className="size-7 text-brand" />
            </span>
            <span className="text-sm font-medium text-brand">{fileName}</span>
            <span className="text-xs text-muted-foreground">แตะเพื่อเปลี่ยนสลิป</span>
          </>
        ) : (
          <>
            <span className="grid size-12 place-items-center rounded-full bg-brand/10">
              <Upload className="size-6 text-brand" />
            </span>
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
