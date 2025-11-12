#!/bin/bash

# Phase 1 Date Format Testing Script
# Tests the DD/MM/YYYY vs MM/DD/YYYY disambiguation improvements

echo "═══════════════════════════════════════════════════════════════"
echo "🧪 PHASE 1 DATE FORMAT TESTING"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Testing with real clinical notes from Hamilton General Hospital"
echo "Document contains ambiguous dates: 1/8/2025, 10/10/25, 11/10/25, etc."
echo ""

# Read the clinical notes
CLINICAL_NOTES=$(cat test_clinical_notes.txt)

echo "═══════════════════════════════════════════════════════════════"
echo "TEST 1: AUTO Detection (No Hints)"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Request:"
echo '{'
echo '  "clinicalNotes": "<CLINICAL_NOTES>",
echo '  "dateFormat": "AUTO",'
echo '  "narrativeMode": "STANDARD"'
echo '}'
echo ""
echo "Expected Behavior:"
echo "  ✓ Detect unambiguous dates: 24/10/1969 (DOB), 27/10/25 (POD 17)"
echo "  ✓ Infer DD/MM/YYYY format from unambiguous dates"
echo "  ✓ Apply DD/MM/YYYY to ambiguous dates (1/8/2025 → August 1)"
echo "  ✓ Generate warnings for ambiguous dates"
echo "  ✓ Validate temporal consistency (admission < surgery < discharge)"
echo ""
echo "Running extraction..."
echo ""

curl -s -X POST http://localhost:3002/api/v1/extract \
  -H "Content-Type: application/json" \
  -d "{
    \"clinicalNotes\": $(jq -Rs . < test_clinical_notes.txt),
    \"dateFormat\": \"AUTO\",
    \"narrativeMode\": \"STANDARD\"
  }" | jq '{
    success: .success,
    datePreprocessing: .datePreprocessing,
    admissionDate: .extraction.admissionDate,
    surgeryDate: .extraction.surgeryDate,
    dischargeDate: .extraction.dischargeDate,
    validation: {
      passed: .validation.passed,
      score: .validation.score,
      dateFormatIssues: [.validation.issues[] | select(.category == "date_format" or .category == "temporal")]
    }
  }' > test1_auto_result.json

cat test1_auto_result.json

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "TEST 2: Explicit DD/MM/YYYY Format"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Request:"
echo '{'
echo '  "clinicalNotes": "<CLINICAL_NOTES>",
echo '  "dateFormat": "DD/MM/YYYY",'
echo '  "dateFormatHints": "Hamilton General Hospital, Ontario, Canada",'
echo '  "regionLocale": "CA",'
echo '  "narrativeMode": "STANDARD"'
echo '}'
echo ""
echo "Expected Behavior:"
echo "  ✓ Use DD/MM/YYYY for ALL ambiguous dates"
echo "  ✓ Higher confidence levels (medium instead of low)"
echo "  ✓ Fewer warnings (format explicitly provided)"
echo "  ✓ Correct temporal sequence"
echo ""
echo "Running extraction..."
echo ""

curl -s -X POST http://localhost:3002/api/v1/extract \
  -H "Content-Type: application/json" \
  -d "{
    \"clinicalNotes\": $(jq -Rs . < test_clinical_notes.txt),
    \"dateFormat\": \"DD/MM/YYYY\",
    \"dateFormatHints\": \"Hamilton General Hospital, Ontario, Canada\",
    \"regionLocale\": \"CA\",
    \"narrativeMode\": \"STANDARD\"
  }" | jq '{
    success: .success,
    datePreprocessing: .datePreprocessing,
    admissionDate: .extraction.admissionDate,
    surgeryDate: .extraction.surgeryDate,
    dischargeDate: .extraction.dischargeDate,
    validation: {
      passed: .validation.passed,
      score: .validation.score,
      dateFormatIssues: [.validation.issues[] | select(.category == "date_format" or .category == "temporal")]
    }
  }' > test2_explicit_result.json

cat test2_explicit_result.json

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "TEST 3: WRONG Format (MM/DD/YYYY) - Should Generate Errors"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Request:"
echo '{'
echo '  "clinicalNotes": "<CLINICAL_NOTES>",
echo '  "dateFormat": "MM/DD/YYYY",'
echo '  "dateFormatHints": "US format",'
echo '  "narrativeMode": "STANDARD"'
echo '}'
echo ""
echo "Expected Behavior:"
echo "  ❌ Misinterpret 1/8/2025 as January 8 (instead of August 1)"
echo "  ❌ Chronology violation: Surgery (October 10) AFTER initial visit (January 8)?"
echo "  ❌ CRITICAL validation error for temporal inconsistency"
echo "  ❌ Suggested fix: \"Review date format, may be DD/MM/YYYY\""
echo ""
echo "Running extraction..."
echo ""

curl -s -X POST http://localhost:3002/api/v1/extract \
  -H "Content-Type: application/json" \
  -d "{
    \"clinicalNotes\": $(jq -Rs . < test_clinical_notes.txt),
    \"dateFormat\": \"MM/DD/YYYY\",
    \"dateFormatHints\": \"US format\",
    \"narrativeMode\": \"STANDARD\"
  }" | jq '{
    success: .success,
    datePreprocessing: .datePreprocessing,
    admissionDate: .extraction.admissionDate,
    surgeryDate: .extraction.surgeryDate,
    dischargeDate: .extraction.dischargeDate,
    validation: {
      passed: .validation.passed,
      score: .validation.score,
      criticalIssues: [.validation.issues[] | select(.severity == "critical")]
    }
  }' > test3_wrong_format_result.json

cat test3_wrong_format_result.json

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "📊 SUMMARY OF PHASE 1 IMPROVEMENTS"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "✅ IMPLEMENTED:"
echo "  1. Automatic date format detection from unambiguous dates"
echo "  2. User-specified date format (DD/MM/YYYY, MM/DD/YYYY, AUTO)"
echo "  3. Region/locale hints (CA, US, UK, AU, etc.)"
echo "  4. Confidence levels for ambiguous dates (high/medium/low)"
echo "  5. Comprehensive warnings for ambiguous dates"
echo "  6. Temporal validation to catch format misinterpretation"
echo "  7. Detailed deductionMethod explaining date interpretation"
echo ""
echo "🔍 VALIDATION CHECKS:"
echo "  • Unambiguous date identification (day > 12, month names, ISO)"
echo "  • Ambiguous date flagging (both values ≤ 12)"
echo "  • Chronology validation (admission ≤ surgery ≤ discharge)"
echo "  • Warning quality (specificity, recommendations)"
echo ""
echo "Results saved to:"
echo "  - test1_auto_result.json (AUTO detection)"
echo "  - test2_explicit_result.json (Explicit DD/MM/YYYY)"
echo "  - test3_wrong_format_result.json (Wrong format → errors)"
echo ""
echo "═══════════════════════════════════════════════════════════════"
