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
  attachmentUrl?: string;
  createdAt?: string;
};

const DeveloperPanel: React.FC = () => {
  const { user } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await (adminAPI as any).listIssues();
      setIssues(res.data || []);
    } catch (err) {
      console.error(err);
      alert('Failed to load issues');
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
      {loading && <div>Loading...</div>}
      <div className="space-y-4">
        {issues.map((issue) => (
          <div key={issue.id} className="border rounded p-3 bg-white">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm text-slate-500">{issue.location} • {issue.createdAt ? new Date(issue.createdAt).toLocaleString() : ''}</div>
                <div className="font-medium">{issue.description}</div>
                <div className="text-xs text-slate-600">Reported by {issue.reporterRole} {issue.reporterId ? `(${issue.reporterId})` : ''}</div>
                {issue.attachmentUrl && (
                  <div className="mt-2">
                    <a href={issue.attachmentUrl} target="_blank" rel="noreferrer" className="text-primary-600 underline">View attachment</a>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-2">
                <select className="input-field" value={issue.status || 'open'} onChange={(e) => updateStatus(issue, e.target.value)}>
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
