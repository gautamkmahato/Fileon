"use client";

import {
  Menu,
  ChevronRight,
  Image as ImageIcon,
  Camera,
  User,
} from "lucide-react";
import { APP_NAME } from "@/lib/brand";
import {
  HomeThemeStyles,
  homeBadge,
  homeCta,
} from "./home-theme";

/* ------------------------------------------------------------------
   HeroSection.tsx
   Next.js (App Router) + Tailwind CSS + lucide-react
   Background image expected at: /public/hero-bg.png
------------------------------------------------------------------- */

const RECENT_FILES = [
  { name: "Sunset Pic Today 1.jpg", progress: 64, speed: "0 Mbps/1240 Mbps" },
  { name: "Market Day 4.jpg", progress: 56, speed: "2 Mbps/1240 Mbps" },
  { name: "IMG 589654723-1CTA", progress: 47, speed: "8 Mbps/1240 Mbps" },
  { name: "IMG 599659728-1CPA", progress: 34, speed: "10 Mbps/1240 Mbps" },
  { name: "IMG 609674716-1CZW", progress: 22, speed: "14 Mbps/1240 Mbps" },
];

const TABS = ["All Files", "Shared", "Favorites", "Archives"];

export default function HeroSection() {
  return (
    <section
      className="relative min-h-screen w-full overflow-hidden bg-[#E8F2FA] bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/hero-bg.png')" }}
    >
      <HomeThemeStyles />

      <div className="font-display relative z-10">
        {/* ---------------- NAVBAR ---------------- */}
        <nav className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-6 pt-8 sm:px-10 lg:px-[72px]">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open menu"
              className="rounded-md p-1 text-[#1A1A1A] transition-opacity hover:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9FD4]"
            >
              <Menu className="h-7 w-7" strokeWidth={2} />
            </button>
            <span className="font-serif-display text-[22px] font-semibold tracking-[-0.02em] text-white sm:text-[24px]">
              {APP_NAME}
            </span>
          </div>

          <button className="group relative flex items-center gap-2 rounded-full bg-gradient-to-b from-[#5B9FD4] to-[#3D7AB0] py-[5px] pl-[5px] pr-4 ring-[3px] ring-[#D4E8F7]/80 shadow-[0_10px_24px_-10px_rgba(91,159,212,0.55)] transition-transform hover:-translate-y-[1px] focus:outline-none focus-visible:ring-[#5B9FD4]">
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#C8F060] shadow-[inset_0_-2px_4px_rgba(0,0,0,0.08)]">
              <ChevronRight className="h-[14px] w-[14px] text-[#3D6B1E]" strokeWidth={3.5} />
            </span>
            <span className="text-[14px] font-semibold leading-none text-white">
              Downloads For Mac
            </span>
          </button>
        </nav>

        {/* ---------------- COPY BLOCK ---------------- */}
        <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center px-6 pt-10 text-center sm:pt-12">
          <span className={`${homeBadge} backdrop-blur-sm`}>
            Effortless Multi-Device Sync
          </span>

          <h1 className="font-serif-display mt-6 max-w-[760px] text-[42px] font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-[56px] lg:text-[64px]">
            The Future of Personal
            <br className="hidden sm:block" /> Cloud Storage
          </h1>

          <p className="mt-4 max-w-[470px] text-[12.5px] leading-[1.65] text-white/75 sm:text-[13.5px]">
            Store More, Access Faster, And Manage Your Data With Confidence
            <br className="hidden sm:block" /> As Your Needs Continue To Grow.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
            <button
              className={`${homeCta} gap-2 py-2.5 pl-6 pr-2`}
            >
              <span>Get Started</span>
              <span className="flex h-[24px] w-[24px] items-center justify-center rounded-full bg-[#1A1A1A]/10">
                <ChevronRight className="h-[13px] w-[13px] text-[#1A1A1A]" strokeWidth={3} />
              </span>
            </button>

            <span className="text-[13px] font-medium text-[#D4F5A8]">
              Free Trial — No Card Required
            </span>
          </div>
        </div>

        {/* ---------------- DASHBOARD PREVIEW ---------------- */}
        <div className="relative mx-auto mt-12 w-[92%] max-w-[1000px]">
          <div className="h-[360px] overflow-hidden rounded-t-[26px] bg-white/85 px-6 pt-6 shadow-[0_-16px_60px_-24px_rgba(91,159,212,0.25)] ring-1 ring-white/70 backdrop-blur-md sm:px-8 sm:pt-7">
            <h2 className="font-serif-display text-[16px] font-semibold tracking-[-0.01em] text-[#1A1A1A]">
              Recently Add
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[1.22fr_1fr]">
              {/* ---- LEFT: file table ---- */}
              <div className="overflow-hidden rounded-[14px] bg-white shadow-[0_10px_30px_-18px_rgba(0,0,0,0.25)]">
                <div className="grid grid-cols-[1.35fr_1fr_1fr] bg-[#D4E8F7] px-5 py-[14px] text-[10.5px] font-medium text-[#4A4A4A]">
                  <span>Name</span>
                  <span>Peogress</span>
                  <span>Upload Speed</span>
                </div>

                {RECENT_FILES.map((file) => (
                  <div
                    key={file.name}
                    className="grid grid-cols-[1.35fr_1fr_1fr] items-center border-b border-[#F3F3F3] px-5 py-[13px] last:border-0"
                  >
                    <span className="truncate pr-3 text-[10.5px] text-[#3D3D3D]">
                      {file.name}
                    </span>
                    <span className="pr-6">
                      <span className="block h-[5px] w-full rounded-full bg-[#E0EBF5]">
                        <span
                          className="block h-full rounded-full bg-[#5B9FD4]"
                          style={{ width: `${file.progress}%` }}
                        />
                      </span>
                    </span>
                    <span className="text-[10.5px] text-[#8A8A8A]">{file.speed}</span>
                  </div>
                ))}

                {/* tabs */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-1">
                    {TABS.map((tab, i) => (
                      <button
                        key={tab}
                        className={
                          i === 0
                            ? "rounded-full bg-[#D4F5A8] px-4 py-[7px] text-[10.5px] font-medium text-[#3D6B1E]"
                            : "rounded-full px-4 py-[7px] text-[10.5px] text-[#9A9A9A] transition-colors hover:text-[#5A5A5A]"
                        }
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                  <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-gradient-to-br from-[#7BB5E3] to-[#5B9FD4] ring-2 ring-white">
                    <User className="h-[13px] w-[13px] text-white" strokeWidth={2.5} />
                  </span>
                </div>
              </div>

              {/* ---- RIGHT: folder cards ---- */}
              <div className="grid grid-cols-2 gap-4">
                {/* Images */}
                <FolderCard
                  title="Images"
                  count="212 Files"
                  meta="15.56 GB   Created On 20/07/26"
                >
                  <div className="absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2">
                    <span className="absolute left-[14%] top-[26%] h-[52px] w-[42px] -rotate-[10deg] rounded-[8px] bg-[#8CC5EA] shadow-md" />
                    <span className="absolute left-[36%] top-[18%] h-[52px] w-[42px] rotate-[6deg] rounded-[8px] bg-[#FBD96B] shadow-md" />
                    <span className="absolute left-[52%] top-[30%] flex h-[46px] w-[46px] rotate-[14deg] items-center justify-center rounded-[8px] bg-white shadow-md">
                      <ImageIcon className="h-4 w-4 text-[#6E6E6E]" strokeWidth={1.8} />
                    </span>
                  </div>
                </FolderCard>

                {/* Documents */}
                <FolderCard
                  title="Documents"
                  count="51 Files"
                  meta="4.56 GB   Created On 20/07/26"
                >
                  <div className="absolute inset-0">
                    <span className="absolute left-[16%] top-[34%] h-[50px] w-[44px] -rotate-[8deg] rounded-[6px] bg-[#F3F1EE] shadow-md" />
                    <span className="absolute left-[38%] top-[30%] h-[50px] w-[44px] rotate-[5deg] rounded-[6px] bg-white shadow-md" />
                    <span className="absolute left-[14%] top-[14%] rounded-[5px] bg-[#2C4E86] px-[9px] py-[3px] text-[8px] font-semibold text-white shadow-sm">
                      XLS
                    </span>
                    <span className="absolute right-[16%] top-[24%] rounded-[5px] bg-[#E1483F] px-[9px] py-[3px] text-[8px] font-semibold text-white shadow-sm">
                      Doc
                    </span>
                  </div>
                </FolderCard>

                {/* Videos */}
                <FolderCard
                  title="Videos"
                  count="168 Files"
                  meta="9.80 GB   Created On 20/07/26"
                >
                  <div className="absolute inset-0">
                    <span className="absolute left-[14%] top-[30%] h-[50px] w-[44px] -rotate-[9deg] rounded-[8px] bg-[#9BC8E8] shadow-md" />
                    <span className="absolute left-[40%] top-[22%] flex h-[50px] w-[46px] rotate-[7deg] items-center justify-center rounded-[8px] bg-[#3B3B3B] shadow-md">
                      <Camera className="h-4 w-4 text-white" strokeWidth={1.8} />
                    </span>
                  </div>
                </FolderCard>

                {/* Files */}
                <FolderCard
                  title="Files"
                  count="312 Files"
                  meta="7.16 GB   Created On 20/07/26"
                >
                  <div className="absolute inset-0">
                    <span className="absolute left-[12%] top-[30%] flex h-[50px] w-[46px] -rotate-[9deg] items-end justify-center rounded-[8px] bg-white pb-2 text-[9px] font-semibold text-[#5B9FD4] shadow-md">
                      ZIF
                    </span>
                    <span className="absolute left-[42%] top-[26%] flex h-[50px] w-[46px] rotate-[7deg] items-end justify-center rounded-[8px] bg-[#E8F2FA] pb-2 text-[9px] font-semibold text-[#3D6B1E] shadow-md">
                      ZIP
                    </span>
                  </div>
                </FolderCard>
              </div>
            </div>
          </div>

          {/* fade-out at the bottom of the dashboard */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[130px] bg-gradient-to-t from-[#E8F2FA] via-[#E8F2FA]/85 to-transparent" />
        </div>
      </div>
    </section>
  );
}

/* ---------------- small local helper ---------------- */
function FolderCard({
  title,
  count,
  meta,
  children,
}: {
  title: string;
  count: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[14px] bg-white/60 p-[7px] shadow-[0_10px_30px_-20px_rgba(0,0,0,0.35)] ring-1 ring-white/70">
      <div className="relative h-[84px] overflow-hidden rounded-[10px] bg-gradient-to-br from-[#B8D4F0] to-[#7BB5E3]">
        {children}
      </div>
      <div className="flex items-center justify-between px-[6px] pt-[9px]">
        <span className="font-serif-display text-[11.5px] font-semibold text-[#1A1A1A]">{title}</span>
        <span className="rounded-full bg-white/90 px-[7px] py-[2px] text-[7.5px] text-[#8A8A8A]">
          {count}
        </span>
      </div>
      <p className="px-[6px] pb-[2px] pt-[3px] text-[7.5px] text-[#9A9A9A]">{meta}</p>
    </div>
  );
}


