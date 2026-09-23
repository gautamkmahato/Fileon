"use client";

import {
  Copy,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  LayoutGrid,
  Link2,
  Search,
  Sparkles,
  Tag,
} from "lucide-react";
import { APP_NAME } from "@/lib/brand";
import {
  HomeThemeStyles,
  homeBadge,
  homeCardTitle,
  homeSectionSubtitle,
  homeSectionTitle,
  homeSkyGradient,
} from "./home-theme";

const FEATURES = [
  {
    id: "cleanup",
    title: "Smart Cleanup",
    description:
      "Scan your Drive for duplicates, stale files, empty folders, and clutter — then reclaim space with confidence.",
    span: "md:col-span-6",
    visual: CleanupVisual,
  },
  {
    id: "sharing",
    title: "Instant Share Links",
    description:
      "Generate secure public links in one click. Control access, track views, and share without leaving your workflow.",
    span: "md:col-span-6",
    visual: SharingVisual,
  },
  {
    id: "spaces",
    title: "Smart Spaces",
    description:
      "Virtual folders that auto-collect files by rules — tags, types, dates — without moving anything in Drive.",
    span: "md:col-span-4",
    visual: SpacesVisual,
  },
  {
    id: "preview",
    title: "Rich Previews",
    description:
      "Open PDFs, images, spreadsheets, and markdown inline. No downloads, no tab switching.",
    span: "md:col-span-4",
    visual: PreviewVisual,
  },
  {
    id: "tags",
    title: "Tags & Saved Views",
    description:
      "Tag anything, combine filters, and save custom views — starred, shared, untagged, and more.",
    span: "md:col-span-4",
    visual: TagsVisual,
  },
  {
    id: "inbox",
    title: `${APP_NAME} Inbox`,
    description:
      "A focused queue for new and unprocessed files. Review, tag, and file things away without losing context.",
    span: "md:col-span-7",
    visual: InboxVisual,
  },
  {
    id: "search",
    title: "Instant Search",
    description:
      "Find any file or folder in seconds with fuzzy search, recent queries, and a command bar — no more digging through nested folders.",
    span: "md:col-span-5",
    visual: SearchVisual,
  },
] as const;

export default function FeaturesSection() {
  return (
    <section
      id="features"
      className="relative bg-white px-6 py-20 sm:px-10 sm:py-24 lg:px-[72px] lg:py-28"
    >
      <HomeThemeStyles />

      <div className="font-display mx-auto w-full max-w-[1200px]">
        <div className="mx-auto max-w-[720px] text-center">
          <span className={homeBadge}>Features</span>
          <h2
            className={`${homeSectionTitle} mt-5 text-[34px] sm:text-[44px] lg:text-[52px]`}
          >
            Everything You Need to
            <br className="hidden sm:block" />
            Manage Your Files
          </h2>
          <p className={`${homeSectionSubtitle} mx-auto mt-4 max-w-[560px]`}>
            {APP_NAME} is a calmer Google Drive experience — browse faster, organize
            smarter, clean up clutter, and share securely. Your files stay in Drive;
            we just make them easier to work with.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-5">
          {FEATURES.map((feature) => (
            <article
              key={feature.id}
              className={`group flex flex-col overflow-hidden rounded-[28px] border border-[#E8EEF4] bg-[#FAFCFE] shadow-[0_18px_50px_-30px_rgba(91,159,212,0.15)] transition-transform duration-300 hover:-translate-y-1 ${feature.span}`}
            >
              <div
                className={`relative h-[220px] overflow-hidden sm:h-[240px] ${homeSkyGradient}`}
              >
                <feature.visual />
              </div>
              <div className="flex flex-1 flex-col px-6 pb-7 pt-5 sm:px-7 sm:pb-8">
                <h3 className={homeCardTitle}>{feature.title}</h3>
                <p className={`${homeSectionSubtitle} mt-2 text-[12.5px] sm:text-[13px]`}>
                  {feature.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CleanupVisual() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative h-[170px] w-[280px]">
        <div className="absolute inset-0 rounded-[20px] bg-white shadow-[0_12px_40px_-20px_rgba(0,0,0,0.2)] ring-1 ring-[#EFEFEF]" />
        <div className="absolute left-5 top-5 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8F2FA]">
            <Sparkles className="h-4 w-4 text-[#5B9FD4]" strokeWidth={2.2} />
          </span>
          <span className="text-[10px] font-semibold text-[#3D3D3D]">Cleanup scan</span>
        </div>
        <div className="absolute left-5 right-5 top-[52px] space-y-2.5">
          {[
            { label: "Duplicates", w: "78%", color: "#5B9FD4" },
            { label: "Large files", w: "62%", color: "#7BB5E3" },
            { label: "Empty folders", w: "44%", color: "#A8D4F5" },
          ].map((row) => (
            <div key={row.label}>
              <div className="mb-1 flex justify-between text-[8px] text-[#9A9A9A]">
                <span>{row.label}</span>
                <span>Found</span>
              </div>
              <div className="h-[6px] rounded-full bg-[#F3F3F3]">
                <div
                  className="h-full rounded-full"
                  style={{ width: row.w, backgroundColor: row.color }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="absolute -right-3 bottom-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7BB5E3] to-[#5B9FD4] shadow-[0_10px_24px_-8px_rgba(91,159,212,0.8)]">
          <Copy className="h-6 w-6 text-white" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

function SharingVisual() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative h-[190px] w-[300px]">
        <div
          className="absolute inset-x-6 top-6 h-[120px] rounded-[18px] opacity-90"
          style={{
            backgroundImage:
              "radial-gradient(circle, #D9D9D9 1.2px, transparent 1.2px)",
            backgroundSize: "14px 14px",
          }}
        />
        <div className="absolute left-[38%] top-[18%] flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-[#7BB5E3] to-[#5B9FD4] shadow-[0_16px_36px_-12px_rgba(91,159,212,0.75)]">
          <Link2 className="h-7 w-7 text-white" strokeWidth={2.2} />
        </div>
        <span className="absolute left-[18%] top-[52%] rounded-full bg-white px-3 py-1 text-[9px] font-medium text-[#5B9FD4] shadow-md ring-1 ring-[#F0F0F0]">
          verrill@link
        </span>
        <span className="absolute right-[14%] top-[38%] rounded-full bg-white px-3 py-1 text-[9px] font-medium text-[#2F9E8F] shadow-md ring-1 ring-[#F0F0F0]">
          shared ✓
        </span>
        <div className="absolute bottom-2 left-1/2 h-[3px] w-[120px] -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-[#5B9FD4] to-transparent opacity-60" />
      </div>
    </div>
  );
}

function SpacesVisual() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative grid grid-cols-2 gap-3">
        {[
          { label: "Receipts", color: "#5B9FD4", rotate: "-6deg" },
          { label: "Screenshots", color: "#5B9BD5", rotate: "4deg" },
          { label: "Projects", color: "#7BC67E", rotate: "3deg" },
          { label: "Archives", color: "#C4A1E8", rotate: "-4deg" },
        ].map((space) => (
          <div
            key={space.label}
            className="flex h-[72px] w-[100px] flex-col justify-between rounded-[14px] bg-white p-3 shadow-[0_10px_28px_-16px_rgba(0,0,0,0.25)] ring-1 ring-[#EFEFEF]"
            style={{ transform: `rotate(${space.rotate})` }}
          >
            <LayoutGrid className="h-4 w-4" style={{ color: space.color }} strokeWidth={2} />
            <span className="text-[9px] font-semibold text-[#3D3D3D]">{space.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewVisual() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <div className="h-[130px] w-[100px] -rotate-6 rounded-[12px] bg-[#F3F3F3] shadow-lg" />
        <div className="absolute left-4 top-2 h-[130px] w-[100px] rotate-3 rounded-[12px] bg-white shadow-[0_14px_40px_-18px_rgba(0,0,0,0.3)] ring-1 ring-[#EFEFEF]">
          <div className="border-b border-[#F0F0F0] px-3 py-2">
            <div className="h-1.5 w-10 rounded-full bg-[#5B9FD4]" />
          </div>
          <div className="space-y-1.5 px-3 py-3">
            <div className="h-1 w-full rounded-full bg-[#ECECEC]" />
            <div className="h-1 w-[85%] rounded-full bg-[#ECECEC]" />
            <div className="h-1 w-[70%] rounded-full bg-[#ECECEC]" />
            <div className="mt-3 h-8 w-full rounded-md bg-gradient-to-br from-[#E8F2FA] to-[#D4E8F7]" />
          </div>
        </div>
        <div className="absolute -right-6 top-8 flex h-11 w-11 items-center justify-center rounded-full bg-[#1D3A63] shadow-lg">
          <Eye className="h-5 w-5 text-white" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

function TagsVisual() {
  const tags = [
    { label: "Work", color: "#5B9FD4" },
    { label: "Urgent", color: "#E1483F" },
    { label: "Client", color: "#2F5486" },
    { label: "Draft", color: "#7BC67E" },
  ];
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative flex flex-wrap justify-center gap-2.5 px-6 max-w-[220px]">
        {tags.map((tag, i) => (
          <span
            key={tag.label}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10px] font-medium text-[#3D3D3D] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.2)] ring-1 ring-[#EFEFEF]"
            style={{ transform: `rotate(${i % 2 === 0 ? -3 : 3}deg)` }}
          >
            <Tag className="h-3 w-3" style={{ color: tag.color }} strokeWidth={2.5} />
            {tag.label}
          </span>
        ))}
        <FolderOpen className="absolute -bottom-2 right-2 h-8 w-8 text-[#D0D0D0]" strokeWidth={1.5} />
      </div>
    </div>
  );
}

function InboxVisual() {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-8">
      <div className="relative w-full max-w-[340px]">
        <div className="rounded-[16px] bg-white p-4 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.2)] ring-1 ring-[#EFEFEF]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[#3D3D3D]">Inbox · 4 new</span>
            <span className="rounded-full bg-[#E8F2FA] px-2 py-0.5 text-[8px] font-medium text-[#5B9FD4]">
              Review
            </span>
          </div>
          <div className="space-y-2">
            {["Contract_v2.pdf", "Q3_Report.xlsx", "Design_mock.png"].map((name, i) => (
              <div
                key={name}
                className="flex items-center gap-2 rounded-[10px] bg-[#FAFAFA] px-3 py-2"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: i === 0 ? "#5B9FD4" : "#D9D9D9" }}
                />
                <span className="truncate text-[9px] text-[#5A5A5A]">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchVisual() {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-6">
      <div className="relative w-full max-w-[280px]">
        <div className="flex items-center gap-2 rounded-[14px] bg-white px-3.5 py-2.5 shadow-[0_12px_40px_-18px_rgba(0,0,0,0.25)] ring-1 ring-[#EFEFEF]">
          <Search className="h-4 w-4 text-[#5B9FD4]" strokeWidth={2.2} />
          <span className="text-[11px] text-[#9A9A9A]">invoice march...</span>
          <kbd className="ml-auto rounded-md bg-[#F5F5F5] px-1.5 py-0.5 text-[8px] font-medium text-[#8A8A8A]">
            ⌘K
          </kbd>
        </div>

        <div className="mt-2 overflow-hidden rounded-[14px] bg-white shadow-[0_12px_40px_-18px_rgba(0,0,0,0.2)] ring-1 ring-[#EFEFEF]">
          <div className="border-b border-[#F3F3F3] px-3 py-1.5 text-[8px] font-medium uppercase tracking-wide text-[#B0B0B0]">
            Results
          </div>
          {[
            { name: "Invoice_March.pdf", icon: FileText, folder: "Finance" },
            { name: "Q1 Reports", icon: Folder, folder: "My Drive" },
          ].map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-2.5 border-b border-[#F8F8F8] px-3 py-2 last:border-0"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E8F2FA]">
                <item.icon className="h-3.5 w-3.5 text-[#5B9FD4]" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-medium text-[#3D3D3D]">
                  {item.name}
                </p>
                <p className="text-[8px] text-[#A0A0A0]">{item.folder}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
