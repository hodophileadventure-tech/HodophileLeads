# DEBUGGING GUIDE: In-Progress Status Update Issue

## What I've Done

1. **Created and ran a test** (`backend/test-in-progress-update.js`) that simulates the entire update flow:
   - ✅ Confirmed the mock database handler correctly parses and applies the 'contacted' status
   - ✅ Verified parameters are passed correctly
   - **Conclusion**: The issue is NOT in the mock database

2. **Added comprehensive logging** throughout the entire stack:
   - **Frontend**: Status dropdown change handler now logs all requests/responses
   - **Backend Controller**: Logs payload at each validation stage  
   - **Database Handler**: Logs SQL parsing, field updates, and final result

## How to Debug

### Step 1: Start the Application
```bash
# In root directory
npm run dev
# Or:
npm start
```

### Step 2: Open Browser Developer Tools
- Press `F12` or `Ctrl+Shift+I`
- Go to **Console** tab
- Leave it open while testing

### Step 3: Test the Status Change
1. Login to the application
2. Click on any lead to select it
3. Find the "Lead Status" dropdown
4. Select "In Progress" from the dropdown
5. **Don't refresh the page** - let's see what happens

### Step 4: Check the Logs

You should see console logs in this order:

**In Browser Console (frontend logs):**
```
[App] Status change: { selectedValue: 'in_progress', payload: { potential: false, status: 'contacted' } }
[App] Calling leadsAPI.update with: { leadId: <id>, payload: { ... } }
[App] Update response: { status: 200, data: { id: ..., status: 'contacted', ... } }
[App] Status update completed successfully
```

**In Server Console (backend logs):**
```
[LeadsController] Update request received for lead: <id>
[LeadsController] Raw request body: { potential: false, status: 'contacted' }
[LeadsController] After normalizeLeadPayload: { ... status: 'contacted', ... }
[LeadsController] Calling leadsModel.update with: { leadId: <id>, payload: { ... } }
[MOCK DB] Lead update SQL: UPDATE leads SET potential = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING *
[MOCK DB] Lead update assignments: [ 'potential = $1', 'status = $2' ]
[MOCK DB] Lead update params: [ false, 'contacted', '<id>' ]
[MOCK DB] Setting potential = false (was false)
[MOCK DB] Setting status = "contacted" (was new)
[MOCK DB] Lead update completed: { id: ..., updated: 2, oldStatus: 'new', newStatus: 'contacted', ... }
[LeadsController] Lead updated successfully. Response status: contacted potential: false
```

## Troubleshooting

### Case 1: "No frontend logs appear"
- **Problem**: The status change handler isn't being called
- **Check**: Click the dropdown again, slowly. Does it open? Can you select?
- **Solution**: Might be a UI issue preventing the change

### Case 2: "Frontend logs show but no response"
- **Problem**: The API request is timing out or failing silently
- **Check**: In DevTools → Network tab, look for the PUT request to `/api/leads/<id>`
- **Look for**: The request and its response status (should be 200)
- **Solution**: Check if the backend is even running

### Case 3: "Response shows status: 'new', not 'contacted'"
- **Problem**: The database is returning the old status
- **Check**: Look at the server logs for [MOCK DB] - is it updating correctly?
- **If NOT updated**: The SQL parsing or parameter extraction failed
- **If UPDATED**: The issue is in the response mapping

### Case 4: "Logs show everything succeeding, but UI doesn't change"
- **Problem**: The frontend is updating state but not re-rendering
- **Check**: Open DevTools → React DevTools tab (if installed)
- **Solution**: The issue might be in how React is handling the state update

### Case 5: "Everything looks correct but status reverts after refresh"
- **Problem**: The update succeeds but isn't being persisted properly
- **Check**: Manually refresh the page and check the lead status
- **If reverted**: The mock database isn't persisting changes correctly
- **If persisted**: It's a frontend caching issue

## What to Share With Me

When you run this test, please share:
1. **All console logs** (both browser and server) showing the issue
2. **Whether the status dropdown changes visually**
3. **Whether the change persists after refresh**
4. **Any error messages** that appear

This information will pinpoint the exact location of the issue.

## Advanced Testing

If you want to test directly from the command line:

```bash
# In a new terminal in the backend directory
curl -X PUT http://localhost:5000/api/leads/<lead-id> \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"potential": false, "status": "contacted"}'
```

Check if the response includes `"status":"contacted"`.
