import { NextResponse } from "next/server";

import {
  appwriteConfig,
  getAppwriteServices,
} from "@/lib/appwrite-server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const { fileId } = await params;
    const { storage } = getAppwriteServices();
    const file = await storage.getFile({
      bucketId: appwriteConfig.bucketId,
      fileId,
    });
    const bytes = await storage.getFileView({
      bucketId: appwriteConfig.bucketId,
      fileId,
    });
    const wantsDownload = new URL(request.url).searchParams.get("download") === "1";

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `${wantsDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(file.name)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }
}
