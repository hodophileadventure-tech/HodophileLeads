import React, { useEffect, useState } from 'react';
import { gitAPI } from '../utils/api-service';
import { Button, Spinner } from './common';

interface Commit {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
}

const GitHistoryPanel: React.FC = () => {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [currentCommit, setCurrentCommit] = useState<Commit | null>(null);
  const [loading, setLoading] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [commitDetails, setCommitDetails] = useState('');
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadCommits();
    loadCurrentCommit();
  }, []);

  const loadCommits = async () => {
    setLoading(true);
    try {
      const response = await gitAPI.getCommitHistory();
      setCommits(response.data.commits || []);
      setError('');
    } catch (err: any) {
      console.error('Failed to load commits:', err);
      setError(err?.response?.data?.message || 'Failed to load commit history');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentCommit = async () => {
    try {
      const response = await gitAPI.getCurrentCommit();
      setCurrentCommit(response.data.commit);
    } catch (err: any) {
      console.error('Failed to load current commit:', err);
    }
  };

  const handleViewDetails = async (commit: Commit) => {
    setLoadingDetails(true);
    try {
      const response = await gitAPI.getCommitDetails(commit.hash);
      setCommitDetails(response.data.details);
      setSelectedCommit(commit);
    } catch (err: any) {
      console.error('Failed to load commit details:', err);
      setError('Failed to load commit details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleRevert = async () => {
    if (!selectedCommit) return;

    setReverting(true);
    setError('');
    setSuccess('');

    try {
      const response = await gitAPI.revertToCommit(selectedCommit.hash);
      setSuccess(`✓ Successfully reverted to commit ${selectedCommit.shortHash}`);
      setShowConfirmation(false);
      setSelectedCommit(null);
      setCommitDetails('');
      
      // Reload current commit
      loadCurrentCommit();
      
      // Clear success after 5 seconds
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      console.error('Failed to revert:', err);
      setError(err?.response?.data?.message || 'Failed to revert to commit');
    } finally {
      setReverting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Git History & Revert</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          View recent commits and revert to any previous version.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Commit List */}
        <div className="lg:col-span-2">
          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-lg mb-4">Commit History</h3>

            {currentCommit && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  Current: {currentCommit.shortHash} - {currentCommit.message}
                </p>
                <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                  {currentCommit.date} by {currentCommit.author}
                </p>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : commits.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 py-4">No commits found</p>
            ) : (
              <div className="space-y-0 border border-slate-300 dark:border-slate-600 rounded-lg max-h-96 overflow-y-auto">
                {commits.map((commit, index) => (
                  <div
                    key={commit.hash}
                    className={`p-3 border-b border-slate-300 dark:border-slate-600 last:border-b-0 cursor-pointer transition-colors ${
                      selectedCommit?.hash === commit.hash
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    } ${
                      currentCommit?.hash === commit.hash
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : ''
                    }`}
                    onClick={() => {
                      setSelectedCommit(commit);
                      handleViewDetails(commit);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
                          {commit.shortHash}
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                          {commit.message}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {commit.date} • {commit.author}
                        </p>
                      </div>
                      {currentCommit?.hash === commit.hash && (
                        <span className="ml-2 px-2 py-1 bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100 text-xs font-medium rounded">
                          Current
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Details Panel */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-lg mb-4">Commit Details</h3>

          {selectedCommit ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  Commit Hash
                </label>
                <p className="font-mono text-sm text-slate-900 dark:text-slate-100 mt-1">
                  {selectedCommit.hash}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  Message
                </label>
                <p className="text-sm text-slate-900 dark:text-slate-100 mt-1">
                  {selectedCommit.message}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  Author
                </label>
                <p className="text-sm text-slate-900 dark:text-slate-100 mt-1">
                  {selectedCommit.author}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  Date
                </label>
                <p className="text-sm text-slate-900 dark:text-slate-100 mt-1">
                  {selectedCommit.date}
                </p>
              </div>

              {loadingDetails ? (
                <div className="flex justify-center py-4">
                  <Spinner />
                </div>
              ) : commitDetails ? (
                <div className="mt-4">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                    Changes
                  </label>
                  <pre className="text-xs bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-600 mt-2 max-h-40 overflow-y-auto text-slate-700 dark:text-slate-300">
                    {commitDetails}
                  </pre>
                </div>
              ) : null}

              {selectedCommit.hash !== currentCommit?.hash && (
                <Button
                  onClick={() => setShowConfirmation(true)}
                  disabled={reverting}
                  variant="primary"
                  className="w-full mt-4"
                >
                  {reverting ? 'Reverting...' : '↩️ Revert to This Commit'}
                </Button>
              )}

              {selectedCommit.hash === currentCommit?.hash && (
                <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm text-green-700 dark:text-green-300 text-center">
                  ✓ This is the current commit
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-400 py-8 text-center">
              Select a commit to view details
            </p>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && selectedCommit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold">Revert to Commit?</h3>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-700 dark:text-red-300 font-medium mb-2">
                ⚠️ This will reset your code to this commit
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">
                All changes made after <strong>{selectedCommit.shortHash}</strong> will be lost.
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded text-sm space-y-2">
              <p>
                <span className="font-medium">Commit:</span> {selectedCommit.shortHash}
              </p>
              <p>
                <span className="font-medium">Message:</span> {selectedCommit.message}
              </p>
              <p>
                <span className="font-medium">Date:</span> {selectedCommit.date}
              </p>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400">
              Make sure you have backed up any important changes before proceeding.
            </p>

            <div className="flex gap-3 justify-end pt-4">
              <Button
                onClick={() => {
                  setShowConfirmation(false);
                  setSelectedCommit(null);
                }}
                variant="secondary"
                disabled={reverting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRevert}
                variant="primary"
                disabled={reverting}
              >
                {reverting ? 'Reverting...' : 'Revert Now'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GitHistoryPanel;
