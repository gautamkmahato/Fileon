import Image from "next/image";
import Link from "next/link";
import { APP_LOGO_SRC, APP_NAME } from "@/lib/brand";

const SIZE_PX = {
  xs: 28,
  sm: 32,
  md: 36,
  lg: 56,
} as const;

export type AppLogoSize = keyof typeof SIZE_PX | number;

function resolveSize(size: AppLogoSize): number {
  return typeof size === "number" ? size : SIZE_PX[size];
}

export function AppLogo({
  size = "sm",
  className = "",
  imageClassName = "",
  showName = false,
  nameClassName = "",
  href,
  priority = false,
}: {
  size?: AppLogoSize;
  className?: string;
  imageClassName?: string;
  showName?: boolean;
  nameClassName?: string;
  href?: string;
  priority?: boolean;
}) {
  const px = resolveSize(size);

  const content = (
    <Link href="/" className="inline-flex shrink-0">
      <span className={`inline-flex items-center gap-1.5 font-medium ${className}`}>
      <Image
        src={APP_LOGO_SRC}
        alt={`${APP_NAME} logo`}
        width={px}
        height={px}
        className={`shrink-0 rounded-lg object-contain ${imageClassName}`}
        priority={priority}
      />
      {showName ? (
        <span className={nameClassName}>{APP_NAME}</span>
      ) : null}
    </span>
    </Link>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0">
        {content}
      </Link>
    );
  }

  return content;
}
