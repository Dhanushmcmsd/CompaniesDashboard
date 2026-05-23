import type { Prisma } from "@prisma/client";

export type UploadParseMeta = {
  matchedColumns?: string[];
  missingColumns?: string[];
  missingRequired?: string[];
  warnings?: string[];
  confidence?: string;
  detectedVia?: string;
};

export type UploadErrorsPayload = {
  messages: string[];
  parseMeta?: UploadParseMeta;
};

export function buildUploadErrors(
  messages: string[],
  parseMeta?: UploadParseMeta,
): Prisma.InputJsonValue {
  if (!parseMeta || (!parseMeta.matchedColumns?.length && !parseMeta.missingColumns?.length && !parseMeta.missingRequired?.length && !parseMeta.warnings?.length)) {
    return messages;
  }
  return { messages, parseMeta };
}

export function parseUploadErrors(errors: unknown): UploadErrorsPayload {
  if (!errors) return { messages: [] };
  if (Array.isArray(errors)) {
    return { messages: errors.map(String) };
  }
  if (typeof errors === "object" && errors !== null && "messages" in errors) {
    const o = errors as UploadErrorsPayload;
    return {
      messages: Array.isArray(o.messages) ? o.messages.map(String) : [],
      parseMeta: o.parseMeta,
    };
  }
  return { messages: [String(errors)] };
}

export function getParseMetaFromBatch(batch: {
  parseMeta?: unknown;
  errors?: unknown;
}): UploadParseMeta | null {
  if (batch.parseMeta && typeof batch.parseMeta === "object") {
    return batch.parseMeta as UploadParseMeta;
  }
  return parseUploadErrors(batch.errors).parseMeta ?? null;
}
