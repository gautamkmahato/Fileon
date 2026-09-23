"use client";

import { Star } from "lucide-react";
import { APP_NAME } from "@/lib/brand";
import {
  HomeThemeStyles,
  homeBadge,
  homeSectionSubtitle,
  homeSectionTitle,
} from "./home-theme";

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  initials: string;
  avatarBg: string;
  featured?: boolean;
  rotate: string;
  offsetY: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Finally, a Drive interface that doesn't feel cluttered. Search is instant and previews actually work — our whole team switched in a week.",
    name: "Ricky Mosley",
    role: "Entrepreneur",
    initials: "RM",
    avatarBg: "from-[#6B9BD1] to-[#4A7FB5]",
    rotate: "-rotate-[2.5deg]",
    offsetY: "translate-y-3",
  },
  {
    quote:
      "The cleanup scan found 4 GB of duplicates Google never flagged. Tags and Smart Spaces changed how we organize client files.",
    name: "Richard Coon",
    role: "Agency Owner",
    initials: "RC",
    avatarBg: "from-[#7BB5E3] to-[#5B9FD4]",
    featured: true,
    rotate: "rotate-[1.5deg]",
    offsetY: "-translate-y-4",
  },
  {
    quote:
      "Share links with view tracking beat sending Drive links back and forth. The inbox view alone saves me an hour every week.",
    name: "Dorene Lizotte",
    role: "Freelance Designer",
    initials: "DL",
    avatarBg: "from-[#9B8FD9] to-[#7A6BB8]",
    rotate: "-rotate-[1deg]",
    offsetY: "translate-y-5",
  },
  {
    quote:
      "Keyboard shortcuts, bulk actions, and saved views — it's what Google Drive should have been. Our ops team won't go back.",
    name: "Ana Faul",
    role: "Operations Lead",
    initials: "AF",
    avatarBg: "from-[#6BCB9A] to-[#45A87A]",
    rotate: "rotate-[2deg]",
    offsetY: "-translate-y-1",
  },
];

function StarRating() {
  return (
    <div className="flex items-center gap-0.5" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className="h-3.5 w-3.5 fill-[#F5B800] text-[#F5B800]"
          strokeWidth={0}
        />
      ))}
    </div>
  );
}

export default function TestimonialsSection() {
  return (
    <section className="relative overflow-hidden bg-white px-6 py-20 sm:px-10 sm:py-24 lg:px-[72px] lg:py-28">
      <HomeThemeStyles />
      <style>{`
        .testimonials-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .testimonials-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div className="font-display mx-auto w-full max-w-[1200px]">
        <div className="mx-auto max-w-[680px] text-center">
          <span className={homeBadge}>Testimonials</span>
          <h2
            className={`${homeSectionTitle} mt-5 text-[32px] sm:text-[42px] lg:text-[48px]`}
          >
            Loved By Teams
            <br className="hidden sm:block" />
            Around The World
          </h2>
          <p className={`${homeSectionSubtitle} mx-auto mt-4 max-w-[520px]`}>
            See why people switch from the default Google Drive UI to {APP_NAME} — a
            faster, calmer way to manage their files.
          </p>
        </div>

        <div
          className="testimonials-scroll mt-14 flex items-center gap-5 overflow-x-auto px-2 pb-6 pt-4 sm:mt-16 sm:justify-center sm:gap-6 sm:overflow-visible sm:px-0"
        >
          {TESTIMONIALS.map((item) => (
            <article
              key={item.name}
              className={`relative flex w-[min(100%,260px)] shrink-0 flex-col rounded-[28px] p-6 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.18)] transition-transform duration-300 hover:-translate-y-1 sm:w-[250px] sm:p-7 lg:w-[270px] ${item.rotate} ${item.offsetY} ${
                item.featured
                  ? "bg-[#E8F2FA] ring-1 ring-[#B8D4F0]/80"
                  : "bg-[#F8FBFE] ring-1 ring-[#E0EBF5]"
              }`}
            >
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br text-[12px] font-semibold text-white shadow-md ${item.avatarBg}`}
              >
                {item.initials}
              </div>

              <div className="mt-5">
                <StarRating />
              </div>

              <blockquote className="font-serif-display mt-5 flex-1 text-[13px] font-medium leading-[1.65] text-[#3D3D3D] sm:text-[13.5px]">
                &ldquo;{item.quote}&rdquo;
              </blockquote>

              <footer className="mt-6 border-t border-black/[0.06] pt-4">
                <p className="font-serif-display text-[14px] font-semibold text-[#1A1A1A]">
                  {item.name}
                </p>
                <p className="mt-0.5 text-[11px] text-[#9A9A9A]">{item.role}</p>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
