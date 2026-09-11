export const JOB_STATUSES = [
  "quoted",
  "awaiting_approval",
  "approved",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export const PAYMENT_STATUSES = [
  "not_invoiced",
  "invoiced",
  "awaiting_payment",
  "paid",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type CalendarView = "month" | "week" | "day" | "agenda";
export type JobScope = "active" | "archive";

export type Attachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
};

export type Job = {
  id: string;
  name: string;
  contact: string;
  address: string;
  date: string;
  startTime: string;
  durationMinutes: number | null;
  quoteDetails: string;
  jobStatus: JobStatus;
  paymentStatus: PaymentStatus;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
};

export type JobDraft = Omit<Job, "id" | "attachments" | "createdAt" | "updatedAt">;

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  quoted: "Quoted",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  not_invoiced: "Not invoiced",
  invoiced: "Invoiced",
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
};

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  quoted: "#7a68ee",
  awaiting_approval: "#c77b18",
  approved: "#2b7a62",
  in_progress: "#2f6fb1",
  completed: "#6d7782",
  cancelled: "#b24d5d",
};

export function isJobStatus(value: string): value is JobStatus {
  return JOB_STATUSES.includes(value as JobStatus);
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return PAYMENT_STATUSES.includes(value as PaymentStatus);
}

export function parseAttachments(value: unknown): Attachment[] {
  if (Array.isArray(value)) return value as Attachment[];

  if (typeof value !== "string" || !value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as Attachment[]) : [];
  } catch {
    return [];
  }
}

export function documentToJob(document: Record<string, unknown>): Job {
  const jobStatus = String(document.jobStatus ?? "quoted");
  const paymentStatus = String(document.paymentStatus ?? "not_invoiced");

  return {
    id: String(document.$id ?? document.id),
    name: String(document.name ?? "Untitled job"),
    contact: String(document.contact ?? ""),
    address: String(document.address ?? ""),
    date: String(document.date ?? ""),
    startTime: String(document.startTime ?? ""),
    durationMinutes:
      Number(document.durationMinutes ?? 0) > 0 ? Number(document.durationMinutes) : null,
    quoteDetails: String(document.quoteDetails ?? ""),
    jobStatus: isJobStatus(jobStatus) ? jobStatus : "quoted",
    paymentStatus: isPaymentStatus(paymentStatus) ? paymentStatus : "not_invoiced",
    attachments: parseAttachments(document.attachments),
    createdAt: String(document.createdAt ?? document.$createdAt ?? ""),
    updatedAt: String(document.updatedAt ?? document.$updatedAt ?? ""),
  };
}
