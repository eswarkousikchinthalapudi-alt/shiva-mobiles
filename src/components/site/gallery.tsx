"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { useT } from "@/i18n/client";
import type { Photo } from "@/lib/listings";
import { cn } from "@/components/ui/cn";
import { PhoneImage } from "@/components/ui/phone-image";

export function Gallery({ photos, alt }: { photos: Photo[]; alt: string }) {
  const t = useT();
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  if (photos.length === 0) {
    return <PhoneImage photo={null} alt={alt} className="aspect-[4/5] w-full rounded-[24px]" />;
  }

  const go = (next: number) => {
    const el = track.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(photos.length - 1, next));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-[24px] bg-surface-2">
        <div
          ref={track}
          className="scroll-row flex aspect-[4/5] overflow-x-auto"
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
          }}
          aria-roledescription="carousel"
          aria-label={alt}
        >
          {photos.map((photo, i) => (
            <div key={photo.lg} className="h-full w-full shrink-0" aria-roledescription="slide" aria-label={t.phone.photoOf(i + 1, photos.length)}>
              <a href={photo.lg} target="_blank" rel="noopener" className="block h-full w-full" aria-label={t.phone.photoOf(i + 1, photos.length)}>
                <PhoneImage
                  photo={photo}
                  alt={`${alt} — ${t.phone.photoOf(i + 1, photos.length)}`}
                  priority={i === 0}
                  fit="cover"
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="h-full w-full"
                />
              </a>
            </div>
          ))}
        </div>
        {photos.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-surface/90 shadow disabled:opacity-0 sm:grid"
              aria-label={t.action.back}
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index === photos.length - 1}
              className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-surface/90 shadow disabled:opacity-0 sm:grid"
              aria-label={t.action.next}
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
            <div className="absolute right-3 top-3 rounded-full bg-fg/75 px-2.5 py-1 text-xs font-medium text-bg tabular">
              {index + 1}/{photos.length}
            </div>
          </>
        ) : null}
      </div>
      {photos.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {photos.map((photo, i) => (
            <button
              key={photo.sm}
              type="button"
              onClick={() => go(i)}
              aria-label={t.phone.photoOf(i + 1, photos.length)}
              aria-current={i === index ? "true" : undefined}
              className={cn(
                "h-16 w-14 shrink-0 overflow-hidden rounded-xl border-2 bg-surface-2",
                i === index ? "border-brand" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.sm} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
