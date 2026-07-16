import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../utils/api-service';
import { Button } from '../components/common';

const LOCATIONS = ['Dashboard', 'Leads', 'Follow-ups', 'Agent Panel', 'Quote & Invoice', 'Payments', 'Other'];
const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Resolved', value: 'resolved' },
];

type Issue = {
  id: string;
  location?: string;
  description?: string;
  status?: string;
  reporterRole?: string;
  reporterName?: string;
  reporterEmail?: string;
  attachmentUrl?: string;
  createdAt?: string;
  reporter_role?: string;
  reporter_name?: string;
  reporter_email?: string;
  attachment_url?: string;
  created_at?: string;
};

const ReportIssuePage: React.FC = () => {
  const { user } = useAuth();
  const [location, setLocation] = useState<string>(LOCATIONS[0]);
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadIssues = async (status?: string) => {
    setLoadingIssues(true);
    setLoadingError(null);
    try {
      const res = await (adminAPI as any).listIssues(status);
      let issueList: Issue[] = [];
      if (Array.isArray(res)) {
        issueList = res;
      } else if (res?.data && Array.isArray(res.data)) {
        issueList = res.data;
      } else if (res?.data?.issues && Array.isArray(res.data.issues)) {
        issueList = res.data.issues;
      } else if (res?.issues && Array.isArray(res.issues)) {
        issueList = res.issues;
      }

      issueList = issueList.map((issue) => ({
        ...issue,
        reporterName: issue.reporterName || issue.reporter_name,
        reporterEmail: issue.reporterEmail || issue.reporter_email,
        reporterRole: issue.reporterRole || issue.reporter_role,
        attachmentUrl: issue.attachmentUrl || issue.attachment_url,
        createdAt: issue.createdAt || issue.created_at,
      }));

      setIssues(issueList);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error('Failed to load issues:', errMsg);
      setLoadingError(`Failed to load issues: ${errMsg}`);
    } finally {
      setLoadingIssues(false);
    }
  };

  useEffect(() => {
    void loadIssues();
  }, []);

  const filteredIssues = issues.filter((issue) => {
    if (statusFilter === 'pending') {
      return issue.status === 'open' || issue.status === 'in_progress' || !issue.status;
    }
    if (statusFilter === 'resolved') {
      return issue.status === 'fixed' || issue.status === 'closed';
    }
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      alert('Please describe the issue.');
      return;
    }
    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append('location', location);
      fd.append('description', description);
      fd.append('reporterRole', user?.role || 'agent');
      fd.append('reporterId', String(user?.id || ''));
      if (file) fd.append('attachment', file);

      await (adminAPI as any).createIssue(fd);
      alert('Issue reported — thank you.');
      setDescription('');
      setFile(null);
      void loadIssues(statusFilter === 'all' ? undefined : statusFilter);
    } catch (err) {
      console.error(err);
      alert('Failed to submit issue.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Report Bug / Error</h1>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <label className="block">
          <div className="text-sm font-medium mb-1">Where did you see the issue?</div>
          <select className="input-field" value={location} onChange={(e) => setLocation(e.target.value)}>
            {LOCATIONS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="text-sm font-medium mb-1">Describe the issue</div>
          <textarea className="input-field h-32" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <label className="block">
          <div className="text-sm font-medium mb-1">Attach screenshot (optional)</div>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>

        <div>
          <Button type="submit" loading={submitting}>Submit Report</Button>
        </div>
      </form>

      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Your Reported Issues</h2>
            <p className="text-sm text-slate-500">See pending and resolved issues you have filed.</p>
          </div>
          <div className="flex items-center gap-2">
            <select className="input-field" value={statusFilter} onChange={(e) => {
              const value = e.target.value;
              setStatusFilter(value);
              void loadIssues(value === 'all' ? undefined : value);
            }}>
              {STATUS_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>{filter.label}</option>
              ))}
            </select>
            <Button size="sm" onClick={() => void loadIssues(statusFilter === 'all' ? undefined : statusFilter)} loading={loadingIssues}>Refresh</Button>
          </div>
        </div>

        {loadingIssues && <div className="text-slate-600">Loading issues...</div>}
        {loadingError && <div className="text-red-600 mb-4">{loadingError}</div>}
        {!loadingIssues && !loadingError && filteredIssues.length === 0 && (
          <div className="text-slate-600">No issues found.</div>
        )}

        <div className="space-y-4">
          {filteredIssues.map((issue) => (
            <div key={issue.id} className="border rounded p-4 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm text-slate-500 mb-1">{issue.location} • {issue.createdAt ? new Date(issue.createdAt).toLocaleString() : 'Unknown date'}</div>
                  <div className="font-medium text-slate-900">{issue.description}</div>
                  <div className="text-sm text-slate-600 mt-2">
                    Reported by {issue.reporterName || 'you'}{issue.reporterEmail ? ` (${issue.reporterEmail})` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${issue.status === 'open' ? 'bg-yellow-100 text-yellow-800' : issue.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : issue.status === 'fixed' || issue.status === 'closed' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
                    {issue.status ? issue.status.replace('_', ' ') : 'pending'}
                  </span>
                </div>
              </div>
              {issue.attachmentUrl && (
                <div className="mt-3">
                  <a href={issue.attachmentUrl} target="_blank" rel="noreferrer" className="text-primary-600 underline text-sm">View attachment</a>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReportIssuePage;
