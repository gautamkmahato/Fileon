"use client";

import Link from "next/link";
import { HardDrive, Inspect, Link2 } from "lucide-react";
import { APP_NAME } from "@/lib/brand";

const PRODUCT_LINKS = [
  { label: "Features", href: "/home#features" },
  { label: "Pricing", href: "/home#pricing" },
  { label: "Get Started", href: "/" },
];

const COMPANY_LINKS = [
  { label: "About", href: "#" },
  { label: "Careers", href: "#" },
  { label: "Contact", href: "#" },
];

const RESOURCE_LINKS = [
  { label: "Blog", href: "#" },
  { label: "Help Center", href: "#" },
  { label: "API Docs", href: "#" },
];

function LogoMark() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30">
      <div className="grid grid-cols-2 gap-[3px]">
        {Array.from({ length: 4 }).map((_, i) => (
          <span
            key={i}
            className="h-[7px] w-[7px] rounded-[2px] bg-white"
          />
        ))}
      </div>
    </div>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
      />
    </svg>
  );
}

export default function HomeFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="px-6 pb-10 pt-4 sm:px-10 lg:px-[72px] lg:pb-14">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Poppins:wght@400;500;600&display=swap');
        .font-serif-display { font-family: 'Playfair Display', Georgia, serif; }
        .font-display { font-family: 'Poppins', ui-sans-serif, system-ui, sans-serif; }
      `}</style>

      <div className="font-display relative mx-auto max-w-[1200px] overflow-hidden rounded-[36px] shadow-[0_32px_80px_-36px_rgba(30,80,140,0.45)]">
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#5B9FD4] via-[#7BB5E3] to-[#A8D4F5]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-8 top-0 h-full w-[55%] bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 300%22%3E%3Ccircle cx=%22320%22 cy=%2280%22 r=%2290%22 fill=%22white%22 fill-opacity=%220.35%22/%3E%3Ccircle cx=%22280%22 cy=%22160%22 r=%2270%22 fill=%22white%22 fill-opacity=%220.25%22/%3E%3Ccircle cx=%22350%22 cy=%22220%22 r=%2255%22 fill=%22white%22 fill-opacity=%220.3%22/%3E%3C/svg%3E')] bg-cover bg-right bg-no-repeat opacity-90"
          aria-hidden="true"
        />

        <div className="relative px-8 py-10 sm:px-12 sm:py-12 lg:px-14 lg:py-14">
          <div className="flex flex-col gap-12 lg:flex-row lg:justify-between lg:gap-16">
            {/* Left column */}
            <div className="max-w-[380px]">
              <div className="flex items-center gap-3">
                <LogoMark />
                <span className="font-serif-display text-[28px] font-semibold tracking-[-0.02em] text-white sm:text-[32px]">
                  {APP_NAME}
                </span>
              </div>

              <p className="font-serif-display mt-4 text-[14px] leading-[1.65] text-white/90 sm:text-[15px]">
                Built for faster browsing and smarter file management on top of
                your Google Drive.
              </p>

              <div className="mt-10">
                <p className="font-serif-display text-[15px] font-medium text-[#D4F5A8]">
                  Get The App
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href="#"
                    className="inline-flex items-center gap-2.5 rounded-full bg-white px-4 py-2.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.2)] ring-1 ring-white/60 transition-transform hover:-translate-y-0.5"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
                      />
                    </svg>
                    <span className="text-left leading-tight">
                      <span className="block text-[8px] text-[#6A6A6A]">
                        Download on the
                      </span>
                      <span className="block text-[11px] font-semibold text-[#1A1A1A]">
                        App Store
                      </span>
                    </span>
                  </a>
                  <a
                    href="#"
                    className="inline-flex items-center gap-2.5 rounded-full bg-white px-4 py-2.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.2)] ring-1 ring-white/60 transition-transform hover:-translate-y-0.5"
                  >
                    <HardDrive className="h-5 w-5 text-[#F0762B]" strokeWidth={2} />
                    <span className="text-left leading-tight">
                      <span className="block text-[8px] text-[#6A6A6A]">
                        Open in
                      </span>
                      <span className="block text-[11px] font-semibold text-[#1A1A1A]">
                        Web App
                      </span>
                    </span>
                  </a>
                </div>
              </div>

              <div className="mt-10">
                <p className="font-serif-display text-[15px] font-medium text-white">
                  Social Media
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <a
                    href="#"
                    aria-label="Instagram"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#1A1A1A] shadow-md transition-transform hover:-translate-y-0.5"
                  >
                    <Inspect className="h-4 w-4" strokeWidth={2} />
                  </a>
                  <a
                    href="#"
                    aria-label="WhatsApp"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#1A1A1A] shadow-md transition-transform hover:-translate-y-0.5"
                  >
                    <WhatsAppIcon className="h-4 w-4" />
                  </a>
                  <a
                    href="#"
                    aria-label="LinkedIn"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#1A1A1A] shadow-md transition-transform hover:-translate-y-0.5"
                  >
                    <Link2 className="h-4 w-4" strokeWidth={2} />
                  </a>
                </div>
              </div>
            </div>

            {/* Right columns */}
            <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 sm:gap-12 lg:gap-16">
              <FooterColumn title="Product" links={PRODUCT_LINKS} />
              <FooterColumn title="Company" links={COMPANY_LINKS} />
              <FooterColumn title="Resources" links={RESOURCE_LINKS} />
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-4 border-t border-white/25 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-serif-display text-[13px] text-white/85">
              © {year} {APP_NAME}. All Rights Reserved.
            </p>
            <div className="flex flex-wrap items-center gap-6">
              <Link
                href="/privacy"
                className="font-serif-display text-[13px] text-white/90 transition-opacity hover:opacity-80"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="font-serif-display text-[13px] text-white/90 transition-opacity hover:opacity-80"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <p className="font-serif-display text-[15px] font-semibold text-white">
        {title}
      </p>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="font-serif-display text-[14px] text-white/85 transition-opacity hover:text-white"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
