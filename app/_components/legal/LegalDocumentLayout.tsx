import Link from "next/link";
import { APP_NAME } from "@/lib/brand";
import {
  HomeThemeStyles,
  homeSectionSubtitle,
  homeSectionTitle,
} from "@/app/home/_components/home-theme";

export function LegalDocumentLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <HomeThemeStyles />
      <header className="border-b border-[#E0EBF5] px-6 py-5 sm:px-10 lg:px-[72px]">
        <div className="font-display mx-auto flex max-w-[720px] items-center justify-between gap-4">
          <Link
            href="/home"
            className="font-serif-display text-[22px] font-semibold tracking-[-0.02em] text-[#1A1A1A]"
          >
            {APP_NAME}
          </Link>
          <Link
            href="/home"
            className="text-[13px] font-medium text-[#5B9FD4] hover:underline"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="font-display mx-auto max-w-[720px] px-6 py-12 sm:px-10 sm:py-16 lg:px-0">
        <h1 className={`${homeSectionTitle} text-[32px] sm:text-[40px]`}>{title}</h1>
        <p className={`${homeSectionSubtitle} mt-2 text-[12px] text-[#8A8A8A]`}>
          Last updated: {lastUpdated}
        </p>
        <article
          className={`${homeSectionSubtitle} mt-10 space-y-6 [&_h2]:font-serif-display [&_h2]:text-[18px] [&_h2]:font-semibold [&_h2]:text-[#1A1A1A] [&_h2]:mt-8 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_a]:text-[#5B9FD4] [&_a]:underline`}
        >
          {children}
        </article>
      </main>
    </div>
  );
}
