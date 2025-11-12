/**
 * ProgressBar Component
 * Visual progress bar with percentage, smooth animations, and color coding
 */

import type { ProgressStage } from '../types';
import './ProgressBar.css';

interface ProgressBarProps {
  percent: number;
  stage: ProgressStage;
  message?: string;
  showPercentage?: boolean;
}

export default function ProgressBar({
  percent,
  stage,
  message,
  showPercentage = true,
}: ProgressBarProps) {
  const getProgressColor = (stage: ProgressStage): string => {
    switch (stage) {
      case 'completed':
        return '#28a745'; // Green
      case 'failed':
      case 'cancelled':
        return '#dc3545'; // Red
      case 'initializing':
      case 'date_preprocessing':
        return '#6c757d'; // Gray
      case 'extraction':
      case 'documentation_analysis':
        return '#007bff'; // Blue
      case 'pre_completeness_check':
      case 'post_completeness_check':
        return '#ffc107'; // Yellow
      case 'narrative_generation':
      case 'validation':
        return '#17a2b8'; // Teal
      case 'finalizing':
        return '#20c997'; // Green-Teal
      default:
        return '#6c757d'; // Gray
    }
  };

  const getProgressLabel = (stage: ProgressStage): string => {
    switch (stage) {
      case 'initializing':
        return 'Initializing...';
      case 'date_preprocessing':
        return 'Processing Dates...';
      case 'extraction':
        return 'Extracting Data...';
      case 'documentation_analysis':
        return 'Analyzing Documentation...';
      case 'pre_completeness_check':
        return 'Pre-Extraction Check...';
      case 'post_completeness_check':
        return 'Post-Extraction Check...';
      case 'narrative_generation':
        return 'Generating Narrative...';
      case 'validation':
        return 'Validating Results...';
      case 'finalizing':
        return 'Finalizing...';
      case 'completed':
        return 'Completed!';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Processing...';
    }
  };

  const color = getProgressColor(stage);
  const label = getProgressLabel(stage);
  const clampedPercent = Math.min(Math.max(percent, 0), 100);

  return (
    <div className="progress-bar-container">
      <div className="progress-bar-header">
        <span className="progress-label">{label}</span>
        {showPercentage && (
          <span className="progress-percentage">{clampedPercent.toFixed(0)}%</span>
        )}
      </div>

      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{
            width: `${clampedPercent}%`,
            backgroundColor: color,
            transition: 'width 0.3s ease-in-out, background-color 0.3s ease-in-out',
          }}
        >
          {clampedPercent > 10 && (
            <div className="progress-bar-shine" />
          )}
        </div>
      </div>

      {message && (
        <div className="progress-message">
          {message}
        </div>
      )}
    </div>
  );
}
