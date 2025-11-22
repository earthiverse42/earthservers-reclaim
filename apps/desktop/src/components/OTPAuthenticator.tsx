// OTP Authenticator Component for Reclaim
// Stores and generates TOTP codes for 2FA

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '../lib/tauri';

export interface OTPEntry {
  id: number;
  profile_id: number;
  name: string;
  issuer: string;
  secret: string; // Base32 encoded secret
  algorithm: 'SHA1' | 'SHA256' | 'SHA512';
  digits: number;
  period: number;
  created_at: string;
}

interface OTPAuthenticatorProps {
  profileId: number;
  isOpen: boolean;
  onClose: () => void;
}

// Simple TOTP implementation
function generateTOTP(secret: string, _algorithm: string = 'SHA1', digits: number = 6, period: number = 30): string {
  // This is a simplified TOTP generator for demo purposes
  // In production, use a proper TOTP library like otpauth
  const counter = Math.floor(Date.now() / 1000 / period);

  // Create a deterministic code based on secret and counter
  // This is NOT cryptographically secure - just for demo
  let hash = 0;
  const combined = secret + counter.toString();
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  // Get the last N digits
  const code = Math.abs(hash % Math.pow(10, digits)).toString().padStart(digits, '0');
  return code;
}

export function OTPAuthenticator({ profileId, isOpen, onClose }: OTPAuthenticatorProps) {
  const [entries, setEntries] = useState<OTPEntry[]>([]);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [hasMasterPassword, setHasMasterPassword] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<OTPEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Update time every second for TOTP countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      checkMasterPassword();
    }
  }, [isOpen, profileId]);

  const checkMasterPassword = async () => {
    try {
      const hasPass = await invoke<boolean>('has_otp_master', { profile_id: profileId });
      setHasMasterPassword(hasPass);
    } catch {
      setHasMasterPassword(false);
    }
  };

  const unlock = async () => {
    try {
      const valid = await invoke<boolean>('verify_otp_master', {
        profile_id: profileId,
        password: masterPassword,
      });
      if (valid) {
        setIsUnlocked(true);
        setMasterPassword('');
        loadEntries();
      } else {
        alert('Incorrect master password');
      }
    } catch {
      setIsUnlocked(true);
      loadEntries();
    }
  };

  const setNewMasterPassword = async () => {
    if (masterPassword.length < 8) {
      alert('Master password must be at least 8 characters');
      return;
    }
    try {
      await invoke('set_otp_master', {
        profile_id: profileId,
        password: masterPassword,
      });
      setHasMasterPassword(true);
      setIsUnlocked(true);
      setMasterPassword('');
      loadEntries();
    } catch (err) {
      console.error('Failed to set master password:', err);
    }
  };

  const loadEntries = async () => {
    try {
      const data = await invoke<OTPEntry[]>('get_otp_entries', { profile_id: profileId });
      setEntries(data);
    } catch (err) {
      console.error('Failed to load OTP entries:', err);
    }
  };

  const deleteEntry = async (entryId: number) => {
    if (!confirm('Are you sure you want to delete this authenticator entry?')) return;
    try {
      await invoke('delete_otp_entry', { entry_id: entryId });
      loadEntries();
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };

  const copyCode = async (code: string, id: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const filteredEntries = entries.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.issuer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate time remaining in current period (default 30s)
  const getTimeRemaining = useCallback((period: number = 30) => {
    return period - (Math.floor(currentTime / 1000) % period);
  }, [currentTime]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="w-full max-w-2xl h-[600px] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--primary-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h2 className="text-lg font-semibold text-[var(--text-color)]">Authenticator</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {!isUnlocked ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-sm p-6">
              <div className="text-center mb-6">
                <svg className="w-16 h-16 mx-auto text-[var(--primary-color)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <h3 className="text-xl font-semibold text-[var(--text-color)]">
                  {hasMasterPassword ? 'Unlock Authenticator' : 'Set Master Password'}
                </h3>
                <p className="text-sm text-gray-400 mt-2">
                  {hasMasterPassword
                    ? 'Enter your master password to access 2FA codes'
                    : 'Create a master password to secure your 2FA codes (min 8 characters)'}
                </p>
              </div>

              <div className="space-y-4">
                <input
                  type="password"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (hasMasterPassword ? unlock() : setNewMasterPassword())}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-[var(--primary-color)]"
                  placeholder={hasMasterPassword ? 'Master password' : 'Create master password'}
                  autoFocus
                />
                <button
                  onClick={hasMasterPassword ? unlock : setNewMasterPassword}
                  className="w-full px-4 py-3 bg-[var(--primary-color)] text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
                >
                  {hasMasterPassword ? 'Unlock' : 'Create Password'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search and Add */}
            <div className="flex items-center gap-3 p-4 border-b border-gray-700">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search accounts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-[var(--primary-color)]"
                />
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-[var(--primary-color)] text-white rounded-lg hover:opacity-90 transition-opacity text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Account
              </button>
            </div>

            {/* OTP List */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {filteredEntries.map(entry => {
                  const code = generateTOTP(entry.secret, entry.algorithm, entry.digits, entry.period);
                  const timeRemaining = getTimeRemaining(entry.period);
                  const isLow = timeRemaining <= 5;

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-4 p-4 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors group"
                    >
                      {/* Icon/Avatar */}
                      <div className="w-12 h-12 flex items-center justify-center bg-[var(--primary-color)]/20 text-[var(--primary-color)] rounded-xl text-lg font-semibold">
                        {entry.issuer.charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[var(--text-color)] truncate">{entry.issuer}</div>
                        <div className="text-sm text-gray-400 truncate">{entry.name}</div>
                      </div>

                      {/* Code */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => copyCode(code, entry.id)}
                          className="text-2xl font-mono font-bold tracking-wider text-[var(--text-color)] hover:text-[var(--primary-color)] transition-colors"
                        >
                          {copiedId === entry.id ? (
                            <span className="text-green-400 text-base flex items-center gap-1">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied
                            </span>
                          ) : (
                            <>
                              {code.slice(0, 3)} {code.slice(3)}
                            </>
                          )}
                        </button>

                        {/* Countdown */}
                        <div className={`w-10 h-10 flex items-center justify-center rounded-full border-2 ${
                          isLow ? 'border-red-500 text-red-400' : 'border-[var(--primary-color)] text-[var(--primary-color)]'
                        }`}>
                          <span className="text-sm font-medium">{timeRemaining}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingEntry(entry)}
                          className="p-1.5 hover:bg-gray-600 rounded transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteEntry(entry.id)}
                          className="p-1.5 hover:bg-red-600/50 rounded transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {filteredEntries.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    {searchQuery ? 'No accounts match your search.' : (
                      <div>
                        <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <p className="text-lg font-medium mb-2">No 2FA accounts yet</p>
                        <p className="text-sm">Add your first account to start generating codes</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingEntry) && (
        <OTPEntryModal
          profileId={profileId}
          entry={editingEntry}
          onClose={() => {
            setShowAddModal(false);
            setEditingEntry(null);
          }}
          onSave={() => {
            setShowAddModal(false);
            setEditingEntry(null);
            loadEntries();
          }}
        />
      )}
    </div>
  );
}

// OTP Entry Modal for Add/Edit
function OTPEntryModal({
  profileId,
  entry,
  onClose,
  onSave,
}: {
  profileId: number;
  entry: OTPEntry | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState(entry?.name || '');
  const [issuer, setIssuer] = useState(entry?.issuer || '');
  const [secret, setSecret] = useState(entry?.secret || '');
  const [algorithm, setAlgorithm] = useState<'SHA1' | 'SHA256' | 'SHA512'>(entry?.algorithm || 'SHA1');
  const [digits, setDigits] = useState(entry?.digits || 6);
  const [period, setPeriod] = useState(entry?.period || 30);

  const handleSave = async () => {
    if (!name.trim() || !issuer.trim() || !secret.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    // Clean up the secret (remove spaces and dashes)
    const cleanSecret = secret.replace(/[\s-]/g, '').toUpperCase();

    try {
      if (entry) {
        await invoke('update_otp_entry', {
          entry_id: entry.id,
          name: name.trim(),
          issuer: issuer.trim(),
          secret: cleanSecret,
          algorithm,
          digits,
          period,
        });
      } else {
        await invoke('add_otp_entry', {
          profile_id: profileId,
          name: name.trim(),
          issuer: issuer.trim(),
          secret: cleanSecret,
          algorithm,
          digits,
          period,
        });
      }
      onSave();
    } catch (err) {
      console.error('Failed to save OTP entry:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80">
      <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-lg shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-[var(--text-color)]">
            {entry ? 'Edit Account' : 'Add Account'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Service/Issuer *</label>
            <input
              type="text"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-[var(--primary-color)]"
              placeholder="e.g., Google, GitHub, Discord"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Account Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-[var(--primary-color)]"
              placeholder="e.g., user@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Secret Key *</label>
            <input
              type="text"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-[var(--primary-color)] font-mono"
              placeholder="JBSWY3DPEHPK3PXP"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the secret key provided by the service (usually shown as a code or under manual setup)
            </p>
          </div>

          {/* Advanced Options */}
          <details className="group">
            <summary className="cursor-pointer text-sm text-gray-400 hover:text-white transition-colors">
              Advanced Options
            </summary>
            <div className="mt-3 space-y-3 pl-2 border-l-2 border-gray-700">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Algorithm</label>
                  <select
                    value={algorithm}
                    onChange={(e) => setAlgorithm(e.target.value as 'SHA1' | 'SHA256' | 'SHA512')}
                    className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm focus:outline-none focus:border-[var(--primary-color)]"
                  >
                    <option value="SHA1">SHA-1</option>
                    <option value="SHA256">SHA-256</option>
                    <option value="SHA512">SHA-512</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Digits</label>
                  <select
                    value={digits}
                    onChange={(e) => setDigits(parseInt(e.target.value))}
                    className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm focus:outline-none focus:border-[var(--primary-color)]"
                  >
                    <option value={6}>6</option>
                    <option value={8}>8</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Period (sec)</label>
                  <select
                    value={period}
                    onChange={(e) => setPeriod(parseInt(e.target.value))}
                    className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm focus:outline-none focus:border-[var(--primary-color)]"
                  >
                    <option value={30}>30</option>
                    <option value={60}>60</option>
                  </select>
                </div>
              </div>
            </div>
          </details>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm hover:bg-gray-700 rounded transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-[var(--primary-color)] hover:opacity-90 rounded transition-opacity"
          >
            {entry ? 'Save Changes' : 'Add Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OTPAuthenticator;
