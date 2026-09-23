"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  FolderPlus,
  Folder as FolderIcon,
  Globe,
  Link as LinkIcon,
  Loader2,
  Lock,
  Pencil,
  Search,
} from "lucide-react";
import { Modal } from "./Modal";
import {
  buildShareUrl,
  disableLinkShare,
  enableLinkShare,
  findLinkPermission,
  listAllFolders,
  type DriveFolder,
} from "@/lib/drive/drive-extras";
import { useAuth } from "../auth/AuthProvider";
import { toast, runAsync } from "@/lib/toast";
import { logActivity } from "@/lib/activity-log";
import { AppSharePanel } from "../shares/AppSharePanel";

// ── New Folder ─────────────────────────────────────────────────────────────

export function NewFolderModal({
  open, onClose, onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setName(""); }, [open]);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try { await onCreate(name.trim()); onClose(); }
    finally { setBusy(false); }
  }

  return (
    <Modal
      open={open} onClose={onClose} title="New folder"
      footer={
        <>
          <button onClick={onClose} className="text-sm font-medium px-4 py-2 rounded-lg text-zinc-700 hover:bg-zinc-100">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || busy}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
            Create
          </button>
        </>
      }
    >
      <label className="block text-xs font-medium text-zinc-600 mb-1.5">Folder name</label>
      <input
        autoFocus value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        placeholder="My new folder"
        className="w-full h-10 px-3 rounded-lg bg-white border border-zinc-200 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
      />
    </Modal>
  );
}

// ── Rename ─────────────────────────────────────────────────────────────────

export function RenameModal({
  open, initialName, onClose, onRename,
}: {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onRename: (name: string) => Promise<void> | void;
}) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setName(initialName); }, [open, initialName]);

  async function submit() {
    const t = name.trim();
    if (!t || t === initialName) { onClose(); return; }
    setBusy(true);
    try { await onRename(t); onClose(); }
    finally { setBusy(false); }
  }

  return (
    <Modal
      open={open} onClose={onClose} title="Rename"
      footer={
        <>
          <button onClick={onClose} className="text-sm font-medium px-4 py-2 rounded-lg text-zinc-700 hover:bg-zinc-100">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || busy}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
            Rename
          </button>
        </>
      }
    >
      <label className="block text-xs font-medium text-zinc-600 mb-1.5">New name</label>
      <input
        autoFocus value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        className="w-full h-10 px-3 rounded-lg bg-white border border-zinc-200 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
      />
    </Modal>
  );
}

// ── Share (link-only, view-only) ───────────────────────────────────────────

export function ShareModal({
  open, fileId, fileName, fileMime, onClose, onSharingChanged,
}: {
  open: boolean;
  fileId: string | null;
  fileName: string;
  fileMime: string;
  onClose: () => void;
  onSharingChanged?: () => void;
}) {
  const { token } = useAuth();
  const [linkEnabled, setLinkEnabled] = useState(false);
  const [permissionId, setPermissionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);

  // Check current share status on open
  useEffect(() => {
    if (!open || !fileId || !token) return;
    let cancelled = false;
    setLoading(true);
    setCopied(false);
    findLinkPermission(token, fileId)
      .then((p) => {
        if (cancelled) return;
        setLinkEnabled(!!p);
        setPermissionId(p?.id || null);
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, fileId, token]);

  const shareUrl = fileId ? buildShareUrl(fileId, fileMime) : "";

  async function handleToggle() {
    if (!fileId || !token) return;
    setToggling(true);
    await runAsync({
      loading: linkEnabled ? "Disabling link sharing…" : "Enabling link sharing…",
      success: linkEnabled ? "Link sharing disabled" : "Link sharing enabled",
      error: "Failed to update sharing",
      fn: async () => {
        if (linkEnabled && permissionId) {
          await disableLinkShare(token, fileId, permissionId);
          setLinkEnabled(false);
          setPermissionId(null);
          await logActivity({
            type: "share-disable",
            description: `Disabled link sharing for ${fileName}`,
            fileIds: [fileId],
            fileNames: [fileName],
          });
          onSharingChanged?.();
        } else {
          const created = await enableLinkShare(token, fileId);
          setLinkEnabled(true);
          setPermissionId(created.id);
          await logActivity({
            type: "share-enable",
            description: `Enabled link sharing for ${fileName}`,
            fileIds: [fileId],
            fileNames: [fileName],
          });
          onSharingChanged?.();
        }
      },
    });
    setToggling(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.info("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      toast.error("Failed to copy link");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Share "${fileName}"`} width="max-w-lg">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
        </div>
      ) : (
        <>
          {/* Access toggle */}
          <div className="flex items-start gap-3 p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              linkEnabled ? "bg-emerald-100 text-emerald-600" : "bg-zinc-200 text-zinc-500"
            }`}>
              {linkEnabled ? <Globe className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-900">
                {linkEnabled ? "Anyone with the link" : "Restricted"}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1">
                {linkEnabled ? (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    Anyone with the link can view (read-only)
                  </>
                ) : (
                  "Only people you add can open"
                )}
              </p>
            </div>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                linkEnabled
                  ? "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                  : "bg-zinc-900 text-white hover:bg-zinc-700"
              }`}
            >
              {toggling
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : linkEnabled ? "Disable" : "Enable link"}
            </button>
          </div>

          {/* Share link */}
          {linkEnabled && (
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1.5">Share link</label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 h-10 px-3 rounded-lg bg-zinc-50 border border-zinc-200 text-sm text-zinc-700 min-w-0">
                  <LinkIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate font-mono text-xs">{shareUrl}</span>
                </div>
                <button
                  onClick={handleCopy}
                  className={`shrink-0 h-10 px-3.5 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 transition-colors ${
                    copied
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-zinc-900 text-white hover:bg-zinc-700"
                  }`}
                >
                  {copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 mt-2 flex items-center gap-1">
                <Eye className="w-3 h-3" />
                Recipients can only view — they cannot edit or comment.
              </p>
            </div>
          )}

          {!linkEnabled && (
            <p className="text-xs text-zinc-500 text-center py-2">
              Enable the link to share this file with others.
            </p>
          )}

          {fileId && (
            <AppSharePanel
              fileId={fileId}
              fileName={fileName}
              fileMime={fileMime}
              driveLinkEnabled={linkEnabled}
              onDriveShareChanged={() => {
                if (!fileId || !token) return;
                void findLinkPermission(token, fileId).then((p) => {
                  setLinkEnabled(!!p);
                  setPermissionId(p?.id || null);
                  onSharingChanged?.();
                });
              }}
            />
          )}
        </>
      )}
    </Modal>
  );
}

// ── Confirm (for destructive actions like trash) ───────────────────────────

export function ConfirmModal({
  open, title, message, confirmLabel = "Confirm", confirmVariant = "default",
  onClose, onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: "default" | "danger";
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);

  async function handle() {
    setBusy(true);
    try { await onConfirm(); onClose(); }
    finally { setBusy(false); }
  }

  return (
    <Modal
      open={open} onClose={onClose} title={title}
      footer={
        <>
          <button onClick={onClose} className="text-sm font-medium px-4 py-2 rounded-lg text-zinc-700 hover:bg-zinc-100">
            Cancel
          </button>
          <button
            onClick={handle}
            disabled={busy}
            className={`text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5 ${
              confirmVariant === "danger"
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-zinc-900 text-white hover:bg-zinc-700"
            }`}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        {confirmVariant === "danger" && (
          <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        )}
        <p className="text-sm text-zinc-700 leading-relaxed flex-1">{message}</p>
      </div>
    </Modal>
  );
}

// ── Move to folder ─────────────────────────────────────────────────────────

export function MoveModal({
  open, fileName, currentParentId, excludeFolderId, onClose, onMove,
}: {
  open: boolean;
  fileName: string;
  currentParentId: string | null;
  /** If the file being moved IS a folder, we can't allow moving it into itself. */
  excludeFolderId?: string;
  onClose: () => void;
  onMove: (newParentId: string, destName: string) => Promise<void> | void;
}) {
  const { token } = useAuth();
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    setLoading(true);
    setSelected(null);
    setSearch("");
    listAllFolders(token)
      .then((fs) => { if (!cancelled) setFolders(fs); })
      .catch((err) => { console.error(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, token]);

  const filteredFolders = folders
    .filter((f) => f.id !== excludeFolderId)
    .filter((f) => !search.trim() || f.name.toLowerCase().includes(search.toLowerCase()));

  // Add "My Drive" as a target option (parentId = "root")
  const showMyDrive = currentParentId !== null;
  const filteredMyDrive = showMyDrive && (!search.trim() || "my drive".includes(search.toLowerCase()));

  async function handleMove() {
    if (!selected) return;
    const destName =
      selected === "root"
        ? "My Drive"
        : folders.find((f) => f.id === selected)?.name ?? "folder";
    setBusy(true);
    try { await onMove(selected, destName); onClose(); }
    finally { setBusy(false); }
  }

  return (
    <Modal
      open={open} onClose={onClose} title={`Move "${fileName}"`} width="max-w-md"
      footer={
        <>
          <button onClick={onClose} className="text-sm font-medium px-4 py-2 rounded-lg text-zinc-700 hover:bg-zinc-100">
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={!selected || busy}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Move here
          </button>
        </>
      }
    >
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search folders…"
          className="w-full h-9 pl-9 pr-3 rounded-lg bg-white border border-zinc-200 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
        </div>
      ) : (
        <ul className="max-h-[320px] overflow-y-auto -mx-1.5 space-y-0.5">
          {filteredMyDrive && (
            <FolderRow
              name="My Drive"
              selected={selected === "root"}
              isCurrent={currentParentId === null}
              onClick={() => setSelected("root")}
            />
          )}
          {filteredFolders.length === 0 && !filteredMyDrive ? (
            <li className="text-sm text-zinc-500 text-center py-6">No folders found</li>
          ) : (
            filteredFolders.map((f) => (
              <FolderRow
                key={f.id}
                name={f.name}
                selected={selected === f.id}
                isCurrent={f.id === currentParentId}
                onClick={() => setSelected(f.id)}
              />
            ))
          )}
        </ul>
      )}
    </Modal>
  );
}

function FolderRow({
  name, selected, isCurrent, onClick,
}: {
  name: string;
  selected: boolean;
  isCurrent: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        disabled={isCurrent}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
          isCurrent
            ? "text-zinc-400 cursor-not-allowed"
            : selected
              ? "bg-blue-50 text-blue-700"
              : "text-zinc-700 hover:bg-zinc-50"
        }`}
      >
        <FolderIcon className="w-4 h-4 text-zinc-400 shrink-0" />
        <span className="flex-1 truncate">{name}</span>
        {isCurrent && <span className="text-[10px] uppercase tracking-wider text-zinc-400">Current</span>}
        {selected && !isCurrent && <Check className="w-4 h-4 text-blue-600" />}
      </button>
    </li>
  );
}