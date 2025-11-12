# Day 9 Visual Testing Guide

## 🎯 Quick Start

1. **Start the server**:
   ```bash
   npm run dev
   ```

2. **Open browser**: `http://localhost:3002`

3. **Test the progress tracker**:
   - Paste clinical notes into the text area
   - Click "🚀 Extract & Summarize"
   - Watch the progress tracker in action!

---

## 📸 What You Should See

### 1. Initial State (Before Extraction)
```
┌─────────────────────────────────────────────────────────┐
│  Clinical Notes Text Area                               │
│  (Filled with patient data)                             │
└─────────────────────────────────────────────────────────┘
┌──────────────────────┬──────────────────────┐
│ 🚀 Extract & Summarize │ 🗑️ Clear           │
└──────────────────────┴──────────────────────┘
```

### 2. During Extraction (Progress Tracker Visible)
```
┌─────────────────────────────────────────────────────────┐
│  Clinical Notes Text Area                               │
│  (Filled with patient data)                             │
└─────────────────────────────────────────────────────────┘
┌──────────────────────┬──────────────────────┐
│ 🚀 Extract & Summarize │ 🗑️ Clear           │
│  (DISABLED)            │                      │
└──────────────────────┴──────────────────────┘

╔═════════════════════════════════════════════════════════╗
║ ⏳ Processing...                      [Cancel] Button   ║
║                                                         ║
║ ╔═════════════════════════════════════════════════════╗ ║
║ ║████████████████████░░░░░░░░░░░░░░░░░░░░░  45%       ║ ║
║ ╚═════════════════════════════════════════════════════╝ ║
║                                                         ║
║ Stage: Extraction                    ETA: 12s          ║
║                                                         ║
║ ┌─────────────┬─────────────┬─────────────┐            ║
║ │✓ Validation │✓ Preprocess │Extraction   │ (ACTIVE)  ║
║ │ (COMPLETED) │ (COMPLETED) │ (YELLOW)    │            ║
║ ├─────────────┼─────────────┼─────────────┤            ║
║ │Terminology  │ QA Check    │ Narrative   │ (PENDING)  ║
║ │ (PENDING)   │ (PENDING)   │ (PENDING)   │            ║
║ ├─────────────┼─────────────┼─────────────┤            ║
║ │Final Valid  │ Storage     │ Response    │ (PENDING)  ║
║ │ (PENDING)   │ (PENDING)   │ (PENDING)   │            ║
║ └─────────────┴─────────────┴─────────────┘            ║
╚═════════════════════════════════════════════════════════╝

⏳ Processing with VALIDATED mode + QA validation... This may take 5-15 seconds
```

### 3. Completion (All Green)
```
╔═════════════════════════════════════════════════════════╗
║ ⏳ Complete                       [Cancel] (DISABLED)   ║
║                                                         ║
║ ╔═════════════════════════════════════════════════════╗ ║
║ ║████████████████████████████████████████████ 100%    ║ ║
║ ╚═════════════════════════════════════════════════════╝ ║
║                                                         ║
║ Stage: Complete                          ETA: 0s       ║
║                                                         ║
║ ┌─────────────┬─────────────┬─────────────┐            ║
║ │✓ Validation │✓ Preprocess │✓ Extraction │ (ALL      ║
║ │ (GREEN)     │ (GREEN)     │ (GREEN)     │  GREEN)   ║
║ ├─────────────┼─────────────┼─────────────┤            ║
║ │✓ Terminology│✓ QA Check   │✓ Narrative  │            ║
║ │ (GREEN)     │ (GREEN)     │ (GREEN)     │            ║
║ ├─────────────┼─────────────┼─────────────┤            ║
║ │✓ Final Valid│✓ Storage    │✓ Response   │            ║
║ │ (GREEN)     │ (GREEN)     │ (GREEN)     │            ║
║ └─────────────┴─────────────┴─────────────┘            ║
╚═════════════════════════════════════════════════════════╝

✅ Extraction completed successfully!
```

**Note**: Progress tracker auto-hides after 2 seconds once complete.

---

## 🎨 Color Codes

### Progress Bar
- **Gradient**: Purple (#667eea) to Blue (#764ba2)
- **Text**: White, bold percentage inside bar
- **Background**: White with subtle shadow

### Stage Indicators
| State | Color | Border | Animation |
|-------|-------|--------|-----------|
| **Pending** | Gray (#dee2e6) | Gray | None |
| **Active** | Yellow (#fff3cd) | Yellow (#ffeaa7) | Pulse (1.5s) |
| **Completed** | Green (#d4edda) | Green (#c3e6cb) | None |

### Buttons
- **Extract**: Purple gradient, disabled gray when running
- **Cancel**: Red (#dc3545), hover darker red (#c82333)

---

## 🧪 Test Scenarios

### Scenario 1: Normal Extraction
1. Paste sample notes
2. Click "Extract & Summarize"
3. **Observe**:
   - Progress tracker appears immediately
   - Bar moves smoothly 0% → 100%
   - Stages transition: gray → yellow → green
   - ETA counts down from ~15s to 0s
   - Completion at 100%
   - Auto-hide after 2 seconds

### Scenario 2: Cancellation
1. Start extraction
2. Wait for progress to reach ~30-50%
3. Click "Cancel" button
4. **Observe**:
   - Confirmation dialog appears
   - Confirm cancellation
   - Progress tracker disappears
   - Status shows "❌ Extraction cancelled"

### Scenario 3: Error Handling
1. Stop the server (Ctrl+C)
2. Try to extract
3. **Observe**:
   - Progress tracker appears
   - SSE connection fails
   - Error modal appears
   - Progress tracker hides automatically

### Scenario 4: Multiple Extractions
1. Complete one extraction
2. Immediately start another
3. **Observe**:
   - Progress tracker resets to 0%
   - New job ID generated
   - Previous SSE connection closed
   - New SSE connection established

---

## 🔍 Browser DevTools Inspection

### Network Tab
1. Open DevTools (F12)
2. Go to Network tab
3. Start extraction

**What to look for**:

#### POST /api/v1/extract
- **Request Payload**: Should include `jobId` field
- **Response Headers**: Should include `Content-Encoding: gzip` (if response >1KB)
- **Response Size**: Compare "Size" vs "Transferred" (Transferred should be ~20-25% of Size)

#### GET /api/v1/progress/:jobId
- **Type**: `eventsource` (SSE)
- **Content-Type**: `text/event-stream`
- **Response**: Stream of `data:` events (10-20 events)
- **Connection**: Should remain open until completion

**Example SSE Events**:
```
data: {"percentage":10,"stage":"Validation","currentStage":"validation","completedStages":[],"eta":15}

data: {"percentage":25,"stage":"Preprocessing","currentStage":"preprocessing","completedStages":["validation"],"eta":12}

data: {"percentage":45,"stage":"Extraction","currentStage":"extraction","completedStages":["validation","preprocessing"],"eta":8}

...

data: {"stage":"Complete","percentage":100,"eta":0}
```

### Console Tab
**Expected logs** (no errors):
- Progress event parsing messages
- SSE connection status

**No errors should appear** unless network issues occur.

---

## 📊 Performance Checks

### Compression Verification
1. Open Network tab
2. Extract with large clinical notes (>2KB)
3. Check response:
   - **Without compression**: ~15 KB
   - **With compression**: ~3 KB (80% reduction)
   - Header: `Content-Encoding: gzip`

### SSE Latency
- Events should appear within <100ms of backend emission
- No visible lag between progress updates

### UI Responsiveness
- Progress bar should animate smoothly (60fps)
- No frame drops during updates
- Stage transitions should be instant

---

## 🐛 Troubleshooting

### Problem: Progress tracker doesn't appear
**Check**:
- Server is running (`npm run dev`)
- Browser console for errors
- Network tab for failed requests

### Problem: SSE connection fails
**Check**:
- Network tab shows 404 or connection refused
- CORS errors in console
- Server logs for SSE endpoint errors

### Problem: Progress bar stuck at 0%
**Check**:
- SSE events being received (Network tab)
- Console for parsing errors
- Backend progress updates being emitted

### Problem: Stages not updating
**Check**:
- Stage names match between frontend and backend
- Event data includes `currentStage` field
- CSS classes being applied correctly

---

## 📝 Test Checklist

- [ ] Progress tracker appears on extraction start
- [ ] Progress bar moves from 0% to 100%
- [ ] Stage indicators transition correctly
- [ ] ETA countdown updates in real-time
- [ ] Cancel button works with confirmation
- [ ] Progress tracker auto-hides after completion
- [ ] Compression working (check Network tab)
- [ ] SSE events received (10-20 events per extraction)
- [ ] No console errors
- [ ] UI remains responsive during extraction
- [ ] Multiple extractions work correctly
- [ ] Error handling graceful (server stopped, network issues)

---

## 🎉 Success Indicators

✅ **Visual**: Progress bar animates smoothly  
✅ **Functional**: All 9 stages transition correctly  
✅ **Performance**: Compression reduces payload by 60-80%  
✅ **UX**: Cancel button allows stopping extraction  
✅ **Reliability**: No errors in console or network tab  

---

## 📞 Need Help?

Run the automated test script:
```bash
./test_day9_progress_tracking.sh
```

This will verify:
- Server health
- SSE endpoint connectivity
- Progress event capture
- Cancel endpoint functionality

---

**Day 9 Testing Guide** | Visual verification of progress tracking UI and compression
