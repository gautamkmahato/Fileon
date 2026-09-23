"use client";

import {
  FolderOpen,
  Link2,
  LogIn,
  Tags,
  type LucideIcon,
} from "lucide-react";
import {
  HomeThemeStyles,
  homeBadge,
  homeCardTitle,
  homeIconGradient,
  homeSectionSubtitle,
  homeSectionTitle,
} from "./home-theme";

type Step = {
  title: string;
  description: string;
  icon: LucideIcon;
  featured?: boolean;
};

const STEPS: Step[] = [
  {
    title: "Connect with Google",
    description:
      "Sign in with your Google account in one click. Your files stay in Drive — we never store your credentials.",
    icon: LogIn,
    featured: true,
  },
  {
    title: "Browse Your Drive",
    description:
      "Open a faster, calmer file browser with rich previews, instant search, and keyboard shortcuts built in.",
    icon: FolderOpen,
  },
  {
    title: "Organize & Tag",
    description:
      "Add custom tags, build Smart Spaces, and run cleanup scans to keep your storage under control.",
    icon: Tags,
  },
  {
    title: "Share Securely",
    description:
      "Create tracked share links, manage access, and send files without digging through Drive menus.",
    icon: Link2,
  },
];

export default function HowItWorksSection() {
  return (
    <section className="relative overflow-hidden bg-white px-6 py-20 sm:px-10 sm:py-24 lg:px-[72px] lg:py-28">
      <HomeThemeStyles />
      <style>{`
        .how-it-works-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .how-it-works-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div className="font-display mx-auto w-full max-w-[1200px]">
        <div className="mx-auto max-w-[680px] text-center">
          <span className={homeBadge}>How It Works</span>
          <h2
            className={`${homeSectionTitle} mt-5 text-[32px] sm:text-[42px] lg:text-[48px]`}
          >
            Set Up Your Account
            <br className="hidden sm:block" />
            And Start Organizing
          </h2>
          <p className={`${homeSectionSubtitle} mx-auto mt-4 max-w-[540px]`}>
            Get started in minutes. Connect Google Drive, browse with a better
            UI, organize with tags and Smart Spaces, and share files securely —
            all without moving your data.
          </p>
        </div>

        <div
          className="how-it-works-scroll mt-14 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:mt-16 sm:gap-5 lg:gap-6"
        >
          {STEPS.map((step) => (
            <article
              key={step.title}
              className="flex w-[min(100%,280px)] shrink-0 snap-start flex-col rounded-[24px] border border-[#E0EBF5] bg-[#FAFCFE] p-6 shadow-[0_20px_50px_-28px_rgba(91,159,212,0.12)] sm:w-[300px] sm:p-7 lg:w-[320px]"
            >
              <div
                className={
                  step.featured
                    ? `flex h-11 w-11 items-center justify-center rounded-[14px] ${homeIconGradient}`
                    : "flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#DCE8F4] bg-white"
                }
              >
                <step.icon
                  className={`h-5 w-5 ${step.featured ? "text-white" : "text-[#1A1A1A]"}`}
                  strokeWidth={step.featured ? 2.2 : 1.8}
                />
              </div>

              <h3 className={`${homeCardTitle} mt-8 text-[17px] sm:text-[18px]`}>
                {step.title}
              </h3>
              <p className={`${homeSectionSubtitle} mt-2.5 flex-1 text-[12.5px] sm:text-[13px]`}>
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
