"use client";

import { useState } from "react";

type Props = {
  /** Preferred logo URL (e.g. extracted apple-touch-icon). */
  src: string;
  /** Domain used to build the Google favicons fallback when `src` 404s. */
  fallbackDomain?: string | null;
  /** Decorative — surrounding card already names the brand. */
  alt?: string;
  /** Pixel size for the square logo. Defaults to 32 (library card). */
  size?: number;
};

const DEFAULT_SIZE = 32;

/**
 * Square brand mark with a graceful fallback chain:
 *   1. Try `src` (the high-quality logo extracted from the page).
 *   2. If that errors, fall back to Google's favicons service.
 *   3. If that also errors, hide the element.
 */
export function BrandLogo({ src, fallbackDomain, alt = "", size = DEFAULT_SIZE }: Props) {
  const [stage, setStage] = useState<"primary" | "fallback" | "hidden">("primary");

  if (stage === "hidden") return null;

  const url =
    stage === "primary"
      ? src
      : fallbackDomain
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(fallbackDomain)}&sz=128`
      : null;

  if (!url) return null;

  return (
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="rounded shrink-0 object-contain"
      loading="lazy"
      onError={() => {
        setStage((prev) => (prev === "primary" && fallbackDomain ? "fallback" : "hidden"));
      }}
    />
  );
}
