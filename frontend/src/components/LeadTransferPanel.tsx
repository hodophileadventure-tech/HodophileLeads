import React, { useEffect, useState } from 'react';
import { adminAPI } from '../utils/api-service';
import { Button, Spinner } from './common';
import type { Lead } from '../types';

interface Agent {
  id: string;
  name: string;
  email: string;
  role: string;
}

const LeadTransferPanel: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [agentLeads, setAgentLeads] = useState<Lead[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [targetAgentId, setTargetAgentId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Load agents
  useEffect(() => {
    const loadAgents = async () => {
      setLoading(true);
      try {
        const response = await (adminAPI as any).getAgents();
        setAgents(response.data.agents || []);
        setError('');
      } catch (err: any) {
        console.error('Failed to load agents:', err);
        setError('Failed to load agents');
      } finally {
        setLoading(false);
      }
    };

    loadAgents();
  }, []);

  // Load leads for selected agent
  useEffect(() => {
    const loadAgentLeads = async () => {
      if (!selectedAgentId) {
        setAgentLeads([]);
        return;
      }

      setLoadingLeads(true);
      try {
        const response = await (adminAPI as any).getAgentLeads(selectedAgentId);
        setAgentLeads(response.data.leads || []);
        setSelectedLeadIds([]); // Reset selected leads
        setError('');
      } catch (err: any) {
        console.error('Failed to load leads:', err);
        setError('Failed to load leads for this agent');
        setAgentLeads([]);
      } finally {
        setLoadingLeads(false);
      }
    };

    loadAgentLeads();
  }, [selectedAgentId]);

  const getSelectedLeads = () => {
    return agentLeads.filter(lead => selectedLeadIds.includes(String(lead.id)));
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const selectAllLeads = () => {
    if (selectedLeadIds.length === agentLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(agentLeads.map(lead => String(lead.id)));
    }
  };

  const getSourceAgentName = () => {
    const agent = agents.find(a => a.id === selectedAgentId);
    return agent?.name || '';
  };

  const getTargetAgentName = () => {
    const agent = agents.find(a => a.id === targetAgentId);
    return agent?.name || '';
  };

  const handleTransfer = async () => {
    if (selectedLeadIds.length === 0 || !targetAgentId) {
      setError('Please select at least one lead and target agent');
      return;
    }

    if (selectedAgentId === targetAgentId) {
      setError('Source and target agent must be different');
      return;
    }

    setTransferring(true);
    setError('');
    setSuccess('');

    try {
      // Transfer each lead
      const transferPromises = selectedLeadIds.map(leadId =>
        adminAPI.transferLead(leadId, targetAgentId)
      );
      
      await Promise.all(transferPromises);
      
      setSuccess(`${selectedLeadIds.length} lead${selectedLeadIds.length > 1 ? 's' : ''} transferred successfully from ${getSourceAgentName()} to ${getTargetAgentName()}`);
      
      // Reload leads for the source agent
      const response = await (adminAPI as any).getAgentLeads(selectedAgentId);
      setAgentLeads(response.data.leads || []);
      
      // Reset form
      setSelectedLeadIds([]);
      setTargetAgentId('');
      setShowConfirmation(false);

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      console.error('Failed to transfer leads:', err);
      setError(err?.response?.data?.message || 'Failed to transfer leads');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Transfer Lead Between Agents</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Select an agent, choose a lead from their list, and transfer it to another agent.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300">
          ✓ {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source Agent & Lead Selection */}
        <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-lg">Source Agent & Lead</h3>

          {/* Agent Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Select Agent
            </label>
            {loading ? (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            ) : (
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose an agent...</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Lead Selection */}
          {selectedAgentId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Select Leads to Transfer
              </label>
              {loadingLeads ? (
                <div className="flex justify-center py-4">
                  <Spinner />
                </div>
              ) : agentLeads.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 py-4">No leads found for this agent</p>
              ) : (
                <div className="border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 max-h-64 overflow-y-auto">
                  <div className="sticky top-0 p-2 bg-slate-50 dark:bg-slate-700 border-b border-slate-300 dark:border-slate-600">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.length === agentLeads.length && agentLeads.length > 0}
                        onChange={selectAllLeads}
                        className="w-4 h-4 rounded border-slate-300"
                      />
                      <span className="ml-2 text-sm font-medium">
                        {selectedLeadIds.length === agentLeads.length && agentLeads.length > 0 
                          ? 'Unselect All' 
                          : 'Select All'}
                      </span>
                    </label>
                  </div>
                  <div className="space-y-0">
                    {agentLeads.map((lead) => (
                      <label
                        key={lead.id}
                        className="flex items-start p-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-200 dark:border-slate-700 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.includes(String(lead.id))}
                          onChange={() => toggleLeadSelection(String(lead.id))}
                          className="w-4 h-4 mt-0.5 rounded border-slate-300"
                        />
                        <div className="ml-3 flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {lead.clientName}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {lead.phone} • {lead.destination}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {selectedLeadIds.length > 0 && (
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                  {selectedLeadIds.length} lead{selectedLeadIds.length > 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          )}

          {/* Lead Details */}
          {selectedLeadIds.length > 0 && (
            <div className="mt-4 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 space-y-3">
              <h4 className="font-semibold text-sm">Selected Leads ({selectedLeadIds.length})</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {getSelectedLeads().map((lead) => (
                  <div key={lead.id} className="p-2 bg-slate-50 dark:bg-slate-700 rounded text-sm">
                    <p className="font-medium">{lead.clientName}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {lead.phone} • {lead.destination} • {lead.status}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Target Agent Selection */}
        <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-lg">Target Agent</h3>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Transfer To
            </label>
            <select
              value={targetAgentId}
              onChange={(e) => setTargetAgentId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose target agent...</option>
              {agents
                .filter((agent) => agent.id !== selectedAgentId)
                .map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.email})
                  </option>
                ))}
            </select>
          </div>

          {/* Summary */}
          {selectedLeadIds.length > 0 && targetAgentId && (
            <div className="mt-4 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 space-y-2">
              <h4 className="font-semibold text-sm">Transfer Summary</h4>
              <div className="text-sm space-y-2">
                <p>
                  <span className="text-slate-600 dark:text-slate-400">From:</span>{' '}
                  <span className="font-medium text-blue-600 dark:text-blue-400">{getSourceAgentName()}</span>
                </p>
                <p>
                  <span className="text-slate-600 dark:text-slate-400">To:</span>{' '}
                  <span className="font-medium text-green-600 dark:text-green-400">{getTargetAgentName()}</span>
                </p>
                <p>
                  <span className="text-slate-600 dark:text-slate-400">Leads:</span>{' '}
                  <span className="font-medium">{selectedLeadIds.length}</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  This will remove the selected leads from {getSourceAgentName()}'s panel and add them to {getTargetAgentName()}'s panel.
                </p>
              </div>
            </div>
          )}

          {/* Transfer Button */}
          <div className="mt-6">
            <Button
              onClick={() => setShowConfirmation(true)}
              disabled={selectedLeadIds.length === 0 || !targetAgentId || transferring || selectedAgentId === targetAgentId}
              variant="primary"
              className="w-full"
            >
              {transferring ? 'Transferring...' : `Transfer ${selectedLeadIds.length} Lead${selectedLeadIds.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold">Confirm Lead Transfer</h3>
            <p className="text-slate-600 dark:text-slate-400">
              Are you sure you want to transfer <strong>{selectedLeadIds.length} lead{selectedLeadIds.length > 1 ? 's' : ''}</strong> from {' '}
              <strong>{getSourceAgentName()}</strong> to <strong>{getTargetAgentName()}</strong>?
            </p>
            {selectedLeadIds.length <= 5 && (
              <div className="p-2 bg-slate-50 dark:bg-slate-700 rounded text-sm space-y-1 max-h-32 overflow-y-auto">
                {getSelectedLeads().map((lead) => (
                  <p key={lead.id} className="text-slate-700 dark:text-slate-300">
                    • {lead.clientName}
                  </p>
                ))}
              </div>
            )}
            <p className="text-sm text-slate-500 dark:text-slate-500">
              This action will remove the selected leads from the source agent's panel and make them available only to the target agent.
            </p>
            <div className="flex gap-3 justify-end pt-4">
              <Button
                onClick={() => setShowConfirmation(false)}
                variant="secondary"
                disabled={transferring}
              >
                Cancel
              </Button>
              <Button
                onClick={handleTransfer}
                variant="primary"
                disabled={transferring}
              >
                {transferring ? 'Transferring...' : 'Confirm Transfer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadTransferPanel;
