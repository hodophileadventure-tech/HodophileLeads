import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../utils/api-service';
import { Button } from '../components/common';

const LOCATIONS = ['Dashboard', 'Leads', 'Follow-ups', 'Agent Panel', 'Quote & Invoice', 'Payments', 'Other'];

const ReportIssuePage: React.FC = () => {
  const { user } = useAuth();
  const [location, setLocation] = useState<string>(LOCATIONS[0]);
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    </div>
  );
};

export default ReportIssuePage;
