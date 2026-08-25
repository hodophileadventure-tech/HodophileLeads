/**
 * Admin Users & Roles Management Page
 * 
 * This page allows admins to:
 * 1. Create new roles (Video Editor, Content Creator, Custom roles)
 * 2. Manage users and assign roles
 * 3. Assign permissions to roles
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const RAW_API_BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '')).replace(/\/$/, '');
const API_BASE = RAW_API_BASE.replace(/\/api\/?$/, '');
const API_PREFIX = API_BASE ? `${API_BASE}/api` : '/api';

interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_system_role: boolean;
  permission_count: number;
}

interface User {
  id: string;
  email: string;
  name: string;
  role_id: string;
  role_name: string;
  role_slug: string;
  created_at: string;
  nic?: string | null;
  date_of_birth?: string | null;
  joining_date?: string | null;
  salary?: number | null;
  designation?: string | null;
  emergency_contact_number?: string | null;
  address?: string | null;
}

type EmployeeFormData = {
  email: string; name: string; password: string; roleId: string; nic: string;
  dateOfBirth: string; joiningDate: string; salary: string; designation: string;
  emergencyContactNumber: string; address: string;
};

const emptyEmployeeForm: EmployeeFormData = {
  email: '', name: '', password: '', roleId: '', nic: '', dateOfBirth: '',
  joiningDate: '', salary: '', designation: '', emergencyContactNumber: '', address: ''
};



// ============================================================================
// Role Management Tab
// ============================================================================

function RoleManagementTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', slug: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRoles();
  }, []);

  async function fetchRoles() {
    try {
      setLoading(true);
      const response = await axios.get(`${API_PREFIX}/admin/roles`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setRoles(response.data.roles || []);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRole(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name || !formData.slug) {
      setError('Name and slug are required');
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${API_PREFIX}/admin/roles`, formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setFormData({ name: '', slug: '', description: '' });
      setShowCreateForm(false);
      setError(null);
      await fetchRoles();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create role');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteRole(roleId: string) {
    if (!window.confirm('Are you sure? This will delete the role and all associated permissions.')) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`${API_PREFIX}/admin/roles/${roleId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setError(null);
      await fetchRoles();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete role');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Roles</h2>
          <p className="text-gray-600 mt-1">Manage system and custom roles</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          + Create Role
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Create New Role</h3>
          <form onSubmit={handleCreateRole} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role Name *
              </label>
              <input
                type="text"
                placeholder="e.g., Video Editor, Content Creator"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role Slug * (for URL/programmatic use)
              </label>
              <input
                type="text"
                placeholder="e.g., video_editor, content_creator"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Must be lowercase and use underscores</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                placeholder="What is this role for?"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setFormData({ name: '', slug: '', description: '' });
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Role'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Roles List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roles.map((role) => (
          <div key={role.id} className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md transition">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{role.name}</h3>
                <p className="text-sm text-gray-500">
                  {role.is_system_role ? '🔒 System Role' : `📌 ${role.slug}`}
                </p>
              </div>
              {!role.is_system_role && (
                <button
                  onClick={() => handleDeleteRole(role.id)}
                  className="text-red-600 hover:text-red-700 font-medium text-sm"
                >
                  Delete
                </button>
              )}
            </div>
            {role.description && (
              <p className="text-sm text-gray-600 mb-3">{role.description}</p>
            )}
            <p className="text-xs text-gray-500">
              {role.permission_count} permissions assigned
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// User Management Tab
// ============================================================================

function UserManagementTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>(emptyEmployeeForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      const response = await axios.get(`${API_PREFIX}/admin/users`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setUsers(response.data.users || []);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function fetchRoles() {
    try {
      const response = await axios.get(`${API_PREFIX}/admin/roles`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setRoles(response.data.roles || []);
    } catch (err) {
      console.error('Failed to load roles');
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.email || !formData.name || (!editingUserId && !formData.password) || !formData.roleId) {
      setError('Email, name, password for new users, and role are required');
      return;
    }

    try {
      setLoading(true);
      const payload = editingUserId ? { ...formData, password: undefined } : formData;
      if (editingUserId) {
        await axios.put(`${API_PREFIX}/admin/users/${editingUserId}`, payload, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
      } else {
        await axios.post(`${API_PREFIX}/admin/users`, formData, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
      }
      setFormData(emptyEmployeeForm);
      setEditingUserId(null);
      setShowCreateForm(false);
      setError(null);
      await fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  }

  function beginEdit(user: User) {
    setEditingUserId(user.id);
    setFormData({
      email: user.email, name: user.name, password: '', roleId: user.role_id,
      nic: user.nic || '', dateOfBirth: user.date_of_birth?.slice(0, 10) || '',
      joiningDate: user.joining_date?.slice(0, 10) || '', salary: user.salary?.toString() || '',
      designation: user.designation || '',
      emergencyContactNumber: user.emergency_contact_number || '', address: user.address || ''
    });
    setShowCreateForm(true);
  }

  async function handleDeleteUser(userId: string) {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`${API_PREFIX}/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setError(null);
      await fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Users</h2>
          <p className="text-gray-600 mt-1">Manage system users and role assignments</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          + Create User
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">{editingUserId ? 'Edit Employee Record' : 'Create Employee Record'}</h3>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password {editingUserId ? '(leave blank to keep current)' : '*'}
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role *
              </label>
              <select
                value={formData.roleId}
                onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a role...</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name} ({role.slug})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ['nic', 'NIC'], ['dateOfBirth', 'Date of Birth'], ['joiningDate', 'Joining Date'],
                ['salary', 'Salary'], ['designation', 'Designation'],
                ['emergencyContactNumber', 'Emergency Contact Number']
              ].map(([field, label]) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type={field === 'dateOfBirth' || field === 'joiningDate' ? 'date' : field === 'salary' ? 'number' : 'text'}
                    min={field === 'salary' ? '0' : undefined}
                    value={formData[field as keyof EmployeeFormData]}
                    onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingUserId(null);
                  setFormData(emptyEmployeeForm);
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Role</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Designation</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">NIC</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Joining Date</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Salary</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Created</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.name}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                <td className="px-6 py-4 text-sm">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                    {user.role_name || 'No role'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{user.designation || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{user.nic || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{user.joining_date ? new Date(user.joining_date).toLocaleDateString() : '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{user.salary == null ? '-' : Number(user.salary).toLocaleString()}</td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm">
                  <button
                    onClick={() => beginEdit(user)}
                    className="text-blue-600 hover:text-blue-700 font-medium mr-4"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className="text-red-600 hover:text-red-700 font-medium"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// Main Admin Page Component
// ============================================================================

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'roles' | 'users'>('roles');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-gray-900">System Administration</h1>
          <p className="text-gray-600 mt-2">Manage roles, users, and permissions</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('roles')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'roles'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-700 hover:text-gray-900'
              }`}
            >
              Roles
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-700 hover:text-gray-900'
              }`}
            >
              Users
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'roles' && <RoleManagementTab />}
        {activeTab === 'users' && <UserManagementTab />}
      </div>
    </div>
  );
}
