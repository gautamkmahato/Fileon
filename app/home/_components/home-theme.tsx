export function HomeThemeStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Poppins:wght@400;500;600&display=swap');
      .font-serif-display { font-family: 'Playfair Display', Georgia, serif; }
      .font-display { font-family: 'Poppins', ui-sans-serif, system-ui, sans-serif; }
    `}</style>
  );
}

export const homeBadge =
  "inline-flex rounded-full bg-[#D4F5A8] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#3D6B1E]";

export const homeSectionTitle =
  "font-serif-display font-semibold leading-[1.15] tracking-[-0.02em] text-[#1A1A1A]";

export const homeSectionSubtitle =
  "font-display text-[13px] leading-[1.7] text-[#5A5A5A] sm:text-[14px]";

export const homeCardTitle =
  "font-serif-display text-[18px] font-semibold tracking-[-0.02em] text-[#1A1A1A] sm:text-[20px]";

export const homeCta =
  "inline-flex items-center justify-center rounded-full bg-[#C8F060] px-8 py-3.5 text-[14px] font-semibold text-[#1A1A1A] shadow-[0_8px_24px_-8px_rgba(120,180,40,0.5)] transition-transform hover:-translate-y-0.5 hover:bg-[#B8E850]";

export const homeSkyGradient =
  "bg-gradient-to-br from-[#B8D4F0] via-[#D4E8F7] to-[#E8F2FA]";

export const homeIconGradient =
  "bg-gradient-to-br from-[#7BB5E3] to-[#5B9FD4] shadow-[0_10px_24px_-10px_rgba(91,159,212,0.55)]";

export const homeAccentText = "text-[#3D6B1E]";
export const homeAccentBg = "bg-[#D4F5A8]";
export const homeAccentSoft = "bg-[#E8F2FA]";
