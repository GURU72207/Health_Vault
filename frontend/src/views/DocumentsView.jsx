import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import {
  FileText,
  Upload,
  Download,
  FileCheck,
  Shield,
  File,
  CheckCircle2,
  AlertTriangle,
  Clock,
  HardDrive,
  Hash,
  AlertCircle,
  Eye,
  Info,
  Check
} from 'lucide-react';

const CLAIMED_DOCUMENT_TYPES = [
  { value: 'Lab Report', label: 'Laboratory / Blood Test Report' },
  { value: 'Prescription', label: 'Medication Prescription (Rx)' },
  { value: 'Visit Note', label: 'Visit Note / Consultation Summary' },
  { value: 'Radiology / Imaging', label: 'Radiology / Diagnostic Scan' }
];

export default function DocumentsView() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [claimedType, setClaimedType] = useState('Lab Report');

  // AI Verification Verdict Modal State
  const [aiVerdictModal, setAiVerdictModal] = useState(null);
  const [reviewDocModal, setReviewDocModal] = useState(null);
  const [acknowledgingId, setAcknowledgingId] = useState(null);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const res = await api.getDocuments();
      setDocuments(res.documents || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [user]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Please select a document to upload.');
      return;
    }

    // Client-side quick validation of extension
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.docx'];
    const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      setUploadError(`File extension '${ext}' is not permitted. Only PDF, JPG, PNG, and DOCX are allowed.`);
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setUploadError('File size exceeds 10MB limit.');
      return;
    }

    try {
      setUploading(true);
      setUploadError('');
      setDownloadError('');

      const formData = new FormData();
      formData.append('document', selectedFile);
      formData.append('claimed_type', claimedType);
      if (user?.role === 'patient') {
        formData.append('patient_id', user.id);
      }

      const res = await api.uploadDocument(formData);
      
      // Clear file selection
      setSelectedFile(null);
      const fileInput = document.getElementById('file-upload-input');
      if (fileInput) fileInput.value = '';

      // Reload document list
      await loadDocuments();

      // Show AI verification result modal
      if (res.ai_verdict || res.document) {
        setAiVerdictModal({
          document: res.document,
          verdict: res.ai_verdict || {
            status: res.document.verification_status,
            confidence: res.document.ai_confidence,
            flagged_reasons: res.document.flagged_reasons,
            matches_claimed_type: res.document.verification_status === 'verified'
          }
        });
      }
    } catch (err) {
      setUploadError(err.message || 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAcknowledge = async (docId) => {
    try {
      setAcknowledgingId(docId);
      await api.acknowledgeDocument(docId);
      await loadDocuments();
      if (aiVerdictModal && aiVerdictModal.document?.id === docId) {
        setAiVerdictModal(prev => ({
          ...prev,
          document: { ...prev.document, patient_acknowledged: 1 }
        }));
      }
      if (reviewDocModal && reviewDocModal.id === docId) {
        setReviewDocModal(prev => ({ ...prev, patient_acknowledged: 1 }));
      }
    } catch (err) {
      alert(`Acknowledgment failed: ${err.message}`);
    } finally {
      setAcknowledgingId(null);
    }
  };

  const handleDownload = async (doc) => {
    try {
      setDownloadError('');
      await api.downloadDocument(doc.id, doc.filename);
    } catch (err) {
      console.error('Download error:', err);
      setDownloadError(err.message || 'Download was denied by security policy.');
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderStatusBadge = (status) => {
    if (status === 'verified') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          <span>Verified</span>
        </span>
      );
    }
    if (status === 'flagged') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center space-x-1">
          <AlertTriangle className="w-3.5 h-3.5 mr-1" />
          <span>Flagged for Review</span>
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-700/40 text-slate-300 border border-slate-600/40 flex items-center space-x-1">
        <Clock className="w-3.5 h-3.5 mr-1" />
        <span>Pending Analysis</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-bold text-white">AI-Verified Document Management</h2>
          <span className="text-xs px-2 py-0.5 rounded bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center">
            <Shield className="w-3 h-3 mr-1" /> Automated Verification
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Secure multi-format medical repository (PDF, JPG, PNG, DOCX) with binary magic-byte enforcement, clinical NLP ontology classification, and consent-gated access.
        </p>
      </div>

      {/* Security & Verification Callout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex items-start space-x-3 text-xs text-slate-300">
          <HardDrive className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">Encrypted Storage & Integrity: </span>
            Files are persisted in secure disk storage using sanitized UUID filenames. Metadata and SHA-256 integrity hashes are indexed in the database. Raw file contents and extracted PII are never logged.
          </div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex items-start space-x-3 text-xs text-slate-300">
          <Shield className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">AI Verification & Privacy Gating: </span>
            Uploaded documents undergo an automated clinical NLP classification pass. Documents flagged for content discrepancies require explicit patient acknowledgment before provider download is permitted.
          </div>
        </div>
      </div>

      {/* Download Security Alert Banner (if download denied) */}
      {downloadError && (
        <div className="p-4 bg-red-500/15 border border-red-500/40 rounded-xl flex items-start space-x-3 text-xs text-red-200 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block font-semibold text-red-100 mb-0.5">Access Denied by Security Policy</strong>
            {downloadError}
          </div>
          <button
            onClick={() => setDownloadError('')}
            className="text-red-400 hover:text-red-200 text-sm px-1.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Upload Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <h3 className="text-sm font-semibold text-white flex items-center">
            <Upload className="w-4 h-4 mr-2 text-emerald-400" />
            Upload Diagnostic Document, Prescription, or Imaging
          </h3>
          <span className="text-[11px] text-slate-400">
            Allowed: PDF, JPG, PNG, DOCX (Max 10MB)
          </span>
        </div>

        {uploadError && (
          <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-xs text-red-300 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-slate-400 text-xs mb-1 font-medium">Claimed Document Type *</label>
              <select
                value={claimedType}
                onChange={(e) => setClaimedType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                {CLAIMED_DOCUMENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-400 text-xs mb-1 font-medium">Select Medical File *</label>
              <input
                id="file-upload-input"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer bg-slate-950 border border-slate-800 rounded-lg p-1.5 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] text-slate-500 flex items-center space-x-1">
              <Shield className="w-3.5 h-3.5 text-slate-400 mr-1" />
              <span>Binary magic headers & AI content classification will be checked on upload.</span>
            </div>

            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 shrink-0 flex items-center space-x-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{uploading ? 'Analyzing & Uploading...' : 'Upload & Verify Document'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Documents Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Repository of Clinical Documents</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Showing indexed records with AI verification and consent status.</p>
          </div>
          <span className="text-xs text-slate-400 font-mono bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
            {documents.length} files
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center">
            <File className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No documents in repository</p>
            <p className="text-xs text-slate-500 mt-1">Upload a lab report or clinical document above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-medium">
                <tr>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Claimed Type</th>
                  <th className="py-3 px-4">AI Verification</th>
                  <th className="py-3 px-4">Patient Approval</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">SHA-256 Checksum</th>
                  <th className="py-3 px-4">Uploaded By</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {documents.map((doc) => {
                  const isFlagged = doc.verification_status === 'flagged';
                  const isPending = doc.verification_status === 'pending';
                  const isAck = doc.patient_acknowledged === 1;
                  const canAcknowledge = user?.role === 'patient' && isFlagged && !isAck;

                  return (
                    <tr key={doc.id} className="hover:bg-slate-850/50 transition">
                      <td className="py-3 px-4 font-medium text-white flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <span className="truncate max-w-[170px] block font-semibold">{doc.filename}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{doc.file_type}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          {doc.claimed_type || 'Lab Report'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col space-y-1">
                          {renderStatusBadge(doc.verification_status)}
                          {doc.ai_confidence > 0 && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {(doc.ai_confidence * 100).toFixed(0)}% confidence
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {isFlagged ? (
                          isAck ? (
                            <span className="text-emerald-400 text-[11px] flex items-center font-medium">
                              <Check className="w-3.5 h-3.5 mr-1" /> Approved by Patient
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <span className="text-amber-400 text-[11px] flex items-center font-medium">
                                <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Pending Approval
                              </span>
                              {canAcknowledge && (
                                <button
                                  onClick={() => handleAcknowledge(doc.id)}
                                  disabled={acknowledgingId === doc.id}
                                  className="px-2 py-0.5 text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded transition"
                                >
                                  {acknowledgingId === doc.id ? 'Approving...' : 'Approve Now'}
                                </button>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-300">
                        {formatBytes(doc.size)}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] text-slate-400 flex items-center" title={doc.checksum_sha256}>
                          <Hash className="w-3 h-3 mr-1 text-slate-500 shrink-0" />
                          {doc.checksum_sha256 ? doc.checksum_sha256.substring(0, 10) + '...' : 'Verified'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-slate-300 font-medium">{doc.uploader_name || 'User'}</div>
                        <div className="text-slate-500 text-[10px] font-mono">{doc.uploaded_at?.split('T')[0]}</div>
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setReviewDocModal(doc)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium inline-flex items-center space-x-1 transition"
                          title="View AI Verification Breakdown"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>AI Report</span>
                        </button>

                        <button
                          onClick={() => handleDownload(doc)}
                          className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 text-xs font-semibold inline-flex items-center space-x-1 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI Post-Upload Verdict Modal */}
      {aiVerdictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-semibold text-teal-400 flex items-center space-x-1 mb-1">
                  <Shield className="w-3.5 h-3.5 mr-1" /> Automated Verification Pass Complete
                </span>
                <h3 className="text-base font-bold text-white">AI Content Verification Report</h3>
              </div>
              <button
                onClick={() => setAiVerdictModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400">File Analyzed:</span>
                <span className="font-semibold text-white font-mono">{aiVerdictModal.document?.filename}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400">Claimed Category:</span>
                <span className="font-semibold text-white">{aiVerdictModal.document?.claimed_type}</span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">AI Classification Verdict:</span>
                  {renderStatusBadge(aiVerdictModal.verdict.status)}
                </div>
                <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                  <span>Model Confidence:</span>
                  <span className="text-slate-200">{(aiVerdictModal.verdict.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>

              {aiVerdictModal.verdict.status === 'flagged' ? (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 text-amber-200">
                  <div className="font-semibold flex items-center text-amber-300">
                    <AlertTriangle className="w-4 h-4 mr-1.5" /> Discrepancies Detected
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-200/90">
                    {(aiVerdictModal.verdict.flagged_reasons || []).map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-amber-300/80 pt-1 border-t border-amber-500/20">
                    Privacy Gate Active: Healthcare providers cannot download or view this document until you acknowledge and approve it.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center space-x-2 text-emerald-300 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Clinical terminology matches claimed document type. Indexed and immediately available to authorized providers.</span>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
              {aiVerdictModal.verdict.status === 'flagged' && user?.role === 'patient' && aiVerdictModal.document?.patient_acknowledged !== 1 && (
                <button
                  onClick={() => handleAcknowledge(aiVerdictModal.document.id)}
                  disabled={acknowledgingId === aiVerdictModal.document.id}
                  className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition"
                >
                  {acknowledgingId === aiVerdictModal.document.id ? 'Approving...' : 'Acknowledge & Approve'}
                </button>
              )}
              <button
                onClick={() => setAiVerdictModal(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Detailed AI Report Modal for existing documents */}
      {reviewDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-semibold text-teal-400 flex items-center space-x-1 mb-1">
                  <Shield className="w-3.5 h-3.5 mr-1" /> Inspection Audit
                </span>
                <h3 className="text-base font-bold text-white">Document AI Verification Details</h3>
              </div>
              <button
                onClick={() => setReviewDocModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Document Name:</span>
                  <span className="font-semibold text-white font-mono">{reviewDocModal.filename}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Claimed Type:</span>
                  <span className="text-slate-200">{reviewDocModal.claimed_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">SHA-256 Hash:</span>
                  <span className="text-slate-400 font-mono text-[10px] truncate max-w-[240px]" title={reviewDocModal.checksum_sha256}>
                    {reviewDocModal.checksum_sha256}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Verification Status:</span>
                  {renderStatusBadge(reviewDocModal.verification_status)}
                </div>
                <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                  <span>AI Confidence Score:</span>
                  <span className="text-slate-200">{(reviewDocModal.ai_confidence * 100).toFixed(0)}%</span>
                </div>
              </div>

              {reviewDocModal.verification_status === 'flagged' && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 text-amber-200">
                  <div className="font-semibold flex items-center text-amber-300">
                    <AlertTriangle className="w-4 h-4 mr-1.5" /> Flagged Reasons & Redacted Audit Summary
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-200/90">
                    {(reviewDocModal.flagged_reasons || []).length > 0 ? (
                      reviewDocModal.flagged_reasons.map((r, i) => <li key={i}>{r}</li>)
                    ) : (
                      <li>Document content did not exhibit required clinical vocabulary for claimed category.</li>
                    )}
                  </ul>
                  <div className="pt-2 border-t border-amber-500/20 text-[11px]">
                    <span className="text-slate-400">Patient Approval Status: </span>
                    <strong className={reviewDocModal.patient_acknowledged === 1 ? 'text-emerald-400' : 'text-amber-400'}>
                      {reviewDocModal.patient_acknowledged === 1 ? 'Approved / Acknowledged' : 'Gated / Not Yet Acknowledged'}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              <button
                onClick={() => handleDownload(reviewDocModal)}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download File</span>
              </button>

              <div className="flex space-x-2">
                {reviewDocModal.verification_status === 'flagged' && user?.role === 'patient' && reviewDocModal.patient_acknowledged !== 1 && (
                  <button
                    onClick={() => handleAcknowledge(reviewDocModal.id)}
                    disabled={acknowledgingId === reviewDocModal.id}
                    className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition"
                  >
                    {acknowledgingId === reviewDocModal.id ? 'Approving...' : 'Approve for Doctor'}
                  </button>
                )}
                <button
                  onClick={() => setReviewDocModal(null)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
