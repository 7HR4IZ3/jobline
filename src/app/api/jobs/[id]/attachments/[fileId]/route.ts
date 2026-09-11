import { NextResponse } from "next/server";

import {
  appwriteConfig,
  getAppwriteServices,
} from "@/lib/appwrite-server";
import { documentToJob, parseAttachments } from "@/lib/types";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const { id, fileId } = await params;
    const { databases, storage } = getAppwriteServices();
    const document = await databases.getDocument({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.collectionId,
      documentId: id,
    });
    const attachments = parseAttachments(document.attachments);
    const nextAttachments = attachments.filter((attachment) => attachment.id !== fileId);

    if (nextAttachments.length === attachments.length) {
      return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
    }

    await storage.deleteFile({ bucketId: appwriteConfig.bucketId, fileId });
    const updated = await databases.updateDocument({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.collectionId,
      documentId: id,
      data: {
        attachments: JSON.stringify(nextAttachments),
        updatedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ job: documentToJob(updated as unknown as Record<string, unknown>) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove attachment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
