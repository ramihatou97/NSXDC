import { ExtractionResult } from '../App';
import ConfidenceIndicator from './ConfidenceIndicator';
import ValidationWarnings from './ValidationWarnings';
import ExtractedData from './ExtractedData';
import './ResultsPanel.css';

interface ResultsPanelProps {
  result: ExtractionResult;
  onClose: () => void;
}

export default function ResultsPanel({ result, onClose }: ResultsPanelProps) {
  const overallConfidence = result.validation?.overallConfidence || 
                           result.confidence?.score || 
                           0;

  return (
    <div className="panel results-panel fade-in">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Extraction Results</h2>
          <p className="panel-subtitle">Validated medical data extraction</p>
        </div>
        <button className="btn-close" onClick={onClose} title="Close results">
          ✕
        </button>
      </div>

      {/* Overall Confidence Score */}
      <div className="confidence-section">
        <h3 className="section-title">Overall Confidence</h3>
        <ConfidenceIndicator 
          score={overallConfidence}
          level={result.confidence?.level}
        />
      </div>

      {/* Validation Warnings */}
      {result.warnings && result.warnings.length > 0 && (
        <ValidationWarnings warnings={result.warnings} />
      )}

      {/* Confidence Factors */}
      {result.confidence?.factors && (
        <div className="factors-section">
          <h3 className="section-title">Confidence Factors</h3>
          <div className="factors-grid">
            {Object.entries(result.confidence.factors).map(([factor, score]) => (
              <div key={factor} className="factor-item">
                <div className="factor-label">
                  {formatFactorName(factor)}
                </div>
                <div className="factor-bar">
                  <div 
                    className="factor-fill"
                    style={{ 
                      width: `${score * 100}%`,
                      background: getScoreColor(score)
                    }}
                  />
                </div>
                <div className="factor-score">
                  {(score * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uncertainties */}
      {result.confidence?.uncertainties && result.confidence.uncertainties.length > 0 && (
        <div className="uncertainties-section">
          <h3 className="section-title">⚠️ Uncertainties Identified</h3>
          <ul className="uncertainties-list">
            {result.confidence.uncertainties.map((uncertainty, idx) => (
              <li key={idx}>{uncertainty}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {result.confidence?.recommendations && result.confidence.recommendations.length > 0 && (
        <div className="recommendations-section">
          <h3 className="section-title">💡 Recommendations</h3>
          <ul className="recommendations-list">
            {result.confidence.recommendations.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {/* DISCHARGE SUMMARY NARRATIVE - THE CORE DELIVERABLE */}
      {result.narrative && (
        <div className="narrative-section">
          <div className="narrative-header">
            <h3 className="section-title">📄 Neurosurgical Discharge Summary</h3>
            <button 
              className="btn-copy-narrative"
              onClick={() => {
                navigator.clipboard.writeText(result.narrative || '');
                alert('Discharge summary copied to clipboard!');
              }}
              title="Copy discharge summary"
            >
              📋 Copy
            </button>
          </div>
          <div className="narrative-content">
            {result.narrative.split('\n').map((line: string, idx: number) => (
              <p key={idx}>{line}</p>
            ))}
          </div>
        </div>
      )}

      {/* Extracted Data (Technical Details) */}
      <div className="extracted-data-section">
        <div className="section-header-with-badge">
          <h3 className="section-title">🔍 Extracted Data (Technical Details)</h3>
          <span className="badge-secondary">Raw extraction for validation</span>
        </div>
        <ExtractedData data={result.extraction} />
      </div>

      {/* Export Options */}
      <div className="export-section">
        <button 
          className="btn btn-secondary"
          onClick={() => downloadJSON(result)}
        >
          <span>💾</span> Download JSON
        </button>
        <button 
          className="btn btn-secondary"
          onClick={() => copyToClipboard(result)}
        >
          <span>📋</span> Copy to Clipboard
        </button>
      </div>
    </div>
  );
}

function formatFactorName(factor: string): string {
  return factor
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function getScoreColor(score: number): string {
  if (score >= 0.75) return 'linear-gradient(90deg, #28a745, #20c997)';
  if (score >= 0.50) return 'linear-gradient(90deg, #ffc107, #fd7e14)';
  return 'linear-gradient(90deg, #dc3545, #c82333)';
}

function downloadJSON(result: ExtractionResult) {
  const dataStr = JSON.stringify(result, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `extraction-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function copyToClipboard(result: ExtractionResult) {
  const dataStr = JSON.stringify(result, null, 2);
  navigator.clipboard.writeText(dataStr).then(
    () => alert('Results copied to clipboard!'),
    () => alert('Failed to copy to clipboard')
  );
}
