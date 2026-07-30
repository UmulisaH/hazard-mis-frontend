'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { RouteShell } from '@/components/layout/route-shell';
import { useHazardWorkflow } from '@/components/hazards/hazard-workflow-provider';
import { useAuth } from '@/lib/auth/auth-context';
import type { AppRole } from '@/lib/auth/types';
import type { HazardReportRecord } from '@/lib/hazards/types';

const ROLE_SUMMARIES: Record<
  AppRole,
  {
    title: string;
    description: string;
  }
> = {
  Reporter: {
    title: 'Reporter command view',
    description:
      'Capture hazards quickly, watch their status progress, and keep the safety team informed.',
  },
  'Safety Officer': {
    title: 'Safety operations view',
    description:
      'Prioritize assignments, investigations, corrective actions, and closure with one glance.',
  },
  Admin: {
    title: 'Administration view',
    description:
      'Monitor the entire risk surface, keep reference data clean, and oversee account access.',
  },
};

const BAR_COLORS = ['#111827', '#2563eb', '#0f766e', '#b45309', '#7c3aed'];
const PIE_COLORS = ['#0f172a', '#0f766e', '#2563eb', '#f59e0b'];

function severityScore(severity: HazardReportRecord['severityLevel']) {
  switch (severity) {
    case 'Low':
      return 1;
    case 'Medium':
      return 2;
    case 'High':
      return 3;
    case 'Critical':
      return 4;
    default:
      return 0;
  }
}

function formatMonthLabel(value: string) {
  const date = new Date(`${value}-01T00:00:00.000Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

export default function DashboardPage() {
  const { role, currentUser } = useAuth();
  const { reports } = useHazardWorkflow();
  const summary = role ? ROLE_SUMMARIES[role] : null;

  const metrics = useMemo(() => {
    const total = reports.length;
    const open = reports.filter((report) => report.status !== 'Closed').length;
    const closed = reports.filter(
      (report) => report.status === 'Closed',
    ).length;
    const critical = reports.filter(
      (report) => report.severityLevel === 'Critical',
    ).length;
    const averageSeverity =
      total > 0
        ? (
            reports.reduce(
              (sum, report) => sum + severityScore(report.severityLevel),
              0,
            ) / total
          ).toFixed(1)
        : '0.0';

    return [
      {
        label: 'Total reports',
        value: String(total),
        hint: 'Tracked in client-side workflow state',
      },
      {
        label: 'Open reports',
        value: String(open),
        hint: 'Awaiting investigation or closure',
      },
      {
        label: 'Closed reports',
        value: String(closed),
        hint: 'Completed lifecycle cases',
      },
      {
        label: 'Critical risk',
        value: String(critical),
        hint: `Average severity ${averageSeverity}/4`,
      },
    ];
  }, [reports]);

  const categoryData = useMemo(() => {
    const counts = new Map<string, number>();

    for (const report of reports) {
      counts.set(
        report.hazardCategory,
        (counts.get(report.hazardCategory) ?? 0) + 1,
      );
    }

    return Array.from(counts.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }, [reports]);

  const monthlyData = useMemo(() => {
    const counts = new Map<string, number>();

    for (const report of reports) {
      const month = report.createdAt.slice(0, 7);
      counts.set(month, (counts.get(month) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({
        month: formatMonthLabel(month),
        reports: count,
      }));
  }, [reports]);

  const severityData = useMemo(
    () => [
      {
        name: 'Low',
        value: reports.filter((report) => report.severityLevel === 'Low')
          .length,
      },
      {
        name: 'Medium',
        value: reports.filter((report) => report.severityLevel === 'Medium')
          .length,
      },
      {
        name: 'High',
        value: reports.filter((report) => report.severityLevel === 'High')
          .length,
      },
      {
        name: 'Critical',
        value: reports.filter((report) => report.severityLevel === 'Critical')
          .length,
      },
    ],
    [reports],
  );

  const recentReports = useMemo(
    () =>
      [...reports]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 3),
    [reports],
  );
  return (
    <RouteShell
      eyebrow="Dashboard"
      title={summary?.title ?? 'Unified safety dashboard'}
      description={
        summary?.description ??
        'The active session determines which set of actions and signals appears here.'
      }
    >
      <section
        className="overflow-hidden rounded-[2rem] border border-slate-900/10 bg-slate-950 text-white shadow-[0_28px_90px_rgba(15,23,42,0.24)]"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(15,23,42,0.2), rgba(15,23,42,0.78)), url('/auth-workspace.svg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="grid gap-6 px-6 py-8 md:grid-cols-[1.25fr_0.75fr] md:px-8 md:py-10">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-200">
              Operational overview
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              A single view for hazard pressure, progress, and closure.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              {currentUser ? currentUser.email : 'No profile loaded'} is signed
              in. Use this workspace to track the current safety state without
              switching between screens.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/hazards/new"
                className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                <p className="text-sm font-semibold text-slate-950">
                  Report a hazard
                </p>
              </Link>
              <Link
                href="/hazards"
                className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Review workflow
              </Link>
            </div>
          </div>

          <div className="grid gap-3 self-end">
            <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                Role
              </p>
              <p className="mt-2 text-sm font-medium text-white">
                {role ?? 'Workspace'}
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                Active user
              </p>
              <p className="mt-2 break-words text-sm font-medium text-white">
                {currentUser ? currentUser.email : 'No profile loaded'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-3xl border border-black/10 bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]"
          >
            <p className="text-sm font-medium text-slate-500">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {metric.value}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {metric.hint}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-3xl border border-black/10 bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                Hazards by category
              </p>
              <h3 className="mt-2 text-lg font-semibold text-slate-950">
                Category pressure by report volume
              </h3>
            </div>
          </div>

          <div className="mt-5 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#475569', fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#475569', fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
                  contentStyle={{
                    borderRadius: '1rem',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 20px 60px rgba(15, 23, 42, 0.12)',
                  }}
                />
                <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                  {categoryData.map((entry, index) => (
                    <Cell
                      key={`${entry.name}-${index}`}
                      fill={BAR_COLORS[index % BAR_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Severity mix
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">
              Distribution across urgency levels
            </h3>
          </div>

          <div className="mt-5 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={108}
                  paddingAngle={4}
                >
                  {severityData.map((entry, index) => (
                    <Cell
                      key={`${entry.name}-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: '1rem',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 20px 60px rgba(15, 23, 42, 0.12)',
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-black/10 bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Reports over time
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">
              Monthly submission trend
            </h3>
          </div>

          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#475569', fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#475569', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '1rem',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 20px 60px rgba(15, 23, 42, 0.12)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="reports"
                  stroke="#111827"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#111827' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                Recent activity
              </p>
              <h3 className="mt-2 text-lg font-semibold text-slate-950">
                Latest hazard cards
              </h3>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {recentReports.map((report) => (
              <article
                key={report.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                      {report.status}
                    </p>
                    <h4 className="mt-1 text-sm font-semibold text-slate-950">
                      {report.title}
                    </h4>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {report.severityLevel}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {report.summary}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </RouteShell>
  );
}
