import { NextResponse } from "next/server";

import {
  appwriteConfig,
  getAppwriteServices,
} from "@/lib/appwrite-server";
import {
  documentToJob,
  isJobStatus,
  isPaymentStatus,
  parseAttachments,
} from "@/lib/types";

export const runtime = "nodejs";

function errorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = (await request.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    if (typeof payload.name === "string") data.name = payload.name.trim();
    if (typeof payload.contact === "string") data.contact = payload.contact.trim();
    if (typeof payload.address === "string") data.address = payload.address.trim();
    if (typeof payload.date === "string") data.date = payload.date.trim();
    if (typeof payload.startTime === "string") data.startTime = payload.startTime.trim();
    if (typeof payload.quoteDetails === "string") data.quoteDetails = payload.quoteDetails.trim();
    if (typeof payload.durationMinutes === "number") {
      data.durationMinutes = payload.durationMinutes > 0
        ? Math.min(Math.round(payload.durationMinutes), 1440)
        : 0;
    }
    if (typeof payload.jobStatus === "string" && isJobStatus(payload.jobStatus)) {
      data.jobStatus = payload.jobStatus;
    }
    if (typeof payload.paymentStatus === "string" && isPaymentStatus(payload.paymentStatus)) {
      data.paymentStatus = payload.paymentStatus;
    }

    if (Object.keys(data).length === 0) {
      return errorResponse(new Error("No editable fields were provided."), 400);
    }

    data.updatedAt = new Date().toISOString();
    const { databases } = getAppwriteServices();
    const document = await databases.updateDocument({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.collectionId,
      documentId: id,
      data,
    });

    return NextResponse.json({ job: documentToJob(document as unknown as Record<string, unknown>) });
  } catch (error) {
    return errorResponse(error, 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { databases, storage } = getAppwriteServices();
    const document = await databases.getDocument({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.collectionId,
      documentId: id,
    });
    const attachments = parseAttachments(document.attachments);

    await Promise.all(
      attachments.map((attachment) =>
        storage.deleteFile({ bucketId: appwriteConfig.bucketId, fileId: attachment.id }),
      ),
    );
    await databases.deleteDocument({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.collectionId,
      documentId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, 500);
  }
}
