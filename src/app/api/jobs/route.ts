import { ID, Query } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { NextResponse } from "next/server";

import {
  appwriteConfig,
  getAppwriteServices,
} from "@/lib/appwrite-server";
import {
  documentToJob,
  isJobStatus,
  isPaymentStatus,
} from "@/lib/types";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_ATTACHMENTS = 12;

function errorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return NextResponse.json({ error: message }, { status });
}

async function uploadFiles(
  files: File[],
  storage: ReturnType<typeof getAppwriteServices>["storage"],
  uploadedIds: string[],
) {
  if (files.length > MAX_ATTACHMENTS) {
    throw new Error(`You can upload up to ${MAX_ATTACHMENTS} files per job.`);
  }

  const oversized = files.find((file) => file.size > MAX_FILE_SIZE);
  if (oversized) {
    throw new Error(`${oversized.name} is larger than 25 MB.`);
  }

  const uploaded: { id: string; name: string; mimeType: string; size: number }[] = [];

  for (const file of files) {
    const saved = await storage.createFile({
      bucketId: appwriteConfig.bucketId,
      fileId: ID.unique(),
      file: InputFile.fromBuffer(Buffer.from(await file.arrayBuffer()), file.name),
    });

    uploadedIds.push(saved.$id);

    uploaded.push({
      id: saved.$id,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
    });
  }

  return uploaded;
}

export async function GET() {
  try {
    const { databases } = getAppwriteServices();
    const documents: Record<string, unknown>[] = [];
    const pageSize = 100;
    let offset = 0;

    while (true) {
      const page = await databases.listDocuments({
        databaseId: appwriteConfig.databaseId,
        collectionId: appwriteConfig.collectionId,
        queries: [
          Query.orderAsc("date"),
          Query.orderAsc("startTime"),
          Query.limit(pageSize),
          Query.offset(offset),
        ],
        total: false,
      });

      documents.push(...(page.documents as unknown as Record<string, unknown>[]));
      if (page.documents.length < pageSize) break;
      offset += pageSize;
    }

    return NextResponse.json({ jobs: documents.map(documentToJob) });
  } catch (error) {
    return errorResponse(error, 503);
  }
}

export async function POST(request: Request) {
  const uploadedIds: string[] = [];

  try {
    const formData = await request.formData();
    const name = String(formData.get("name") ?? "").trim();
    const date = String(formData.get("date") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim();
    const quoteDetails = String(formData.get("quoteDetails") ?? "").trim();
    const contact = String(formData.get("contact") ?? "").trim();
    const startTime = String(formData.get("startTime") ?? "").trim();
    const durationValue = Number(formData.get("durationMinutes") ?? 0);
    const jobStatusValue = String(formData.get("jobStatus") ?? "quoted");
    const paymentStatusValue = String(formData.get("paymentStatus") ?? "not_invoiced");

    if (!name || !date) {
      return errorResponse(new Error("A job name and date are required."), 400);
    }

    const jobStatus = isJobStatus(jobStatusValue) ? jobStatusValue : "quoted";
    const paymentStatus = isPaymentStatus(paymentStatusValue)
      ? paymentStatusValue
      : "not_invoiced";
    const durationMinutes = Number.isFinite(durationValue) && durationValue > 0
      ? Math.min(Math.round(durationValue), 1440)
      : 0;
    const files = formData
      .getAll("attachments")
      .filter((value): value is File => value instanceof File && value.size > 0);
    if (files.length > MAX_ATTACHMENTS) {
      return errorResponse(new Error(`You can upload up to ${MAX_ATTACHMENTS} files per job.`), 400);
    }
    const oversized = files.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) {
      return errorResponse(new Error(`${oversized.name} is larger than 25 MB.`), 400);
    }

    const { databases, storage } = getAppwriteServices();
    const attachments = await uploadFiles(files, storage, uploadedIds);
    const now = new Date().toISOString();

    const document = await databases.createDocument({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.collectionId,
      documentId: ID.unique(),
      data: {
        name,
        contact,
        address,
        date,
        startTime,
        durationMinutes,
        quoteDetails,
        jobStatus,
        paymentStatus,
        attachments: JSON.stringify(attachments),
        createdAt: now,
        updatedAt: now,
      },
    });

    return NextResponse.json({ job: documentToJob(document as unknown as Record<string, unknown>) }, { status: 201 });
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
