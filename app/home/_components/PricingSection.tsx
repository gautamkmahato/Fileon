"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { APP_NAME } from "@/lib/brand";
import {
  HomeThemeStyles,
  homeBadge,
  homeCta,
  homeSectionSubtitle,
  homeSectionTitle,
  homeSkyGradient,
} from "./home-theme";

const FEATURES = [
  "Connect your Google Drive in one click",
  "Smart Cleanup — find duplicates & reclaim space",
  "Custom tags & rule-based Smart Spaces",
  "Instant search with fuzzy matching & ⌘K",
  "Rich inline previews for PDFs, images & docs",
  "Tracked share links with access control",
  `${APP_NAME} Inbox for reviewing new files`,
  "Keyboard shortcuts & bulk actions",
];

export default function PricingSection() {
  return (
    <section
      id="pricing"
      className="relative overflow-hidden bg-white px-6 py-20 sm:px-10 sm:py-24 lg:px-[72px] lg:py-28"
    >
      <HomeThemeStyles />

      <div className="font-display mx-auto w-full max-w-[960px]">
        <h2
          className={`${homeSectionTitle} mx-auto max-w-[820px] text-center text-[32px] sm:text-[40px] lg:text-[48px]`}
        >
          Simple And Flexible Pricing
          <br className="hidden sm:block" />
          Designed For Every Team
        </h2>

        <div className="mt-14 sm:mt-16">
          <article
            className="relative overflow-hidden rounded-[32px] shadow-[0_28px_70px_-32px_rgba(0,0,0,0.22)] ring-1 ring-black/[0.06]"
          >
            {/* Sky background */}
            <div className={`absolute inset-0 ${homeSkyGradient}`} aria-hidden="true" />
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/40 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/30 blur-2xl"
              aria-hidden="true"
            />

            <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
              {/* Left — plan details */}
              <div className="flex flex-col justify-between p-8 sm:p-10 lg:p-12">
                <div>
                  <span className={homeBadge}>Free</span>

                  <p
                    className="font-serif-display mt-8 text-[52px] font-semibold leading-none tracking-[-0.03em] text-[#1A1A1A] sm:text-[64px]"
                  >
                    Free
                    <span className="block text-[28px] font-medium text-[#4A4A4A] sm:text-[32px]">
                      for now
                    </span>
                  </p>

                  <p className={`${homeSectionSubtitle} mt-5 max-w-[280px]`}>
                    Full access to every feature while we&apos;re in early
                    access. No credit card, no limits — just a better way to use
                    Google Drive.
                  </p>
                </div>

                <Link href="/" className={`${homeCta} mt-10 w-full sm:mt-12`}>
                  Get Started
                </Link>
              </div>

              {/* Right — features */}
              <div className="border-t border-white/40 bg-white/25 px-8 py-8 backdrop-blur-sm sm:px-10 sm:py-10 lg:border-l lg:border-t-0 lg:px-12 lg:py-12">
                <p className="font-serif-display mb-6 text-[15px] font-semibold text-[#1A1A1A] sm:text-[16px]">
                  Everything included
                </p>
                <ul className="space-y-4">
                  {FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <span
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1A1A1A]"
                      >
                        <ChevronRight
                          className="h-3.5 w-3.5 text-white"
                          strokeWidth={2.5}
                        />
                      </span>
                      <span className="font-serif-display text-[14px] leading-[1.5] text-[#2A2A2A] sm:text-[15px]">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>

          <p className="mt-6 text-center text-[12px] text-[#9A9A9A]">
            Pricing may change later. Early users keep free access.
          </p>
        </div>
      </div>
    </section>
  );
}
