"use client";
import { useEffect, useState } from "react";
import { Upload, CheckCircle2 } from "lucide-react";
import { validateSlip } from "@/lib/booking/slip";

export function SlipUploader({ onValid }: { onValid: (file: File) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Release the object URL when it's replaced or the component unmounts.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return (
    <div>
      <label
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed text-center transition ${
          preview
            ? "border-brand bg-brand/5 p-3"
            : "border-black/15 bg-app px-4 py-8 hover:border-brand/50 hover:bg-brand/5"
        }`}
      >
        {preview ? (
          <>
            <div className="relative w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="สลิปการโอนเงิน"
                className="max-h-60 w-full rounded-xl bg-white object-contain ring-1 ring-black/5"
              />
              <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-brand text-white shadow-sm">
                <CheckCircle2 className="size-4" />
              </span>
            </div>
            {fileName && (
              <span className="w-full max-w-full truncate px-2 text-xs text-muted-foreground">{fileName}</span>
            )}
            <span className="text-xs font-medium text-brand">แตะเพื่อเปลี่ยนสลิป</span>
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
            if (!res.ok) { setError(res.error); setFileName(null); setPreview(null); return; }
            setError(null);
            setFileName(f!.name);
            onValid(f!);
            // Preview is best-effort: jsdom (tests) has no createObjectURL.
            if (typeof URL.createObjectURL === "function") setPreview(URL.createObjectURL(f!));
          }}
        />
      </label>
      {error && <p className="mt-1 text-sm text-brand-danger">{error}</p>}
    </div>
  );
}
