import { PublicShareGate } from "@/app/_components/shares/PublicShareGate";
import { isShareToken } from "@/lib/shares/token";

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const decoded = decodeURIComponent(token);
  if (!isShareToken(decoded)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-sm text-zinc-500">
        Invalid share link.
      </div>
    );
  }
  return <PublicShareGate token={decoded} />;
}
