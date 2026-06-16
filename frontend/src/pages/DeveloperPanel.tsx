import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../utils/api-service';
import { Button } from '../components/common';

type Issue = {
  id: string;
  location?: string;
  description?: string;
  status?: string;
  reporterRole?: string;
  reporterId?: string;
  reporterName?: string;
  reporterEmail?: string;
  attachmentUrl?: string;
  createdAt?: string;
};

const DeveloperPanel: React.FC = () => {
  const { user } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching issues...');
      const res = await (adminAPI as any).listIssues();
      console.log('Issues response:', res);
      
      // Handle different response structures
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
      
      // Normalize API fields to camelCase for rendering
      issueList = issueList.map((issue) => ({
        ...issue,
        reporterName: issue.reporterName || issue.reporter_name,
        reporterEmail: issue.reporterEmail || issue.reporter_email,
        reporterRole: issue.reporterRole || issue.reporter_role,
        reporterId: issue.reporterId || issue.reporter_id,
        attachmentUrl: issue.attachmentUrl || issue.attachment_url,
        createdAt: issue.createdAt || issue.created_at,
      }));

      setIssues(issueList);
      console.log('Loaded issues:', issueList);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error('Failed to load issues:', errMsg);
      setError(`Failed to load issues: ${errMsg}`);
      setIssues([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const updateStatus = async (issue: Issue, status: string) => {
    try {
      await (adminAPI as any).updateIssue(issue.id, { status });
      setIssues((prev) => prev.map((i) => (i.id === issue.id ? { ...i, status } : i)));
    } catch (err) {
      console.error(err);
      alert('Failed to update status');
    }
  };

  if (user?.role !== 'admin') {
    return <div>You do not have access to the Developer Panel.</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Developer Panel (Issues)</h1>
      {loading && <div className="text-slate-600">Loading issues...</div>}
      {error && <div className="text-red-600 mb-4">{error}</div>}
      {!loading && issues.length === 0 && !error && <div className="text-slate-600">No issues reported yet.</div>}
      <div className="space-y-4">
        {Array.isArray(issues) && issues.map((issue) => (
          <div key={issue.id} className="border rounded p-3 bg-white">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="text-sm text-slate-500">{issue.location} • {issue.createdAt ? new Date(issue.createdAt).toLocaleString() : ''}</div>
                <div className="font-medium mt-2">{issue.description}</div>
                <div className="text-sm text-slate-700 mt-2">
                  <strong>Reported by:</strong> {issue.reporterName || 'Unknown'} 
                  {issue.reporterEmail && <span className="text-slate-600"> ({issue.reporterEmail})</span>}
                  {issue.reporterRole && <span className="ml-2 px-2 py-1 bg-slate-200 rounded text-xs font-medium">{issue.reporterRole.toUpperCase()}</span>}
                </div>
                {issue.attachmentUrl && (
                  <div className="mt-2">
                    <a href={issue.attachmentUrl} target="_blank" rel="noreferrer" className="text-primary-600 underline text-sm">📎 View attachment</a>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-2 ml-4">
                <select className="input-field text-sm" value={issue.status || 'open'} onChange={(e) => updateStatus(issue, e.target.value)}>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="fixed">Fixed</option>
                  <option value="closed">Closed</option>
                </select>
                <Button size="sm" onClick={() => { void load(); }}>Refresh</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DeveloperPanel;
