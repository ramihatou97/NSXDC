import './ConfidenceIndicator.css';

interface ConfidenceIndicatorProps {
  score: number;
  level?: string;
}

export default function ConfidenceIndicator({ score, level }: ConfidenceIndicatorProps) {
  const percentage = Math.round(score * 100);
  const calculatedLevel = level || getConfidenceLevel(score);
  const color = getConfidenceColor(score);
  const emoji = getConfidenceEmoji(score);

  return (
    <div className="confidence-indicator">
      <div className="confidence-visual">
        <svg className="confidence-circle" viewBox="0 0 200 200">
          <circle
            className="confidence-bg"
            cx="100"
            cy="100"
            r="85"
            fill="none"
            stroke="#e9ecef"
            strokeWidth="20"
          />
          <circle
            className="confidence-progress"
            cx="100"
            cy="100"
            r="85"
            fill="none"
            stroke={color}
            strokeWidth="20"
            strokeLinecap="round"
            strokeDasharray={`${534 * score} 534`}
            transform="rotate(-90 100 100)"
          />
        </svg>
        <div className="confidence-content">
          <div className="confidence-emoji">{emoji}</div>
          <div className="confidence-percentage">{percentage}%</div>
          <div className="confidence-level" style={{ color }}>
            {calculatedLevel.toUpperCase()}
          </div>
        </div>
      </div>
      <div className="confidence-description">
        <p>{getConfidenceDescription(score)}</p>
      </div>
    </div>
  );
}

function getConfidenceLevel(score: number): string {
  if (score >= 0.95) return 'critical';
  if (score >= 0.75) return 'high';
  if (score >= 0.50) return 'medium';
  if (score >= 0.30) return 'low';
  return 'very-low';
}

function getConfidenceColor(score: number): string {
  if (score >= 0.75) return '#28a745';
  if (score >= 0.50) return '#ffc107';
  return '#dc3545';
}

function getConfidenceEmoji(score: number): string {
  if (score >= 0.95) return '🎯';
  if (score >= 0.75) return '✅';
  if (score >= 0.50) return '⚠️';
  return '❌';
}

function getConfidenceDescription(score: number): string {
  if (score >= 0.95) {
    return 'Excellent confidence. Data extracted from high-quality sources with comprehensive validation.';
  }
  if (score >= 0.75) {
    return 'High confidence. Data well-documented with good source quality and validation.';
  }
  if (score >= 0.50) {
    return 'Medium confidence. Some uncertainties present. Review warnings and recommendations.';
  }
  if (score >= 0.30) {
    return 'Low confidence. Significant uncertainties. Manual review strongly recommended.';
  }
  return 'Very low confidence. Critical concerns identified. Manual verification required.';
}
