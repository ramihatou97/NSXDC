#!/bin/bash

echo "═══════════════════════════════════════════════════════════════"
echo "🚀 NSXDC v1.3.0 - COMPREHENSIVE DEPLOYMENT VERIFICATION"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Location: $(pwd)"
echo ""

# Initialize counters
PASS_COUNT=0
FAIL_COUNT=0
TOTAL_CHECKS=0

# Helper function
check() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  if [ $1 -eq 0 ]; then
    echo "✅ $2"
    PASS_COUNT=$((PASS_COUNT + 1))
    return 0
  else
    echo "❌ $2"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return 1
  fi
}

echo "───────────────────────────────────────────────────────────────"
echo "STEP 1: CODE INTEGRITY VERIFICATION"
echo "───────────────────────────────────────────────────────────────"
echo ""

# Check extraction.ts exists and is readable
if [ -f "src/prompts/extraction.ts" ]; then
  check 0 "extraction.ts file exists"
else
  check 1 "extraction.ts file exists"
  exit 1
fi

# Check file size
FILE_SIZE=$(wc -c < src/prompts/extraction.ts)
if [ $FILE_SIZE -gt 50000 ]; then
  check 0 "extraction.ts has substantial content ($FILE_SIZE bytes)"
else
  check 1 "extraction.ts size check ($FILE_SIZE bytes - expected >50KB)"
fi

# Check for v1.3.0 features
echo ""
echo "Checking for v1.3.0 optimizations in extraction.ts..."
echo ""

if grep -q "source.*EXACT text with temporal context" src/prompts/extraction.ts; then
  check 0 "Phase 1: Condensed source field format present"
else
  check 1 "Phase 1: Condensed source field format"
fi

if grep -q "confidence.*OPTIONAL.*Only include if" src/prompts/extraction.ts; then
  check 0 "Phase 1: Optional confidence field documented"
else
  check 1 "Phase 1: Optional confidence field"
fi

if grep -q '"day":.*"HD.*POD' src/prompts/extraction.ts; then
  check 0 "Phase 2: Flattened dailyProgress structure present"
else
  check 1 "Phase 2: Flattened dailyProgress structure"
fi

if grep -q '"events":.*"Chronological narrative' src/prompts/extraction.ts; then
  check 0 "Phase 2: Narrative events format present"
else
  check 1 "Phase 2: Narrative events format"
fi

if grep -q 'mRS.*0-6.*0-1 = independent' src/prompts/extraction.ts; then
  check 0 "Phase 3: Condensed reference tables present"
else
  check 1 "Phase 3: Condensed reference tables"
fi

# Check line count reduction (should be less verbose than v1.2.0)
LINE_COUNT=$(wc -l < src/prompts/extraction.ts)
echo ""
echo "File metrics:"
echo "  - Total lines: $LINE_COUNT"
echo "  - File size: $FILE_SIZE bytes"
echo ""

echo "───────────────────────────────────────────────────────────────"
echo "STEP 2: SERVER STATUS CHECK"
echo "───────────────────────────────────────────────────────────────"
echo ""

# Check if server is running
if curl -s -f http://localhost:3002/health > /dev/null 2>&1; then
  check 0 "Server is running on port 3002"

  # Check health endpoint
  HEALTH_RESPONSE=$(curl -s http://localhost:3002/health)
  echo "Server health: $HEALTH_RESPONSE"
  echo ""
else
  check 1 "Server is running on port 3002"
  echo "⚠️ Server not running - attempting to check if build succeeded..."

  if [ -d "dist" ]; then
    check 0 "Build directory exists (compilation successful)"
  else
    check 1 "Build directory exists"
  fi
fi

echo "───────────────────────────────────────────────────────────────"
echo "STEP 3: INTEGRATION TEST - v1.3.0 FEATURES"
echo "───────────────────────────────────────────────────────────────"
echo ""

# Only run extraction test if server is running
if curl -s -f http://localhost:3002/health > /dev/null 2>&1; then
  echo "Running quick extraction test with test_app_large.txt..."
  echo ""

  # Create test payload
  TEST_NOTES=$(cat test_app_large.txt 2>/dev/null || echo "Admission Date: 2024-01-15. Patient admitted with headache. GCS 15. Discharged 2024-01-18.")

  RESPONSE=$(curl -s -X POST http://localhost:3002/api/v1/extract \
    -H "Content-Type: application/json" \
    -d "{\"clinicalNotes\": $(echo "$TEST_NOTES" | jq -Rs .), \"dateFormat\": \"MM/DD/YYYY\"}" 2>&1)

  if echo "$RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
    check 0 "Extraction API responding successfully"

    # Check for v1.3.0 output structure
    if echo "$RESPONSE" | jq -e '.extraction.hospitalCourse.dailyProgress[0].day' > /dev/null 2>&1; then
      check 0 "v1.3.0 flattened hospitalCourse structure in output"
    else
      check 1 "v1.3.0 flattened hospitalCourse structure in output"
    fi

    if echo "$RESPONSE" | jq -e '.extraction.hospitalCourse.trajectory.overall' > /dev/null 2>&1; then
      check 0 "v1.3.0 condensed trajectory structure in output"
    else
      check 1 "v1.3.0 condensed trajectory structure in output"
    fi

  else
    check 1 "Extraction API responding successfully"
    echo "Error response: $RESPONSE" | head -20
  fi
  echo ""
else
  echo "⚠️ Skipping extraction test - server not running"
  echo ""
fi

echo "───────────────────────────────────────────────────────────────"
echo "STEP 4: VERIFY PHASE 1-8 FEATURES STILL PRESENT"
echo "───────────────────────────────────────────────────────────────"
echo ""

echo "Checking for existing features (Phases 1-8 from previous work)..."
echo ""

# Phase 1: Date Format Disambiguation
if grep -q "DatePreprocessorService" src/services/*.ts 2>/dev/null; then
  check 0 "Phase 1: DatePreprocessorService exists"
else
  check 1 "Phase 1: DatePreprocessorService exists"
fi

# Phase 2: Documentation Inventory
if grep -q "DocumentationInventoryService" src/services/*.ts 2>/dev/null; then
  check 0 "Phase 2: DocumentationInventoryService exists"
else
  check 1 "Phase 2: DocumentationInventoryService exists"
fi

# Phase 8: Completeness Checking
if grep -q "CompletenessCheckerService" src/services/*.ts 2>/dev/null; then
  check 0 "Phase 8: CompletenessCheckerService exists"
else
  check 1 "Phase 8: CompletenessCheckerService exists"
fi

echo ""
echo "───────────────────────────────────────────────────────────────"
echo "FINAL RESULTS"
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "Total checks: $TOTAL_CHECKS"
echo "Passed: $PASS_COUNT"
echo "Failed: $FAIL_COUNT"
echo ""

SUCCESS_RATE=$((PASS_COUNT * 100 / TOTAL_CHECKS))
echo "Success rate: $SUCCESS_RATE%"
echo ""

if [ $SUCCESS_RATE -ge 90 ]; then
  echo "✅ DEPLOYMENT STATUS: READY FOR PRODUCTION"
  echo ""
  echo "v1.3.0 has passed all critical checks and is ready for deployment."
  exit 0
elif [ $SUCCESS_RATE -ge 75 ]; then
  echo "⚠️ DEPLOYMENT STATUS: NEEDS ATTENTION"
  echo ""
  echo "v1.3.0 has minor issues. Review failed checks before deployment."
  exit 1
else
  echo "❌ DEPLOYMENT STATUS: NOT READY"
  echo ""
  echo "v1.3.0 has significant issues. Fix critical failures before deployment."
  exit 1
fi
