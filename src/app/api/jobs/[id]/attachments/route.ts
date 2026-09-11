import { ID } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { NextResponse } from "next/server";

import {
  appwriteConfig,
  getAppwriteServices,
} from "@/lib/appwrite-server";
import { documentToJob, parseAttachments } from "@/lib/types";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_ATTACHMENTS = 12;

function errorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const uploadedIds: string[] = [];

  try {
    const { id } = await params;
    const formData = await request.formData();
    const files = formData
      .getAll("attachments")
      .filter((value): value is File => value instanceof File && value.size > 0);
    const oversized = files.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) {
      return errorResponse(new Error(`${oversized.name} is larger than 25 MB.`), 400);
    }

    const { databases, storage } = getAppwriteServices();
    const document = await databases.getDocument({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.collectionId,
      documentId: id,
    });
    const current = parseAttachments(document.attachments);

    if (current.length + files.length > MAX_ATTACHMENTS) {
      return errorResponse(new Error(`You can upload up to ${MAX_ATTACHMENTS} files per job.`), 400);
    }

    const added = [];
    for (const file of files) {
      const saved = await storage.createFile({
        bucketId: appwriteConfig.bucketId,
        fileId: ID.unique(),
        file: InputFile.fromBuffer(Buffer.from(await file.arrayBuffer()), file.name),
      });
      uploadedIds.push(saved.$id);
      added.push({
        id: saved.$id,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      });
    }

    const updated = await databases.updateDocument({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.collectionId,
      documentId: id,
      data: {
        attachments: JSON.stringify([...current, ...added]),
        updatedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ job: documentToJob(updated as unknown as Record<string, unknown>) });
  } catch (error) {
    if (uploadedIds.length > 0) {
      try {
        const { storage } = getAppwriteServices();
        await Promise.all(
          uploadedIds.map((fileId) =>
            storage.deleteFile({ bucketId: appwriteConfig.bucketId, fileId }),
          ),
        );
      } catch {
        // Keep the original error as the useful response.
      }
    }

    return errorResponse(error, 500);
  }
}
