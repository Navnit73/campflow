import mongoose from "mongoose";

/**
 * Export file storage in GridFS (bucket "export_files").
 *
 * Previously generated workbooks were stored base64-encoded inside the ExportJob document,
 * which inflates size ~33%, bloats the working set, and fails outright once a file exceeds
 * MongoDB's 16MB document limit (≈12MB of xlsx). GridFS chunks files into 255KB pieces.
 */
const BUCKET = "export_files";

function bucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database connection not ready");
  return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET });
}

export async function saveExportFile(
  buffer: Buffer,
  fileName: string,
  metadata: Record<string, unknown>
): Promise<mongoose.Types.ObjectId> {
  return new Promise((resolve, reject) => {
    const upload = bucket().openUploadStream(fileName, { metadata });
    upload.once("error", reject);
    upload.once("finish", () => resolve(upload.id as mongoose.Types.ObjectId));
    upload.end(buffer);
  });
}

export async function readExportFile(fileId: mongoose.Types.ObjectId): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const stream = bucket().openDownloadStream(fileId);
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

export async function deleteExportFile(fileId: mongoose.Types.ObjectId): Promise<void> {
  try {
    await bucket().delete(fileId);
  } catch (err: unknown) {
    // Already gone → nothing to do.
    if (!String((err as Error)?.message || "").includes("File not found")) throw err;
  }
}
