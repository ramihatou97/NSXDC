import { useState, useRef, DragEvent } from 'react';
import './ExtractionPanel.css';

interface ExtractionPanelProps {
  onExtract: (clinicalNotes: string) => Promise<void>;
  onClear: () => void;
  isLoading: boolean;
  error: string | null;
}

export default function ExtractionPanel({
  onExtract,
  onClear,
  isLoading,
  error,
}: ExtractionPanelProps) {
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File size limit: 5MB
  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setClinicalNotes(text);
    setCharCount(text.length);
    setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
  };

  const processFileContent = (text: string, _filename: string) => {
    setClinicalNotes(text);
    setCharCount(text.length);
    setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
    setFileError(null);
  };

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 5MB.`;
    }

    // Check file type
    const allowedTypes = ['.txt', '.md', '.text'];
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(fileExt)) {
      return `Unsupported file type "${fileExt}". Please use .txt or .md files.`;
    }

    return null;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setFileError(validationError);
      return;
    }

    try {
      const text = await file.text();
      processFileContent(text, file.name);
    } catch (err) {
      setFileError('Error reading file. Please try again.');
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setFileError(validationError);
      return;
    }

    try {
      const text = await file.text();
      processFileContent(text, file.name);
    } catch (err) {
      setFileError('Error reading file. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicalNotes.trim()) {
      alert('Please enter clinical notes');
      return;
    }
    await onExtract(clinicalNotes);
  };

  const handleClear = () => {
    setClinicalNotes('');
    setCharCount(0);
    onClear();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const loadSampleNotes = () => {
    const sample = `ADMISSION DATE: 2024-01-15
SURGERY DATE: 2024-01-16
DISCHARGE DATE: 2024-01-21

PROCEDURE: Left frontal craniotomy for tumor resection

DIAGNOSIS: Left frontal glioblastoma, WHO grade IV

CLINICAL COURSE:
45-year-old patient with new-onset seizures and headaches. MRI revealed a 4.5cm enhancing mass in the left frontal lobe. Patient underwent successful craniotomy with gross total resection.

POST-OPERATIVE COURSE:
- POD 1: Alert, GCS 15, following commands, moving all extremities 5/5
- POD 2: Ambulating with assistance, tolerating regular diet
- POD 3: Independent ambulation, no neurological deficits
- POD 4: Staples removed, wound healing well
- POD 5: Cleared for discharge

DISCHARGE EXAM:
- Mental Status: Alert and oriented x3
- Motor: 5/5 strength all extremities
- Sensory: Intact to light touch
- Gait: Steady, independent
- Wound: Clean, dry, intact

DISCHARGE MEDICATIONS:
- Levetiracetam 750mg PO BID (seizure prophylaxis)
- Dexamethasone 4mg PO Q12H x 7 days then taper
- Acetaminophen 650mg PO Q6H PRN pain
- Docusate 100mg PO BID

FOLLOW-UP:
- Neurosurgery clinic in 2 weeks
- Oncology for treatment planning
- Pathology: High-grade glioma, WHO grade IV, IDH-wildtype`;

    setClinicalNotes(sample);
    setCharCount(sample.length);
    setWordCount(sample.trim().split(/\s+/).length);
  };

  return (
    <div className="panel extraction-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Clinical Notes</h2>
          <p className="panel-subtitle">Enter or upload patient discharge notes</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {fileError && (
        <div className="alert alert-error">
          <strong>File Error:</strong> {fileError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Drag and Drop Zone */}
        <div
          className={`drag-drop-zone ${isDragging ? 'dragging' : ''} ${clinicalNotes ? 'has-content' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {!clinicalNotes && (
            <div className="drag-drop-placeholder">
              <div className="drag-drop-icon">📄</div>
              <div className="drag-drop-text">
                <strong>Drag and drop</strong> your clinical notes here
              </div>
              <div className="drag-drop-subtext">
                or click "Upload File" below
              </div>
              <div className="drag-drop-formats">
                Supported formats: .txt, .md (max 5MB)
              </div>
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="clinicalNotes" className="form-label">
            Clinical Documentation
            <span className="stats-count">
              {charCount.toLocaleString()} chars · {wordCount.toLocaleString()} words
            </span>
          </label>
          <textarea
            id="clinicalNotes"
            className="form-control"
            value={clinicalNotes}
            onChange={handleTextChange}
            placeholder="Paste clinical notes here, drag and drop a file, or use upload button..."
            disabled={isLoading}
          />
        </div>

        <div className="action-buttons">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            <span>📁</span> Upload File
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadSampleNotes}
            disabled={isLoading}
          >
            <span>📄</span> Load Sample
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleClear}
            disabled={isLoading}
          >
            <span>🗑️</span> Clear
          </button>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading || !clinicalNotes.trim()}
          >
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                Processing...
              </>
            ) : (
              <>
                <span>🚀</span> Extract Data
              </>
            )}
          </button>
        </div>
      </form>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      <div className="info-box">
        <h4>💡 Tips:</h4>
        <ul>
          <li>Include admission, surgery, and discharge dates</li>
          <li>Document procedures, diagnoses, and medications</li>
          <li>Provide clinical exam findings and functional status</li>
          <li>More detail = higher confidence scores</li>
        </ul>
      </div>
    </div>
  );
}
