import type {
  MessageAttachment,
  TelegramUpdateEnvelope,
} from "@superbot/domain";

export interface FilePolicy {
  readonly maxBytes: number;
  /** When non-empty, only these MIME types (or `kind` fallbacks) are allowed. */
  readonly allowedMimePrefixes: readonly string[];
}

export const defaultFilePolicy: FilePolicy = {
  maxBytes: 50 * 1024 * 1024,
  allowedMimePrefixes: [],
};

/** Extensions that are never accepted regardless of MIME, to limit obvious abuse. */
const dangerousExtensions: ReadonlySet<string> = new Set([
  "exe",
  "scr",
  "bat",
  "cmd",
  "com",
  "pif",
  "msi",
  "vbs",
  "js",
  "jar",
  "ps1",
  "sh",
]);

export type FileValidation =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "too-large" | "blocked-extension" | "mime-not-allowed";
    };

const extensionOf = (fileName: string | undefined): string | undefined => {
  if (!fileName) {
    return undefined;
  }
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : undefined;
};

/**
 * Static, pre-download validation of an attachment. A real antivirus engine runs
 * later in the worker; this gate rejects oversize files, dangerous extensions and
 * disallowed MIME types so they never reach storage.
 */
export const validateAttachment = (
  attachment: MessageAttachment,
  policy: FilePolicy = defaultFilePolicy,
): FileValidation => {
  if (
    attachment.fileSize !== undefined &&
    attachment.fileSize > policy.maxBytes
  ) {
    return { ok: false, reason: "too-large" };
  }

  const ext = extensionOf(attachment.fileName);
  if (ext && dangerousExtensions.has(ext)) {
    return { ok: false, reason: "blocked-extension" };
  }

  if (policy.allowedMimePrefixes.length > 0) {
    const mime = attachment.mimeType ?? "";
    const allowed = policy.allowedMimePrefixes.some((prefix) =>
      mime.startsWith(prefix),
    );
    if (!allowed) {
      return { ok: false, reason: "mime-not-allowed" };
    }
  }

  return { ok: true };
};

export type FilesCommand =
  | { readonly kind: "list" }
  | { readonly kind: "quota" };

export type FilesCommandResult = {
  readonly ok: true;
  readonly command: FilesCommand;
};

const filesCommandNames: ReadonlySet<string> = new Set(["files", "filequota"]);

export const parseFilesCommand = (
  update: TelegramUpdateEnvelope,
): FilesCommandResult | null => {
  const name = update.command?.name;

  if (!name || !filesCommandNames.has(name)) {
    return null;
  }

  return {
    ok: true,
    command: { kind: name === "filequota" ? "quota" : "list" },
  };
};
