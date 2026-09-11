"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  format,
} from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  LoaderCircle,
  Minus,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { CalendarShell } from "@/components/calendar-shell";
import { JobEditor } from "@/components/job-editor";
import {
  JOB_STATUS_LABELS,
  JOB_STATUSES,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUSES,
  type CalendarView,
  type Job,
  type JobScope,
  type JobStatus,
  type PaymentStatus,
} from "@/lib/types";

function displayDateRange(date: Date, view: CalendarView) {
  if (view === "day") return format(date, "MMMM d, yyyy");
  if (view === "week") {
    const weekStart = addDays(date, -date.getDay());
    const weekEnd = addDays(weekStart, 6);
    return `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;
  }
  return format(date, "MMMM yyyy");
}

export function JobScheduler() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [scope, setScope] = useState<JobScope>("active");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [newJobDate, setNewJobDate] = useState<Date | null>(null);

  const loadJobs = useCallback(async (silent = false) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    setLoadError("");

    try {
      const response = await fetch("/api/jobs", { cache: "no-store" });
      const data = (await response.json()) as { jobs?: Job[]; error?: string };
      if (!response.ok || !data.jobs) throw new Error(data.error ?? "Could not load jobs.");
      setJobs(data.jobs);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not connect to the shared job board.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadJobs(), 0);
    const syncTimer = window.setInterval(() => void loadJobs(true), 30_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(syncTimer);
    };
  }, [loadJobs]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const visibleJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return jobs
      .filter((job) => (scope === "archive" ? job.jobStatus === "completed" : job.jobStatus !== "completed"))
      .filter((job) => statusFilter === "all" || job.jobStatus === statusFilter)
      .filter((job) => paymentFilter === "all" || job.paymentStatus === paymentFilter)
      .filter((job) => {
        if (!normalizedQuery) return true;
        return [job.name, job.contact, job.address, job.quoteDetails]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  }, [jobs, paymentFilter, query, scope, statusFilter]);

  const hasFilters = Boolean(query || statusFilter !== "all" || paymentFilter !== "all");
  const displayJobs = visibleJobs.filter((job) => {
    if (scope === "archive" || view === "agenda") return true;
    if (view === "month") return job.date.startsWith(format(currentDate, "yyyy-MM"));
    if (view === "day") return job.date === format(currentDate, "yyyy-MM-dd");
    const start = addDays(currentDate, -currentDate.getDay());
    return job.date >= format(start, "yyyy-MM-dd") && job.date <= format(addDays(start, 6), "yyyy-MM-dd");
  });

  function changeDate(direction: number) {
    if (view === "day") setCurrentDate((date) => addDays(date, direction));
    else if (view === "week") setCurrentDate((date) => addWeeks(date, direction));
    else setCurrentDate((date) => addMonths(date, direction));
  }

  function changeZoom(direction: number) {
    const zoomViews: CalendarView[] = ["month", "week", "day"];
    const currentIndex = zoomViews.indexOf(view === "agenda" ? "month" : view);
    const nextIndex = Math.max(0, Math.min(zoomViews.length - 1, currentIndex + direction));
    setView(zoomViews[nextIndex]);
  }

  function openNewJob(date?: Date) {
    setEditingJob(null);
    setNewJobDate(date ?? currentDate);
    setEditorOpen(true);
  }

  function openJob(job: Job) {
    setEditingJob(job);
    setNewJobDate(null);
    setEditorOpen(true);
  }

  function handleSaved(savedJob: Job) {
    setJobs((current) => {
      const exists = current.some((job) => job.id === savedJob.id);
      return exists ? current.map((job) => (job.id === savedJob.id ? savedJob : job)) : [savedJob, ...current];
    });
    setEditorOpen(false);
    setEditingJob(null);
    setNotice(savedJob.jobStatus === "completed" ? "Job moved to the archive." : "Job saved.");
  }

  function handleDeleted(jobId: string) {
    setJobs((current) => current.filter((job) => job.id !== jobId));
    setEditorOpen(false);
    setEditingJob(null);
    setNotice("Job deleted.");
  }

  async function rescheduleJob(jobId: string, date: Date) {
    const newDate = format(date, "yyyy-MM-dd");
    const job = jobs.find((item) => item.id === jobId);
    if (!job || job.date === newDate) return;

    setJobs((current) => current.map((item) => item.id === jobId ? { ...item, date: newDate } : item));
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate }),
      });
      const data = (await response.json()) as { job?: Job; error?: string };
      if (!response.ok || !data.job) throw new Error(data.error ?? "Could not reschedule the job.");
      setJobs((current) => current.map((item) => item.id === jobId ? data.job! : item));
      setNotice("Job rescheduled.");
    } catch (error) {
      setJobs((current) => current.map((item) => item.id === jobId ? job : item));
      setNotice(error instanceof Error ? error.message : "Could not reschedule the job.");
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace-card compact-workspace" aria-label="Job scheduler">
        <div className="compact-topbar">
          <nav className="compact-tabs" aria-label="Job scope">
            {(["active", "archive"] as JobScope[]).map((option) => (
              <button key={option} type="button" aria-pressed={scope === option} className={scope === option ? "selected" : ""} onClick={() => { setScope(option); setStatusFilter("all"); }}>
                {option === "active" ? "Active" : "Archive"}
              </button>
            ))}
          </nav>
          <div className="compact-actions">
            <button type="button" className="bare-icon" aria-label="Search jobs" aria-expanded={searchOpen} aria-controls="job-search" onClick={() => setSearchOpen(!searchOpen)}><Search size={23} />{query && <i />}</button>
            <button type="button" className="bare-icon" aria-label="Filter jobs" aria-expanded={filtersOpen} aria-controls="job-filters" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={23} />{hasFilters && <i />}</button>
          </div>
        </div>
        {searchOpen && <div id="job-search" className="compact-search"><label className="search-field"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jobs, places, or notes" aria-label="Search jobs" /></label>{query && <button className="quiet-button" onClick={() => setQuery("")}>Clear</button>}</div>}
        {filtersOpen && <div id="job-filters" className="compact-filters">
          <label className="field"><span>Job status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as JobStatus | "all")}><option value="all">All statuses</option>{JOB_STATUSES.filter(status => scope === "archive" ? status === "completed" : status !== "completed").map(status => <option key={status} value={status}>{JOB_STATUS_LABELS[status]}</option>)}</select></label>
          <label className="field"><span>Payment</span><select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value as PaymentStatus | "all")}><option value="all">All payments</option>{PAYMENT_STATUSES.map(status => <option key={status} value={status}>{PAYMENT_STATUS_LABELS[status]}</option>)}</select></label>
          {hasFilters && <button className="clear-filters" onClick={() => { setQuery(""); setStatusFilter("all"); setPaymentFilter("all"); }}>Clear filters</button>}
        </div>}
        <div className="compact-date-row">
          <div className="compact-title"><h1>{scope === "archive" ? "Completed jobs" : view === "agenda" ? "All scheduled jobs" : displayDateRange(currentDate, view)}</h1>{scope === "active" && view === "day" && <p>{format(currentDate, "EEEE")}</p>}</div>
          {scope === "active" && view !== "agenda" && <div className="compact-navigation">
            <button type="button" className="icon-button" onClick={() => changeDate(-1)} aria-label="Previous period"><ArrowLeft size={18} /></button>
            <button type="button" className="today-button" onClick={() => setCurrentDate(new Date())}>Today</button>
            <button type="button" className="icon-button" onClick={() => changeDate(1)} aria-label="Next period"><ArrowRight size={18} /></button>
          </div>}
        </div>
        {scope === "active" && <div className="compact-viewbar">
          <label className="view-select"><CalendarDays size={19} /><select aria-label="Calendar view" value={view} onChange={(event) => setView(event.target.value as CalendarView)}>{(["month", "week", "day", "agenda"] as CalendarView[]).map(option => <option key={option} value={option}>{option[0].toUpperCase() + option.slice(1)}</option>)}</select><ChevronDown size={16} /></label>
          <div className="compact-actions">
            {displayJobs.length > 0 && <button className="primary-button" onClick={() => openNewJob()}><Plus size={17} /> Add job</button>}
            <div className="zoom-pair"><button type="button" onClick={() => changeZoom(-1)} disabled={view === "month" || view === "agenda"} aria-label="Zoom out"><Minus size={19} /></button><button type="button" onClick={() => changeZoom(1)} disabled={view === "day" || view === "agenda"} aria-label="Zoom in"><Plus size={19} /></button></div>
          </div>
        </div>}
        {isLoading ? <div className="compact-empty" role="status"><LoaderCircle className="spin" size={24} /><p>Loading jobs…</p></div> : displayJobs.length === 0 ? <div className="compact-empty">
          <CalendarDays size={36} strokeWidth={1.6} />
          <p>{hasFilters ? "No matching jobs" : scope === "archive" ? "No completed jobs" : "No jobs scheduled"}</p>
          {hasFilters ? <button className="quiet-button" onClick={() => { setQuery(""); setStatusFilter("all"); setPaymentFilter("all"); }}>Clear filters</button> : scope === "active" && <button className="primary-button" onClick={() => openNewJob()}><Plus size={20} /> Add job</button>}
        </div> : <CalendarShell jobs={visibleJobs} currentDate={currentDate} view={scope === "archive" ? "agenda" : view} onSelectJob={openJob} onSelectDate={openNewJob} onReschedule={(jobId, date) => void rescheduleJob(jobId, date)} />}
      </section>
      <footer className="storage-status" role="status">
        {loadError ? <><span className="status-dot offline" />Storage not connected<button onClick={() => void loadJobs(true)} disabled={isRefreshing}>{isRefreshing ? "Retrying…" : "Retry"}</button></> : (isLoading || isRefreshing) ? <><LoaderCircle size={12} className="spin" />Syncing…</> : <><span className="status-dot" />Up to date</>}
      </footer>

      {notice && <div className="toast" role="status"><Check size={16} /> {notice}</div>}

      <JobEditor key={`${editingJob?.id ?? "new"}-${newJobDate?.toISOString() ?? ""}`} open={editorOpen} job={editingJob} initialDate={newJobDate} onClose={() => { setEditorOpen(false); setEditingJob(null); }} onSaved={handleSaved} onDeleted={handleDeleted} />
    </main>
  );
}
