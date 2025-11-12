import { useState, useRef } from 'react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setClinicalNotes(text);
    setCharCount(text.length);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setClinicalNotes(text);
      setCharCount(text.length);
    } catch (err) {
      console.error('Error reading file:', err);
      alert('Error reading file. Please try again.');
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

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="clinicalNotes" className="form-label">
            Clinical Documentation
            <span className="char-count">
              {charCount.toLocaleString()} characters
            </span>
          </label>
          <textarea
            id="clinicalNotes"
            className="form-control"
            value={clinicalNotes}
            onChange={handleTextChange}
            placeholder="Paste clinical notes here or upload a file..."
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
