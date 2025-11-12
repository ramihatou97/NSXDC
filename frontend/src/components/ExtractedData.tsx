import { useState } from 'react';
import './ExtractedData.css';

interface ExtractedDataProps {
  data: any;
}

export default function ExtractedData({ data }: ExtractedDataProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['demographics', 'dates']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const sections = organizeSections(data);

  return (
    <div className="extracted-data">
      <h3 className="section-title">📋 Extracted Clinical Data</h3>
      <div className="data-sections">
        {Object.entries(sections).map(([sectionName, sectionData]) => (
          <div key={sectionName} className="data-section">
            <button
              className="section-toggle"
              onClick={() => toggleSection(sectionName)}
            >
              <span className="toggle-icon">
                {expandedSections.has(sectionName) ? '▼' : '▶'}
              </span>
              <span className="section-name">{formatSectionName(sectionName)}</span>
              <span className="field-count">
                {Object.keys(sectionData).length} fields
              </span>
            </button>
            {expandedSections.has(sectionName) && (
              <div className="section-content">
                {Object.entries(sectionData).map(([key, value]: [string, any]) => (
                  <div key={key} className="data-field">
                    <div className="field-label">{formatFieldName(key)}</div>
                    <div className="field-value">
                      {renderFieldValue(value)}
                    </div>
                    {value?.source && (
                      <div className="field-source">
                        <strong>Source:</strong> {value.source}
                      </div>
                    )}
                    {value?.confidence && (
                      <div className="field-confidence">
                        <span className={`confidence-badge confidence-${value.confidence}`}>
                          {value.confidence}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function organizeSections(data: any): Record<string, any> {
  const sections: Record<string, any> = {
    demographics: {},
    dates: {},
    clinical: {},
    procedures: {},
    medications: {},
    outcomes: {},
    other: {},
  };

  for (const [key, value] of Object.entries(data || {})) {
    if (key.includes('Date') || key.includes('date')) {
      sections.dates[key] = value;
    } else if (key.includes('age') || key.includes('gender') || key.includes('mrn')) {
      sections.demographics[key] = value;
    } else if (key.includes('procedure') || key.includes('surgery')) {
      sections.procedures[key] = value;
    } else if (key.includes('medication') || key.includes('med')) {
      sections.medications[key] = value;
    } else if (key.includes('GCS') || key.includes('KPS') || key.includes('mRS') || key.includes('outcome')) {
      sections.outcomes[key] = value;
    } else if (key.includes('diagnosis') || key.includes('pathology') || key.includes('complication')) {
      sections.clinical[key] = value;
    } else {
      sections.other[key] = value;
    }
  }

  // Remove empty sections
  return Object.fromEntries(
    Object.entries(sections).filter(([_, data]) => Object.keys(data).length > 0)
  );
}

function formatSectionName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function formatFieldName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function renderFieldValue(value: any): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="null-value">Not documented</span>;
  }

  if (typeof value === 'object' && value.value !== undefined) {
    return renderFieldValue(value.value);
  }

  if (Array.isArray(value)) {
    return (
      <ul className="array-value">
        {value.map((item, idx) => (
          <li key={idx}>{renderFieldValue(item)}</li>
        ))}
      </ul>
    );
  }

  if (typeof value === 'object') {
    return (
      <pre className="object-value">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  return <span>{String(value)}</span>;
}
