"use client";

import {
  endOfMonth,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, Clock3, MapPin } from "lucide-react";

import {
  JOB_STATUS_COLORS,
  JOB_STATUS_LABELS,
  type CalendarView,
  type Job,
} from "@/lib/types";

type CalendarShellProps = {
  jobs: Job[];
  currentDate: Date;
  view: CalendarView;
  onSelectJob: (job: Job) => void;
  onSelectDate: (date: Date) => void;
  onReschedule: (jobId: string, date: Date) => void;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function safeDate(date: string) {
  return parseISO(`${date}T00:00:00`);
}

function jobTime(job: Job) {
  if (!job.startTime) return "Any time";

  const [hours, minutes] = job.startTime.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return job.startTime;

  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function durationLabel(minutes: number | null) {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}

function JobPill({ job, onSelect }: { job: Job; onSelect: () => void }) {
  const color = JOB_STATUS_COLORS[job.jobStatus];

  return (
    <button
      type="button"
      className="job-pill"
      draggable
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/job-id", job.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      title={`${job.name} — ${JOB_STATUS_LABELS[job.jobStatus]}`}
    >
      <span className="job-pill-marker" style={{ backgroundColor: color }} />
      <span className="job-pill-copy">
        <strong>{job.name}</strong>
        <small>
          {jobTime(job)}
          {job.durationMinutes ? ` · ${durationLabel(job.durationMinutes)}` : ""}
        </small>
      </span>
    </button>
  );
}

function MonthCell({
  day,
  jobs,
  currentDate,
  onSelectJob,
  onSelectDate,
  onReschedule,
}: {
  day: Date;
  jobs: Job[];
  currentDate: Date;
  onSelectJob: (job: Job) => void;
  onSelectDate: (date: Date) => void;
  onReschedule: (jobId: string, date: Date) => void;
}) {
  const dayJobs = jobs.filter((job) => isSameDay(safeDate(job.date), day));
  const today = isSameDay(day, new Date());

  function dropJob(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const jobId = event.dataTransfer.getData("text/job-id");
    if (jobId) onReschedule(jobId, day);
  }

  return (
    <div
      className={`month-cell ${isSameMonth(day, currentDate) ? "" : "is-outside"} ${today ? "is-today" : ""}`}
      onClick={() => onSelectDate(day)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={dropJob}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelectDate(day);
      }}
    >
      <div className="month-cell-header">
        <span className="day-number">{format(day, "d")}</span>
        {dayJobs.length > 0 && <span className="day-count">{dayJobs.length}</span>}
      </div>
      <div className="month-cell-jobs">
        {dayJobs.slice(0, 3).map((job) => (
          <JobPill key={job.id} job={job} onSelect={() => onSelectJob(job)} />
        ))}
        {dayJobs.length > 3 && (
          <span className="more-jobs">+ {dayJobs.length - 3} more</span>
        )}
      </div>
    </div>
  );
}

function MonthView({
  jobs,
  currentDate,
  onSelectJob,
  onSelectDate,
  onReschedule,
}: Omit<CalendarShellProps, "view">) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate)),
    end: endOfWeek(endOfMonth(currentDate)),
  });

  return (
    <div className="calendar-frame month-frame">
      <div className="weekday-row">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="weekday-label">
            {weekday}
          </div>
        ))}
      </div>
      <div className="month-grid">
        {days.map((day) => (
          <MonthCell
            key={day.toISOString()}
            day={day}
            jobs={jobs}
            currentDate={currentDate}
            onSelectJob={onSelectJob}
            onSelectDate={onSelectDate}
            onReschedule={onReschedule}
          />
        ))}
      </div>
    </div>
  );
}

function WeekView({
  jobs,
  currentDate,
  onSelectJob,
  onSelectDate,
  onReschedule,
}: Omit<CalendarShellProps, "view">) {
  const days = eachDayOfInterval({
    start: startOfWeek(currentDate),
    end: endOfWeek(currentDate),
  });

  return (
    <div className="calendar-frame week-frame">
      <div className="week-grid">
        {days.map((day) => {
          const dayJobs = jobs.filter((job) => isSameDay(safeDate(job.date), day));
          const today = isSameDay(day, new Date());

          return (
            <div
              key={day.toISOString()}
              className={`week-column ${today ? "is-today" : ""}`}
              onClick={() => onSelectDate(day)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const jobId = event.dataTransfer.getData("text/job-id");
                if (jobId) onReschedule(jobId, day);
              }}
            >
              <div className="week-column-header">
                <span>{format(day, "EEE")}</span>
                <strong>{format(day, "d")}</strong>
              </div>
              <div className="week-column-body">
                {dayJobs.length === 0 && (
                  <span className="empty-day-hint">Drop a job here</span>
                )}
                {dayJobs.map((job) => (
                  <JobPill key={job.id} job={job} onSelect={() => onSelectJob(job)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayView({
  jobs,
  currentDate,
  onSelectJob,
  onSelectDate,
  onReschedule,
}: Omit<CalendarShellProps, "view">) {
  const dayJobs = jobs
    .filter((job) => isSameDay(safeDate(job.date), currentDate))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div
      className="calendar-frame day-frame"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const jobId = event.dataTransfer.getData("text/job-id");
        if (jobId) onReschedule(jobId, currentDate);
      }}
    >
      <div className="day-view-heading">
        <div>
          <span>{format(currentDate, "EEEE")}</span>
          <strong>{format(currentDate, "MMMM d, yyyy")}</strong>
        </div>
        <button type="button" className="quiet-button" onClick={() => onSelectDate(currentDate)}>
          + Add job
        </button>
      </div>
      <div className="day-timeline">
        {dayJobs.length === 0 ? (
          <button type="button" className="empty-state-card" onClick={() => onSelectDate(currentDate)}>
            <CalendarDays size={18} />
            <span>No jobs scheduled for this day.</span>
            <small>Add one here</small>
          </button>
        ) : (
          dayJobs.map((job) => (
            <button
              type="button"
              key={job.id}
              className="timeline-job"
              onClick={() => onSelectJob(job)}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("text/job-id", job.id);
                event.dataTransfer.effectAllowed = "move";
              }}
            >
              <span className="timeline-time">{jobTime(job)}</span>
              <span className="timeline-rule" style={{ backgroundColor: JOB_STATUS_COLORS[job.jobStatus] }} />
              <span className="timeline-copy">
                <strong>{job.name}</strong>
                <span>{job.address || "No address added"}</span>
                {job.durationMinutes && <small>{durationLabel(job.durationMinutes)}</small>}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function AgendaView({ jobs, onSelectJob }: Pick<CalendarShellProps, "jobs" | "onSelectJob">) {
  const grouped = jobs.reduce<Record<string, Job[]>>((groups, job) => {
    groups[job.date] = groups[job.date] ? [...groups[job.date], job] : [job];
    return groups;
  }, {});
  const dates = Object.keys(grouped).sort();

  return (
    <div className="calendar-frame agenda-frame">
      {dates.length === 0 ? (
        <div className="agenda-empty">
          <CalendarDays size={20} />
          <span>No jobs match these filters.</span>
        </div>
      ) : (
        dates.map((date) => (
          <section key={date} className="agenda-group">
            <div className="agenda-date">
              <span>{format(safeDate(date), "EEE")}</span>
              <strong>{format(safeDate(date), "MMM d")}</strong>
            </div>
            <div className="agenda-jobs">
              {grouped[date]
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map((job) => (
                  <button type="button" key={job.id} className="agenda-job" onClick={() => onSelectJob(job)}>
                    <span className="agenda-job-line" style={{ backgroundColor: JOB_STATUS_COLORS[job.jobStatus] }} />
                    <span className="agenda-job-main">
                      <strong>{job.name}</strong>
                      <span>{job.address || "No address added"}</span>
                    </span>
                    <span className="agenda-job-meta">
                      <Clock3 size={14} />
                      {jobTime(job)}
                      {job.durationMinutes ? ` · ${durationLabel(job.durationMinutes)}` : ""}
                    </span>
                    {job.address && <MapPin size={15} className="agenda-location" />}
                  </button>
                ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

export function CalendarShell(props: CalendarShellProps) {
  if (props.view === "month") return <MonthView {...props} />;
  if (props.view === "week") return <WeekView {...props} />;
  if (props.view === "day") return <DayView {...props} />;
  return <AgendaView jobs={props.jobs} onSelectJob={props.onSelectJob} />;
}
