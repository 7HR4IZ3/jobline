"use client";

import { useState } from "react";
import { ExternalLink, FileText, Image as ImageIcon, LoaderCircle, MapPin, Paperclip, Trash2, Upload, X } from "lucide-react";
import { format } from "date-fns";

import {
  JOB_STATUS_LABELS,
  JOB_STATUSES,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUSES,
  type Attachment,
  type Job,
  type JobDraft,
  type JobStatus,
  type PaymentStatus,
} from "@/lib/types";

type JobEditorProps = {
  open: boolean;
  job: Job | null;
  initialDate: Date | null;
  onClose: () => void;
  onSaved: (job: Job) => void;
  onDeleted: (jobId: string) => void;
};

type FormState = Omit<JobDraft, "durationMinutes"> & { durationMinutes: string };

function initialForm(job: Job | null, initialDate: Date | null): FormState {
  return {
    name: job?.name ?? "",
    contact: job?.contact ?? "",
    address: job?.address ?? "",
    date: job?.date ?? format(initialDate ?? new Date(), "yyyy-MM-dd"),
    startTime: job?.startTime ?? "",
    durationMinutes: job?.durationMinutes ? String(job.durationMinutes) : "",
    quoteDetails: job?.quoteDetails ?? "",
    jobStatus: job?.jobStatus ?? "quoted",
    paymentStatus: job?.paymentStatus ?? "not_invoiced",
  };
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentIcon(mimeType: string) {
  return mimeType.startsWith("image/") ? <ImageIcon size={16} /> : <FileText size={16} />;
}

export function JobEditor({
  open,
  job,
  initialDate,
  onClose,
  onSaved,
  onDeleted,
}: JobEditorProps) {
  const [form, setForm] = useState<FormState>(() => initialForm(job, initialDate));
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>(job?.attachments ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemovingFile, setIsRemovingFile] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (!open) return null;

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    setNewFiles((current) => [...current, ...Array.from(files)].slice(0, 12));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    const values = {
      ...form,
      durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : 0,
    };

    try {
      let response: Response;

      if (job) {
        response = await fetch(`/api/jobs/${job.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
      } else {
        const formData = new FormData();
        Object.entries(values).forEach(([key, value]) => formData.append(key, String(value ?? "")));
        newFiles.forEach((file) => formData.append("attachments", file));
        response = await fetch("/api/jobs", { method: "POST", body: formData });
      }

      const data = (await response.json()) as { job?: Job; error?: string };
      if (!response.ok || !data.job) throw new Error(data.error ?? "Could not save the job.");

      let savedJob = data.job;
      if (job && newFiles.length > 0) {
        const attachments = new FormData();
        newFiles.forEach((file) => attachments.append("attachments", file));
        const uploadResponse = await fetch(`/api/jobs/${job.id}/attachments`, {
          method: "POST",
          body: attachments,
        });
        const uploadData = (await uploadResponse.json()) as { job?: Job; error?: string };
        if (!uploadResponse.ok || !uploadData.job) {
          throw new Error(uploadData.error ?? "The job saved, but the attachments did not upload.");
        }
        savedJob = uploadData.job;
      }

      onSaved(savedJob);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the job.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeAttachment(attachment: Attachment) {
    if (!job || isRemovingFile) return;
    setIsRemovingFile(attachment.id);
    setError("");

    try {
      const response = await fetch(`/api/jobs/${job.id}/attachments/${attachment.id}`, { method: "DELETE" });
      const data = (await response.json()) as { job?: Job; error?: string };
      if (!response.ok || !data.job) throw new Error(data.error ?? "Could not remove the attachment.");
      setExistingAttachments(data.job.attachments);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove the attachment.");
    } finally {
      setIsRemovingFile(null);
    }
  }

  async function deleteJob() {
    if (!job || !window.confirm("Delete this job and its attachments?")) return;
    setIsSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not delete the job.");
      onDeleted(job.id);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete the job.");
    } finally {
      setIsSaving(false);
    }
  }

  const mapUrl = form.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.address)}`
    : "";

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isSaving) onClose();
    }}>
      <aside className="job-drawer" role="dialog" aria-modal="true" aria-labelledby="job-editor-title">
        <div className="drawer-header">
          <div>
            <span className="eyebrow">{job ? "Edit job" : "New job"}</span>
            <h2 id="job-editor-title">{job ? job.name : "Add a job"}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close" disabled={isSaving}>
            <X size={18} />
          </button>
        </div>

        <form className="job-form" onSubmit={save}>
          <div className="form-section">
            <div className="form-section-heading">
              <span>Job details</span>
              <span className="required-note">Name and date required</span>
            </div>
            <label className="field field-full">
              <span>Job name</span>
              <input
                required
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="e.g. Adeola — bathroom repair"
                autoFocus={!job}
              />
            </label>
            <div className="field-grid">
              <label className="field">
                <span>Client / contact</span>
                <input
                  value={form.contact}
                  onChange={(event) => updateField("contact", event.target.value)}
                  placeholder="Phone or email"
                />
              </label>
              <label className="field">
                <span>Date</span>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(event) => updateField("date", event.target.value)}
                />
              </label>
            </div>
            <div className="field-grid">
              <label className="field">
                <span>Start time <small>optional</small></span>
                <input type="time" value={form.startTime} onChange={(event) => updateField("startTime", event.target.value)} />
              </label>
              <label className="field">
                <span>Duration <small>optional</small></span>
                <div className="input-with-suffix">
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={form.durationMinutes}
                    onChange={(event) => updateField("durationMinutes", event.target.value)}
                    placeholder="e.g. 90"
                  />
                  <span>min</span>
                </div>
              </label>
            </div>
            <label className="field field-full">
              <span>Address <small>optional</small></span>
              <div className="input-with-icon">
                <MapPin size={16} />
                <input value={form.address} onChange={(event) => updateField("address", event.target.value)} placeholder="Where is the job?" />
              </div>
              {mapUrl && <a className="inline-link" href={mapUrl} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open in Maps</a>}
            </label>
          </div>

          <div className="form-section">
            <div className="form-section-heading"><span>Progress</span></div>
            <div className="field-grid">
              <label className="field">
                <span>Job status</span>
                <select value={form.jobStatus} onChange={(event) => updateField("jobStatus", event.target.value as JobStatus)}>
                  {JOB_STATUSES.map((status) => <option key={status} value={status}>{JOB_STATUS_LABELS[status]}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Payment status</span>
                <select value={form.paymentStatus} onChange={(event) => updateField("paymentStatus", event.target.value as PaymentStatus)}>
                  {PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{PAYMENT_STATUS_LABELS[status]}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-heading"><span>Quote details</span><span className="required-note">Plain text</span></div>
            <label className="field field-full">
              <textarea
                rows={5}
                value={form.quoteDetails}
                onChange={(event) => updateField("quoteDetails", event.target.value)}
                placeholder="Describe the work, price, materials, or any notes the team should know."
              />
            </label>
          </div>

          <div className="form-section">
            <div className="form-section-heading"><span>Attachments</span><span className="required-note">Up to 12 files · 25 MB each</span></div>
            <label className="upload-zone">
              <input type="file" multiple onChange={(event) => addFiles(event.target.files)} />
              <Upload size={19} />
              <strong>Upload quote files</strong>
              <span>PDFs, images, documents, and spreadsheets</span>
            </label>

            {existingAttachments.length > 0 && (
              <div className="attachment-list">
                {existingAttachments.map((attachment) => (
                  <div className="attachment-row" key={attachment.id}>
                    <span className="attachment-icon">{attachmentIcon(attachment.mimeType)}</span>
                    <span className="attachment-copy"><strong>{attachment.name}</strong><small>{formatBytes(attachment.size)}</small></span>
                    <a className="attachment-action" href={`/api/files/${attachment.id}`} target="_blank" rel="noreferrer" aria-label={`Open ${attachment.name}`}><ExternalLink size={15} /></a>
                    <a className="attachment-action" href={`/api/files/${attachment.id}?download=1`} aria-label={`Download ${attachment.name}`}><FileText size={15} /></a>
                    <button type="button" className="attachment-action danger" onClick={() => removeAttachment(attachment)} disabled={isRemovingFile === attachment.id} aria-label={`Remove ${attachment.name}`}>
                      {isRemovingFile === attachment.id ? <LoaderCircle size={15} className="spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {newFiles.length > 0 && (
              <div className="new-file-list">
                <span className="new-file-heading"><Paperclip size={14} /> Waiting to upload</span>
                {newFiles.map((file, index) => (
                  <div className="new-file-row" key={`${file.name}-${file.lastModified}-${index}`}>
                    <span>{file.name}</span>
                    <small>{formatBytes(file.size)}</small>
                    <button type="button" onClick={() => setNewFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} aria-label={`Remove ${file.name}`}><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}

          <div className="drawer-footer">
            {job ? <button type="button" className="danger-button" onClick={deleteJob} disabled={isSaving}><Trash2 size={16} /> Delete</button> : <span />}
            <div className="footer-actions">
              <button type="button" className="secondary-button" onClick={onClose} disabled={isSaving}>Cancel</button>
              <button type="submit" className="primary-button" disabled={isSaving}>
                {isSaving ? <LoaderCircle size={16} className="spin" /> : null}
                {isSaving ? "Saving…" : job ? "Save changes" : "Create job"}
              </button>
            </div>
          </div>
        </form>
      </aside>
    </div>
  );
}
