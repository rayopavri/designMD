"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BORDER,
  BORDER_SOFT,
  INK,
  INK_ON_LIGHT,
  LIME,
  MONO,
  MUTED,
  SUB,
} from "@/lib/ui-data/tokens";

const ROTATING_BRANDS = [
  "Linear", "Stripe", "Vercel", "Airbnb",
  "Spotify", "Ferrari", "Kraken",
];

function RotatingBrand() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setIndex(i => (i + 1) % ROTATING_BRANDS.length),
      1300,
    );
    return () => clearInterval(t);
  }, []);

  return (
    <span
      className="relative inline-grid overflow-hidden"
      style={{ verticalAlign: "text-bottom" }}
    >
      {/* All brands stacked invisibly so the grid cell locks to the widest word */}
      {ROTATING_BRANDS.map(brand => (
        <span
          key={brand}
          className="col-start-1 row-start-1 invisible select-none pointer-events-none"
          aria-hidden
        >
          {brand}
        </span>
      ))}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={ROTATING_BRANDS[index]}
          className="col-start-1 row-start-1 text-center"
          initial={{ y: "110%" }}
          animate={{ y: 0 }}
          exit={{ y: "-110%" }}
          transition={{ duration: 0.4, ease: "easeIn" }}
          style={{ color: LIME }}
        >
          {ROTATING_BRANDS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}


export function HomeHero() {
  return (
    <>
      {/* ── Above-the-fold hero ── */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8 pt-20 pb-12 text-center">

          {/* Eyebrow */}
          <div
            className="inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] mb-9"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: LIME, boxShadow: `0 0 8px ${LIME}88` }}
              aria-hidden
            />
            For designers who actually ship
          </div>

          {/* Headline — each phrase is its own line; lg:whitespace-nowrap locks
              each to a single line on desktop, smaller viewports wrap freely */}
          <h1
            className="text-[46px] sm:text-[62px] lg:text-[76px] leading-[1.02] font-medium tracking-[-0.025em] mb-7"
            style={{ color: INK }}
          >
            <span className="block lg:whitespace-nowrap">What does <RotatingBrand /> tell AI</span>
            <span className="block lg:whitespace-nowrap" style={{ color: SUB }}>about how to design?</span>
          </h1>

          {/* Subheadline */}
          <p
            className="mx-auto max-w-[520px] lg:max-w-none lg:whitespace-nowrap text-[17px] leading-[1.65] mb-10"
            style={{ color: SUB }}
          >
            The world's best design systems, formatted for AI. Pick a brand and paste it in.
          </p>

          {/* CTAs — primary fills, secondary ghost */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/library"
              className="h-12 rounded-full px-7 text-[13.5px] font-medium inline-flex items-center gap-2 transition-opacity hover:opacity-90"
              style={{ background: "#fff", color: INK_ON_LIGHT }}
            >
              Browse design skills
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/generate"
              className="h-12 rounded-full border px-7 text-[13.5px] font-medium inline-flex items-center gap-2 transition-opacity hover:opacity-70"
              style={{ borderColor: BORDER, color: SUB }}
            >
              Generate from your URL
            </Link>
          </div>

        </div>
      </section>

    </>
  );
}
