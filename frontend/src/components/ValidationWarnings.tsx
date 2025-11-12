import './ValidationWarnings.css';

interface ValidationWarningsProps {
  warnings: string[];
}

export default function ValidationWarnings({ warnings }: ValidationWarningsProps) {
  return (
    <div className="validation-warnings">
      <h3 className="warnings-title">
        <span className="warning-icon">⚠️</span>
        Validation Warnings
      </h3>
      <ul className="warnings-list">
        {warnings.map((warning, idx) => (
          <li key={idx} className="warning-item">
            {warning}
          </li>
        ))}
      </ul>
    </div>
  );
}
