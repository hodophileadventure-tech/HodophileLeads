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
    <div className="space-y-6">
      {/* Premium Page Header */}
      <div className="premium-page-header">
        <p>🐛 Quality Assurance</p>
        <h1>Report Issue</h1>
        <p className="subtitle">Help us improve by reporting bugs and errors you encounter</p>
      </div>

      {/* Report Form Section */}
      <div className="premium-section">
        <h2>📝 Report New Issue</h2>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Where did you see the issue?</label>
            <select 
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white" 
              value={location} 
              onChange={(e) => setLocation(e.target.value)}
            >
              {LOCATIONS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Describe the issue</label>
            <textarea 
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white min-h-[120px] font-[500]" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide detailed description of the issue..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Attach screenshot (optional)</label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-amber-500 transition-colors">
              <input 
                type="file" 
                accept="image/*" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="cursor-pointer w-full"
              />
              <p className="text-xs text-slate-500 mt-2">{file ? `✓ ${file.name}` : 'PNG, JPG, GIF (max 5MB)'}</p>
            </div>
          </div>

          <Button type="submit" disabled={submitting} className="premium-action-button primary w-full justify-center">
            {submitting ? '⏳ Submitting...' : '✓ Submit Report'}
          </Button>
        </form>
      </div>

      {/* Issues List Section */}
      <div className="premium-section">
        <div className="flex items-center justify-between mb-4">
          <h2>📋 Your Reported Issues</h2>
          <div className="flex items-center gap-2">
            <select 
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium" 
              value={statusFilter} 
              onChange={(e) => {
                const value = e.target.value;
                setStatusFilter(value);
                void loadIssues(value === 'all' ? undefined : value);
              }}
            >
              {STATUS_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>{filter.label}</option>
              ))}
            </select>
            <button 
              type="button"
              onClick={() => void loadIssues(statusFilter === 'all' ? undefined : statusFilter)} 
              disabled={loadingIssues}
              className="premium-action-button"
            >
              {loadingIssues ? '⏳ Refreshing...' : '🔄 Refresh'}
            </button>
          </div>
        </div>

        {loadingIssues && <div className="premium-empty-state"><div>⏳ Loading issues...</div></div>}
        {loadingError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
            ⚠️ {loadingError}
          </div>
        )}
        {!loadingIssues && !loadingError && filteredIssues.length === 0 && (
          <div className="premium-empty-state">
            <div className="premium-empty-state-icon">📭</div>
            <h3>No issues found</h3>
            <p>Great! All reported issues have been resolved.</p>
          </div>
        )}

        <div className="space-y-3">
          {filteredIssues.map((issue) => (
            <div 
              key={issue.id} 
              className="border border-slate-200 rounded-lg p-4 bg-gradient-to-br from-white to-slate-50 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-slate-500">📍 {issue.location}</span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500">
                      {issue.createdAt ? new Date(issue.createdAt).toLocaleDateString() : 'Unknown date'}
                    </span>
                  </div>
                  <div className="font-medium text-slate-900 mb-2">{issue.description}</div>
                  <div className="text-xs text-slate-600">
                    👤 {issue.reporterName || 'Anonymous'}{issue.reporterEmail ? ` • ${issue.reporterEmail}` : ''}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <span className={`premium-badge ${
                    issue.status === 'open' || !issue.status ? 'warning' :
                    issue.status === 'in_progress' ? 'info' :
                    issue.status === 'fixed' || issue.status === 'closed' ? 'success' :
                    'info'
                  }`}>
                    {issue.status ? issue.status.replace('_', ' ').toUpperCase() : 'PENDING'}
                  </span>
                </div>
              </div>
              {issue.attachmentUrl && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <a 
                    href={issue.attachmentUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-amber-600 hover:text-amber-700 underline text-sm font-medium"
                  >
                    📎 View attachment
                  </a>
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
