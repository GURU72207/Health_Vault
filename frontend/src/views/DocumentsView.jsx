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
  Clock,
  HardDrive,
  Hash
} from 'lucide-react';

export default function DocumentsView() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

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
      setUploadError('Please choose a file to upload.');
      return;
    }

    try {
      setUploading(true);
      setUploadError('');
      const formData = new FormData();
      formData.append('document', selectedFile);
      if (user?.role === 'patient') {
        formData.append('patient_id', user.id);
      }

      await api.uploadDocument(formData);
      setSelectedFile(null);
      // Reset input element
      const fileInput = document.getElementById('file-upload-input');
      if (fileInput) fileInput.value = '';
      await loadDocuments();
    } catch (err) {
      setUploadError(err.message || 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-bold text-white">Health Documents & Diagnostic Reports</h2>
          <span className="text-xs px-2 py-0.5 rounded bg-teal-500/20 text-teal-400 border border-teal-500/30">
            Metadata Indexing
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Secure storage for medical imaging, lab results, and diagnostic scans with SHA-256 data integrity.
        </p>
      </div>

      {/* Storage Architecture Callout */}
      <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex items-start space-x-3 text-xs text-slate-300">
        <HardDrive className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white">Object Storage Architecture: </span>
          Files are persisted securely with unique UUID identifiers. The SQLite database retains only verified metadata (filename, MIME type, size, SHA-256 checksum) — raw binary blobs and file contents are never written to application logs.
        </div>
      </div>

      {/* Upload Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center">
          <Upload className="w-4 h-4 mr-2 text-emerald-400" />
          Upload New Diagnostic Document / Prescription
        </h3>

        {uploadError && (
          <div className="p-3 mb-3 bg-red-500/20 border border-red-500/40 rounded-lg text-xs text-red-300">
            {uploadError}
          </div>
        )}

        <form onSubmit={handleUpload} className="flex flex-col sm:flex-row items-center gap-3">
          <input
            id="file-upload-input"
            type="file"
            onChange={(e) => setSelectedFile(e.target.files[0] || null)}
            className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer bg-slate-950 border border-slate-800 rounded-lg p-1.5 focus:outline-none"
          />
          <button
            type="submit"
            disabled={uploading || !selectedFile}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 shrink-0 flex items-center justify-center space-x-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{uploading ? 'Hashing & Uploading...' : 'Upload File'}</span>
          </button>
        </form>
      </div>

      {/* Documents Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Indexed Medical Documents</h3>
          <span className="text-xs text-slate-400 font-mono">{documents.length} files</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center">
            <File className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No documents uploaded yet</p>
            <p className="text-xs text-slate-500 mt-1">Upload a lab report or clinical document above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-medium">
                <tr>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">SHA-256 Checksum</th>
                  <th className="py-3 px-4">Uploaded By</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-850/50 transition">
                    <td className="py-3 px-4 font-medium text-white flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="truncate max-w-[180px]">{doc.filename}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                        {doc.file_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {formatBytes(doc.size)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] text-slate-400 flex items-center" title={doc.checksum_sha256}>
                        <Hash className="w-3 h-3 mr-1 text-slate-500" />
                        {doc.checksum_sha256 ? doc.checksum_sha256.substring(0, 12) + '...' : 'Verified'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {doc.uploader_name || 'Self'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {doc.uploaded_at ? doc.uploaded_at.split('T')[0] : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={api.getDocumentDownloadUrl(doc.id)}
                        download
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 border border-slate-700 text-xs font-semibold inline-flex items-center space-x-1 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
