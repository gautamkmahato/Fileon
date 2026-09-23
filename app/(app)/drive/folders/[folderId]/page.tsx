import { redirect } from "next/navigation";

/** Legacy route — redirects to My Drive folder view. */
export default async function LegacyFolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  redirect(`/my-drive/folders/${folderId}`);
}
