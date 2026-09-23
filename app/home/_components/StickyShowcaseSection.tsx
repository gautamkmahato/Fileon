"use client";

import { useRef, useState } from "react";
import {
  ChevronRight,
  Copy,
  LayoutGrid,
  Sparkles,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import {
  HomeThemeStyles,
  homeBadge,
  homeSectionSubtitle,
  homeSectionTitle,
} from "./home-theme";

type ShowcaseStep = {
  index: string;
  badge: string;
  headline: [string, string];
  leftText: string;
  title: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  gdriveGap: string;
};

const STEPS: ShowcaseStep[] = [
  {
    index: "01.",
    badge: "Storage",
    headline: ["Reclaim Your", "Storage Space"],
    leftText:
      "Google Drive shows how full you are — but never what's wasting space. Find duplicates, stale files, and empty folders in one scan.",
    title: "Smart Cleanup",
    description:
      "Google Drive won't tell you what's eating your storage. We scan for duplicates, stale files, empty folders, and broken shortcuts — then show exactly what to remove.",
    icon: Copy,
    gradient: "from-[#7BB5E3] to-[#5B9FD4]",
    gdriveGap: "No duplicate finder in Drive",
  },
  {
    index: "02.",
    badge: "Organization",
    headline: ["Organize Files", "Your Way"],
    leftText:
      "Stars and colored folders only go so far. Add custom tags to any file and filter your entire Drive by label — instantly.",
    title: "Custom File Tags",
    description:
      "Stars and colored folders aren't enough. Tag any file with your own labels — Work, Client, Urgent — and filter across your entire Drive instantly.",
    icon: Tag,
    gradient: "from-[#8EC5E8] to-[#5B9FD4]",
    gdriveGap: "Drive has no custom tags",
  },
  {
    index: "03.",
    badge: "Automation",
    headline: ["Folders That", "Update Themselves"],
    leftText:
      "Stop manually sorting files into folders. Smart Spaces collect matching files by rules — tags, types, dates — without moving anything.",
    title: "Smart Spaces",
    description:
      "Create virtual folders that auto-fill from rules — by tag, file type, or date — without moving a single file in Google Drive.",
    icon: LayoutGrid,
    gradient: "from-[#A8D4F5] to-[#6BA3D6]",
    gdriveGap: "No rule-based collections",
  },
];

const STEP_COUNT = STEPS.length;
const SCROLL_HEIGHT = `${STEP_COUNT * 100}vh`;

export default function StickyShowcaseSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const next = Math.min(
      STEP_COUNT - 1,
      Math.max(0, Math.floor(value * STEP_COUNT))
    );
    setActiveStep(next);
  });

  return (
    <section
      ref={containerRef}
      className="relative bg-white"
      style={{ height: SCROLL_HEIGHT }}
      aria-label="Product highlights"
    >
      <HomeThemeStyles />

      <div className="font-display sticky top-0 flex h-screen items-center overflow-hidden px-6 sm:px-10 lg:px-[72px]">
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left — syncs with active card */}
          <div className="max-w-[480px] min-h-[280px] sm:min-h-[300px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className={homeBadge}>{STEPS[activeStep].badge}</span>

                <h2
                  className={`${homeSectionTitle} mt-6 text-[36px] sm:text-[48px] lg:text-[56px]`}
                >
                  {STEPS[activeStep].headline[0]}
                  <br />
                  {STEPS[activeStep].headline[1]}
                </h2>

                <p className={`${homeSectionSubtitle} mt-5`}>
                  {STEPS[activeStep].leftText}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Step indicators — horizontal */}
            <div className="mt-10 flex flex-wrap items-center gap-2 sm:gap-2.5">
              {STEPS.map((step, i) => (
                <button
                  key={step.index}
                  type="button"
                  onClick={() => {
                    const el = containerRef.current;
                    if (!el) return;
                    const top =
                      el.offsetTop +
                      (i / STEP_COUNT) * el.offsetHeight +
                      2;
                    window.scrollTo({ top, behavior: "smooth" });
                  }}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 transition-colors sm:px-4 sm:py-2.5 ${
                    activeStep === i
                      ? "bg-[#E8F2FA]"
                      : "opacity-45 hover:opacity-70"
                  }`}
                >
                  <span
                    className={`text-[11px] font-semibold tabular-nums sm:text-[12px] ${
                      activeStep === i ? "text-[#3D6B1E]" : "text-[#B0B0B0]"
                    }`}
                  >
                    {step.index}
                  </span>
                  <span
                    className={`whitespace-nowrap text-[11px] font-medium sm:text-[13px] ${
                      activeStep === i ? "text-[#1A1A1A]" : "text-[#8A8A8A]"
                    }`}
                  >
                    {step.title}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-2 text-[11px] text-[#B0B0B0]">
              <Sparkles className="h-3.5 w-3.5 text-[#5B9FD4]" strokeWidth={2} />
              <span>Scroll to explore each feature</span>
            </div>
          </div>

          {/* Right — stacked cards */}
          <div className="relative mx-auto h-[420px] w-full max-w-[480px] sm:h-[460px]">
            {STEPS.map((step, i) => {
              const offset = i - activeStep;
              const isPast = offset < 0;
              const isActive = offset === 0;
              const isFuture = offset > 0;

              return (
                <motion.article
                  key={step.index}
                  className="absolute inset-x-0 top-0 rounded-[32px] border border-[#E0EBF5] bg-[#F8FBFE] px-7 pb-8 pt-6 shadow-[0_24px_60px_-28px_rgba(91,159,212,0.18)] sm:px-8"
                  initial={false}
                  animate={{
                    y: isPast ? -120 : isFuture ? offset * 28 : 0,
                    scale: isPast ? 0.92 : isFuture ? 1 - offset * 0.04 : 1,
                    opacity: isPast ? 0 : isFuture ? 0.55 - offset * 0.12 : 1,
                    rotate: isFuture ? offset * 1.2 : 0,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 28,
                    mass: 0.8,
                  }}
                  style={{
                    zIndex: 30 - i + (isActive ? 10 : 0),
                    pointerEvents: isActive ? "auto" : "none",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-medium text-[#9A9A9A]">
                      {step.index}
                    </span>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-full border border-[#D8D8D8] bg-white px-4 py-1.5 text-[11px] font-medium text-[#4A4A4A] transition-colors hover:border-[#5B9FD4] hover:text-[#5B9FD4]"
                    >
                      Learn More
                      <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                  </div>

                  <div
                    className={`mx-auto mt-8 flex h-[88px] w-[88px] items-center justify-center rounded-[22px] bg-gradient-to-br shadow-[0_14px_32px_-12px_rgba(91,159,212,0.45)] ${step.gradient}`}
                  >
                    <step.icon
                      className="h-9 w-9 text-white"
                      strokeWidth={1.8}
                    />
                  </div>

                  <h3 className="font-serif-display mt-7 text-center text-[22px] font-semibold tracking-[-0.02em] text-[#1A1A1A]">
                    {step.title}
                  </h3>

                  <p className="mx-auto mt-3 max-w-[320px] text-center text-[12px] leading-[1.7] text-[#8A8A8A] sm:text-[13px]">
                    {step.description}
                  </p>

                  <p className="mt-4 text-center text-[10px] font-medium uppercase tracking-[0.08em] text-[#3D6B1E]">
                    {step.gdriveGap}
                  </p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
