# NSXDC v1.0 - Neurosurgical Summarizer (eXtended & Distributed Core)

**Always-ON Validation | Zero-Hallucination Clinical Data Extraction**

NSXDC is a production-ready clinical data extraction and discharge summary generation system with **enforced validation**. Built specifically for neurosurgical use cases, NSXDC ensures maximum accuracy through mandatory VALIDATED extraction mode and quality assurance validation layers that cannot be disabled.

---

## 🔒 What Makes NSXDC Unique

Unlike traditional extraction systems where validation is optional, NSXDC **enforces** quality assurance at every level:

1. **VALIDATED Mode (LOCKED)**: Every extraction includes confidence levels, grounded source quotes, and warnings
2. **QA Validation Layer (ALWAYS ON)**: Independent validation step that catches hallucinations, temporal errors, and medical logic issues
3. **Multi-Layer Enforcement**: Cannot be disabled via environment variables, API calls, or UI controls
4. **Zero-Hallucination Architecture**: Every extracted value must have a verbatim source quote from the original notes

### Enforcement Mechanisms

- **Configuration Level**: `getOrchestratorConfig()` ignores attempts to disable validation
- **Service Level**: `OrchestratorService` constructor logs enforcement, always runs validation step
- **API Level**: `/api/v1/extract` endpoint forces `mode: 'VALIDATED'` and `includeValidation: true`
- **UI Level**: No controls to disable validation; locked badges indicate enforcement

---

## ✨ Features

### Core Capabilities
- **VALIDATED Extraction Mode**: Extracts structured clinical data with confidence levels and grounding
- **Discharge Status Deduction**: Safe inference of functional scores (GCS, KPS, mRS) from clinical findings
- **Narrative Generation**: Three modes (STRICT, STANDARD, ENHANCED) for discharge summaries
- **QA Validation Layer**: Comprehensive validation with 6 categories:
  - Grounding Verification (critical)
  - Temporal Coherence (critical)
  - Medical Coherence (critical)
  - Discharge Status Validation (critical)
  - Mode Compliance (major)
  - Completeness (major)
- **Interactive Validation Dashboard**: UI with clickable action buttons for each validation issue
- **Prompt Caching**: Anthropic's ephemeral caching for performance optimization

### Technical Features
- **TypeScript**: Full type safety with strict mode enabled
- **Express 5.1**: Modern Node.js web framework
- **Claude Sonnet 4.5**: Latest Anthropic model (claude-sonnet-4-5-20250929)
- **Exponential Backoff**: Retry logic with automatic recovery from API failures
- **JSON Repair**: Handles malformed JSON responses using jsonrepair library
- **Graceful Shutdown**: Proper SIGTERM/SIGINT handling
- **Comprehensive Logging**: Request tracking, token usage, processing time

---

## 📦 Installation

### Prerequisites
- Node.js 18+ (recommended: 20+)
- npm or yarn
- Anthropic API key

### Setup

1. **Clone or navigate to NSXDC directory**:
   ```bash
   cd /Users/ramihatoum/Desktop/NSXDC
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` and add your API key**:
   ```env
   ANTHROPIC_API_KEY=your_api_key_here
   PORT=3002
   NODE_ENV=development
   MODEL=claude-sonnet-4-5-20250929
   ENABLE_CACHING=true
   FORCE_VALIDATED_MODE=true    # Cannot be disabled
   FORCE_VALIDATION=true         # Cannot be disabled
   ```

5. **Build TypeScript**:
   ```bash
   npm run build
   ```

---

## 🚀 Usage

### Development Mode
```bash
npm run dev
```

Server starts at: `http://localhost:3002`

### Production Mode
```bash
npm start
```

### Access the UI
Open browser to: `http://localhost:3002`

### Health Check
```bash
curl http://localhost:3002/health
```

---

## 📡 API Endpoints

### `POST /api/v1/extract`

Main extraction endpoint. Always runs in VALIDATED mode with QA validation.

**Request Body**:
```json
{
  "clinicalNotes": "string (required, min 50 chars)",
  "narrativeMode": "STRICT" | "STANDARD" | "ENHANCED" (optional),
  "mode": "VALIDATED",           // Enforced, ignored if different
  "includeValidation": true      // Enforced, always true
}
```

**Response**:
```json
{
  "success": true,
  "extraction": {
    "demographics": {...},
    "admissionDate": {...},
    "procedures": [...],
    "dischargeStatus": {...}
  },
  "narrative": "string (if narrativeMode specified)",
  "validation": {
    "passed": true/false,
    "score": 0-100,
    "issues": [
      {
        "severity": "critical" | "major" | "minor",
        "category": "grounding" | "temporal" | "medical" | "mode" | "completeness",
        "message": "string",
        "location": "string",
        "suggestedFix": "string"
      }
    ]
  },
  "metadata": {
    "extractionMode": "VALIDATED",
    "modelUsed": "claude-sonnet-4-5-20250929",
    "processingTime": 5432,
    "tokenCount": {...}
  }
}
```

### `GET /api/v1/version`
Returns version and configuration info.

### `GET /api/v1/config`
Returns current configuration (shows validation enforcement).

### `GET /health`
Health check endpoint with features list.

---

## 🏗️ Architecture

```
NSXDC/
├── src/
│   ├── api/
│   │   └── server.ts              # Express server
│   ├── services/
│   │   ├── llm.service.ts         # Anthropic API client
│   │   └── orchestrator.service.ts # Main pipeline coordinator
│   ├── prompts/
│   │   ├── extraction.ts          # VALIDATED mode extraction prompt
│   │   ├── narrative.ts           # Narrative generation prompt
│   │   └── validation.ts          # QA validation prompt
│   ├── types/
│   │   └── index.ts               # TypeScript type definitions
│   └── config/
│       └── index.ts               # Configuration with enforcement
├── public/
│   └── index.html                 # Enhanced frontend UI
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

### Data Flow

1. **User Input** → Clinical notes via UI or API
2. **Extraction Step** → LLM extracts structured data (VALIDATED mode)
   - Every value has sourceQuote, confidence, optional deductionMethod
   - Discharge status can be safely deduced from clinical findings
3. **Narrative Step** (optional) → LLM generates discharge summary
4. **Validation Step** (ALWAYS) → Independent QA validation
   - Checks grounding (sourceQuote exists verbatim)
   - Validates temporal logic (dates, timelines)
   - Validates medical logic (procedures, scores, coherence)
   - Scores 0-100 (deduct 20 per critical, 5 per major, 1 per minor)
5. **Response** → Combined result with extraction, narrative, validation

---

## 🔐 Validation System

### Validation Categories

| Category | Severity | What It Checks |
|----------|----------|----------------|
| **Grounding Verification** | CRITICAL | sourceQuote exists verbatim in notes |
| **Temporal Coherence** | CRITICAL | Dates chronological, calculations correct |
| **Medical Coherence** | CRITICAL | Procedures match pathology, scores valid |
| **Discharge Status** | CRITICAL | Deductions grounded in actual findings |
| **Mode Compliance** | MAJOR | Confidence levels appropriate |
| **Completeness** | MAJOR | Key fields present |

### Scoring System

- **Start at 100 points**
- **Deduct 20 points** per CRITICAL issue
- **Deduct 5 points** per MAJOR issue
- **Deduct 1 point** per MINOR issue
- **Minimum: 0 points**

**Validation passes if**:
- Score ≥ 80 **AND**
- Zero CRITICAL issues

### Interactive Dashboard

The UI includes an interactive validation dashboard that:
- Shows quality alerts when issues are found
- Displays individual issue cards with severity, category, location
- Provides action buttons for each issue:
  - 📝 Mark for Review
  - ✅ Accept As-Is
  - 🔄 Re-Extract Field
  - 🚫 Ignore Issue
- Tracks resolution status
- Shows summary when all issues addressed

---

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description | Can Be Disabled? |
|----------|---------|-------------|------------------|
| `ANTHROPIC_API_KEY` | - | Anthropic API key (required) | N/A |
| `PORT` | 3002 | Server port | ✅ Yes |
| `NODE_ENV` | development | Environment (development/production) | ✅ Yes |
| `MODEL` | claude-sonnet-4-5-20250929 | Claude model ID | ✅ Yes |
| `ENABLE_CACHING` | true | Prompt caching | ✅ Yes |
| `FORCE_VALIDATED_MODE` | true | **VALIDATED mode enforcement** | ❌ **NO** |
| `FORCE_VALIDATION` | true | **QA validation enforcement** | ❌ **NO** |

**Important**: Setting `FORCE_VALIDATED_MODE=false` or `FORCE_VALIDATION=false` will be **ignored** with a warning logged. These settings are **locked** for safety.

---

## 🧪 Testing

### Manual Testing

1. **Start server**:
   ```bash
   npm run dev
   ```

2. **Open UI**: `http://localhost:3002`

3. **Paste sample notes**:
   ```
   Patient: 54F admitted 2024-01-15 with headaches
   Imaging: MRI brain showing 3.2cm left frontal meningioma
   Surgery: Left frontal craniotomy 2024-01-16
   Pathology: WHO Grade I meningioma
   Course: POD 5 - ambulating independently, no deficits
   Discharge: 2024-01-21, follow-up 2 weeks
   ```

4. **Click "Extract & Summarize"**

5. **Review results** across all tabs (Narrative, Extraction, Validation, Raw JSON)

### API Testing

```bash
curl -X POST http://localhost:3002/api/v1/extract \
  -H "Content-Type: application/json" \
  -d '{
    "clinicalNotes": "Patient: 54F admitted 2024-01-15 with headaches. MRI brain showing 3.2cm left frontal meningioma. Surgery: Left frontal craniotomy 2024-01-16. Pathology: WHO Grade I meningioma. Course: POD 5 - ambulating independently, no deficits. Discharge: 2024-01-21, follow-up 2 weeks.",
    "narrativeMode": "STANDARD"
  }'
```

---

## 🎯 Use Cases

### 1. Clinical Documentation
Generate structured discharge summaries from clinical notes with guaranteed grounding.

### 2. Quality Assurance
Validate existing discharge summaries for hallucinations and errors.

### 3. Research Data Extraction
Extract structured clinical data for research with full provenance tracking.

### 4. Compliance Auditing
Audit clinical documentation for completeness and accuracy.

---

## 🛠️ Development

### Project Structure Principles

1. **Separation of Concerns**: Services, prompts, types, config in separate directories
2. **Type Safety**: All functions and data structures fully typed
3. **Enforcement by Design**: Validation cannot be disabled at any layer
4. **Fail-Safe Defaults**: Configuration defaults to maximum safety
5. **Comprehensive Logging**: Every step logged for debugging and audit

### Adding New Features

When adding features to NSXDC:

1. **Never compromise validation enforcement** - It's the core principle
2. **Maintain grounded value structure** - Every extracted value needs sourceQuote
3. **Add validation checks** - Update `validation.ts` prompt if needed
4. **Preserve type safety** - Update types in `src/types/index.ts`
5. **Log enforcement** - Make enforcement visible in logs

---

## 📊 Performance

- **Average extraction time**: 5-15 seconds (varies with note length)
- **Token usage**: Typically 2000-5000 input, 1000-3000 output tokens
- **Caching benefit**: 50-70% reduction on repeated similar requests
- **Concurrent requests**: Supports multiple simultaneous extractions

---

## 🔍 Troubleshooting

### Server won't start
- **Check ANTHROPIC_API_KEY**: Ensure it's set in `.env`
- **Port already in use**: Change `PORT` in `.env` or kill process on 3002
- **Dependencies missing**: Run `npm install`

### Validation always failing
- **Check source notes quality**: Very short notes may fail completeness checks
- **Review validation tab**: See specific issues and suggested fixes
- **Check console logs**: Server logs show detailed validation results

### Slow performance
- **Enable caching**: Set `ENABLE_CACHING=true` in `.env`
- **Check API rate limits**: Anthropic has rate limits on API usage
- **Reduce note size**: Very long notes (>10K chars) take longer

### Cannot disable validation
- **This is by design**: Validation enforcement is a core feature of NSXDC
- **Use DiSC V5.0**: If you need optional validation, use the original DiSC system

---

## 🔄 Differences from DiSC V5.0

NSXDC is built from DiSC V5.0 but with critical architectural differences:

| Feature | DiSC V5.0 | NSXDC v1.0 |
|---------|-----------|------------|
| **Extraction Mode** | User selectable (PURE/DEDUCTION/VALIDATED) | **Locked to VALIDATED** |
| **QA Validation** | Optional checkbox | **Always ON (enforced)** |
| **Configuration** | Can be disabled via .env | **Enforcement at config layer** |
| **API Flexibility** | Accepts any mode | **Forces VALIDATED** |
| **UI Controls** | Full control panel | **Locked settings only** |
| **Port** | 3001 | 3002 |
| **Use Case** | Development, experimentation | **Production, clinical use** |

**When to use NSXDC**: Production clinical use, compliance requirements, research data
**When to use DiSC V5.0**: Development, testing, experimentation

---

## 📝 License

Proprietary - Internal Use Only

---

## 🤝 Support

For issues, questions, or feature requests, contact the development team.

---

## 🔮 Future Enhancements

- [ ] Multi-language support (Spanish, French, etc.)
- [ ] Batch processing API endpoint
- [ ] WebSocket support for real-time progress
- [ ] Export to EHR formats (HL7, FHIR)
- [ ] Audit log persistence
- [ ] Role-based access control (RBAC)
- [ ] Custom validation rules configuration

---

**Built with ❤️ for neurosurgical clinical excellence**

**Version**: 1.0.0
**Last Updated**: 2025-01-10
