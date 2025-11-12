import './Header.css';

export default function Header() {
  return (
    <header className="app-header">
      <div className="container">
        <div className="header-content">
          <div className="header-left">
            <h1 className="header-title">
              NSXDC
              <span className="version-badge">v1.0</span>
            </h1>
            <p className="header-subtitle">
              Neurosurgical Discharge Summarizer - eXtended & Distributed Core
            </p>
          </div>
          <div className="header-right">
            <div className="validation-badge">
              <span className="badge-icon">✓</span>
              <span className="badge-text">Always-ON Validation</span>
            </div>
          </div>
        </div>
        <div className="header-info">
          <div className="info-item">
            <span className="info-icon">🧠</span>
            <span className="info-text">Medical Intelligence Layer</span>
          </div>
          <div className="info-item">
            <span className="info-icon">📊</span>
            <span className="info-text">Multi-Factor Confidence</span>
          </div>
          <div className="info-item">
            <span className="info-icon">🔍</span>
            <span className="info-text">Terminology Validation</span>
          </div>
        </div>
      </div>
    </header>
  );
}
