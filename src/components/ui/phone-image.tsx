import type { Photo } from "@/lib/listings";
import { cn } from "./cn";

/** Responsive listing photo from the three stored sizes. */
export function PhoneImage({
  photo,
  alt,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
  priority = false,
  className,
  fit = "contain",
}: {
  photo: Photo | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  fit?: "contain" | "cover";
}) {
  if (!photo) {
    return (
      <div className={cn("flex items-center justify-center bg-surface-2 text-faint", className)} role="img" aria-label={alt}>
        <svg viewBox="0 0 40 64" className="h-1/2 w-auto opacity-60" aria-hidden="true">
          <rect x="2" y="2" width="36" height="60" rx="7" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <rect x="15" y="7" width="10" height="2.5" rx="1.25" fill="currentColor" />
        </svg>
      </div>
    );
  }
  return (
    // Plain <img>: sizes are made at upload time, so no runtime optimiser is needed.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.md}
      srcSet={`${photo.sm} 480w, ${photo.md} 960w, ${photo.lg} 1600w`}
      sizes={sizes}
      width={photo.width}
      height={photo.height}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={cn(fit === "contain" ? "object-contain" : "object-cover", className)}
    />
  );
}
