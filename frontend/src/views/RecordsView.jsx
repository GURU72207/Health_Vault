import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import {
  FileText,
  Search,
  Filter,
  Plus,
  Lock,
  Calendar,
  User,
  Eye,
  EyeOff,
  Stethoscope,
  Pill,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function RecordsView() {
  const { user } = useAuth();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [showEncryptedView, setShowEncryptedView] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Provider patient context
  const [accessiblePatients, setAccessiblePatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');

  // Create Form State
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('Visit Note');
  const [newNotes, setNewNotes] = useState('');
  const [newVisitDate, setNewVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [newFollowUpDate, setNewFollowUpDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Load patients if provider
  useEffect(() => {
    async function loadPatients() {
      if (user?.role === 'provider') {
        try {
          const res = await api.getPatients();
          setAccessiblePatients(res.patients || []);
          if (res.patients && res.patients.length > 0) {
            setSelectedPatientId(res.patients[0].id);
          }
        } catch (err) {
          console.error('Failed to load accessible patients:', err);
        }
      }
    }
    loadPatients();
  }, [user]);

  // Load visits
  const loadVisits = async () => {
    try {
      setLoading(true);
      const params = {};
      if (user?.role === 'provider' && selectedPatientId) {
        params.patient_id = selectedPatientId;
      }
      if (typeFilter) params.record_type = typeFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (searchTerm) params.search = searchTerm;

      const res = await api.getVisits(params);
      setVisits(res.visits || []);
    } catch (err) {
      console.error('Failed to load visits:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== 'provider' || selectedPatientId) {
      loadVisits();
    }
  }, [user, selectedPatientId, typeFilter, startDate, endDate, searchTerm]);

  const handleCreateVisit = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newNotes.trim()) {
      setFormError('Title and clinical notes are required.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');
      const targetPatientId = user?.role === 'patient' ? user.id : selectedPatientId;

      await api.createVisit({
        patient_id: targetPatientId,
        title: newTitle.trim(),
        record_type: newType,
        notes: newNotes.trim(),
        visit_date: newVisitDate,
        follow_up_date: newFollowUpDate || null
      });

      setIsCreateModalOpen(false);
      setNewTitle('');
      setNewNotes('');
      setNewFollowUpDate('');
      await loadVisits();
    } catch (err) {
      setFormError(err.message || 'Failed to create record');
    } finally {
      setSubmitting(false);
    }
  };

  const getRecordIcon = (type) => {
    switch (type) {
      case 'Prescription':
        return <Pill className="w-4 h-4 text-emerald-400" />;
      case 'Lab Report':
        return <Activity className="w-4 h-4 text-sky-400" />;
      case 'Consultation':
        return <Stethoscope className="w-4 h-4 text-purple-400" />;
      default:
        return <FileText className="w-4 h-4 text-teal-400" />;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-white">Health Records & Clinical Visits</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center">
              <Lock className="w-3 h-3 mr-1" /> AES-256 Encrypted
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Organize prescriptions, laboratory reports, and follow-up consultation notes.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {user?.role === 'provider' && (
            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
              <User className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-400">Patient:</span>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="bg-transparent text-white font-medium focus:outline-none"
              >
                {accessiblePatients.map(p => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 flex items-center space-x-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Health Record</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap gap-3 items-center justify-between text-xs">
        <div className="flex items-center space-x-2 flex-1 min-w-[200px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search records by title or contents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent text-slate-200 placeholder-slate-500 focus:outline-none w-full"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-2 focus:outline-none"
          >
            <option value="">All Record Types</option>
            <option value="Visit Note">Visit Note</option>
            <option value="Prescription">Prescription</option>
            <option value="Lab Report">Lab Report</option>
            <option value="Consultation">Consultation</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-slate-400">Date:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2 py-1.5 focus:outline-none"
          />
          <span className="text-slate-500">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2 py-1.5 focus:outline-none"
          />
        </div>
      </div>

      {/* Visits List */}
      {loading ? (
        <div className="p-8 text-center text-slate-400 text-xs">Loading encrypted records...</div>
      ) : visits.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">No health records found</p>
          <p className="text-xs text-slate-500 mt-1">Create a new encounter or adjust your search filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visits.map((v) => (
            <div
              key={v.id}
              onClick={() => setSelectedVisit(v)}
              className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 p-4 rounded-xl cursor-pointer transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 border border-slate-700 flex items-center space-x-1.5">
                    {getRecordIcon(v.record_type)}
                    <span className="text-slate-200">{v.record_type}</span>
                  </span>
                  <span className="text-xs text-slate-400 font-mono flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1" />
                    {v.visit_date}
                  </span>
                </div>

                <h3 className="font-semibold text-white mt-2.5 text-sm">{v.title}</h3>
                
                <p className="text-xs text-slate-300 mt-1.5 line-clamp-2">
                  {v.notes}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center">
                  <User className="w-3 h-3 mr-1 text-slate-500" />
                  {v.provider_name || 'Healthcare Provider'}
                </span>

                {v.follow_up_date ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    Follow-up: {v.follow_up_date}
                  </span>
                ) : (
                  <span className="text-slate-500 text-[11px]">No follow-up needed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Record Detail Modal */}
      {selectedVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 text-slate-100 shadow-2xl space-y-4">
            
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 flex items-center space-x-1.5">
                    {getRecordIcon(selectedVisit.record_type)}
                    <span>{selectedVisit.record_type}</span>
                  </span>
                  <span className="text-xs font-mono text-slate-400">{selectedVisit.visit_date}</span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">{selectedVisit.title}</h3>
                <p className="text-xs text-slate-400">Physician: {selectedVisit.provider_name}</p>
              </div>

              <button
                onClick={() => setSelectedVisit(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Follow-up banner if present */}
            {selectedVisit.follow_up_date && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs text-amber-300">
                <span className="flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-amber-400" />
                  Scheduled Clinical Follow-up: <strong>{selectedVisit.follow_up_date}</strong>
                </span>
                <span className="px-2 py-0.5 bg-amber-500/20 rounded font-semibold text-[10px]">
                  ACTIVE REMINDER
                </span>
              </div>
            )}

            {/* Clinical Notes Content */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Clinical Diagnosis & Consultation Notes:</span>
                <button
                  onClick={() => setShowEncryptedView(!showEncryptedView)}
                  className="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center space-x-1 border border-slate-700"
                >
                  {showEncryptedView ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showEncryptedView ? 'View Decrypted Text' : 'View AES-256 Ciphertext'}</span>
                </button>
              </div>

              <div className={`p-4 rounded-xl border border-slate-800 max-h-60 overflow-y-auto text-xs leading-relaxed ${
                showEncryptedView ? 'bg-slate-950 font-mono text-amber-300 break-all' : 'bg-slate-950/60 text-slate-200'
              }`}>
                {showEncryptedView ? selectedVisit.notes_encrypted : selectedVisit.notes}
              </div>
            </div>

            {/* Attached Documents if any */}
            {selectedVisit.documents && selectedVisit.documents.length > 0 && (
              <div className="border-t border-slate-800 pt-3">
                <span className="text-xs font-semibold text-slate-400 block mb-2">Attached Diagnostic Documents:</span>
                <div className="space-y-1">
                  {selectedVisit.documents.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-slate-300">{doc.filename}</span>
                        {doc.verification_status === 'verified' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Verified
                          </span>
                        )}
                        {doc.verification_status === 'flagged' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Flagged for Review
                          </span>
                        )}
                      </div>
                      <a
                        href={api.getDocumentDownloadUrl(doc.id)}
                        className="text-emerald-400 hover:underline font-semibold"
                        download
                      >
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedVisit(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Create New Record Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 text-slate-100 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Create Health Record</h3>
            <p className="text-xs text-slate-400 mb-4">
              All diagnosis notes and sensitive clinical observations will be encrypted with AES-256-GCM.
            </p>

            {formError && (
              <div className="p-3 mb-4 bg-red-500/20 border border-red-500/40 rounded-lg text-xs text-red-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateVisit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Record Title / Chief Complaint *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Annual Cardiology Review & Medication Adjustment"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Record Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="Visit Note">Visit Note</option>
                    <option value="Prescription">Prescription</option>
                    <option value="Lab Report">Lab Report</option>
                    <option value="Consultation">Consultation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Visit Date</label>
                  <input
                    type="date"
                    value={newVisitDate}
                    onChange={(e) => setNewVisitDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">
                  Sensitive Clinical Notes / Diagnosis / Prescription Details *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Clinical findings, vital signs, medication dosages, and patient instructions (AES-256 encrypted at rest)..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Scheduled Follow-Up Date (Optional)</label>
                <input
                  type="date"
                  value={newFollowUpDate}
                  onChange={(e) => setNewFollowUpDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Enables in-app reminder banner and urgency calculations.
                </span>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition disabled:opacity-50"
                >
                  {submitting ? 'Encrypting & Saving...' : 'Save & Encrypt Record'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
