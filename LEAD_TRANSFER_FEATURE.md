# Lead Transfer Feature Documentation

## Overview
A new admin panel feature has been implemented that allows administrators to transfer leads from one agent to another. When a lead is transferred, it is removed from the source agent's panel and becomes available only to the target agent.

## Features Implemented

### 1. Backend API Endpoint
**Location**: `POST /admin/leads/:id/transfer`
**Controller**: `adminController.transferLead()`
**Route**: Added to [backend/src/routes/admin.ts](backend/src/routes/admin.ts)

**Request Body**:
```json
{
  "targetAgentId": "agent-uuid"
}
```

**Response**:
```json
{
  "success": true,
  "lead": { /* transferred lead object */ },
  "message": "Lead transferred successfully from agent to target-agent-id"
}
```

**Validations**:
- Lead must exist
- Target agent must exist and have 'agent' role
- Current agent must exist and have 'agent' role
- Logs the transfer activity for audit trail

### 2. Frontend API Integration
**Location**: `frontend/src/utils/api-service.ts`
**Method**: `adminAPI.transferLead(leadId, targetAgentId)`

Added to the existing `adminAPI` object:
```typescript
transferLead: (leadId: string, targetAgentId: string) => 
  apiClient.post(`/admin/leads/${leadId}/transfer`, { targetAgentId })
```

### 3. Lead Transfer Panel Component
**Location**: `frontend/src/components/LeadTransferPanel.tsx`
**Type**: React Functional Component

#### Features:
- **Agent Selection**: Dropdown to select source agent
- **Lead Selection**: Dynamic dropdown showing leads for selected agent
- **Lead Details Display**: Shows client name, phone, email, destination, and status
- **Target Agent Selection**: Dropdown to select target agent (filtered to exclude source agent)
- **Transfer Summary**: Clear display of source agent → target agent transfer
- **Confirmation Modal**: Requires confirmation before transferring
- **Real-time Feedback**: Success/error messages
- **Loading States**: Spinners during data loading and transfer

#### User Flow:
1. Admin selects source agent from dropdown
2. System loads all leads for that agent
3. Admin selects a lead to transfer
4. Lead details are displayed for verification
5. Admin selects target agent
6. Transfer summary is shown
7. Admin clicks "Transfer Lead" button
8. Confirmation modal appears
9. Upon confirmation, lead is transferred
10. Success message displayed and UI resets

### 4. UI Integration
**Location**: `frontend/src/pages/App.tsx`

#### Changes:
- Added `'lead-transfer'` to the Page type
- Imported `LeadTransferPanel` component
- Added menu item: "Transfer Leads" with 🔄 icon (admin only)
- Added conditional render for the lead transfer page (admin only)

#### Menu Item Position:
Appears in admin sidebar after "Pending Quotes" and before "Agent Panel"

## Database Activity
All lead transfers are logged using the `logActivity()` function with:
- Action: `LEAD_TRANSFERRED`
- Entity Type: `lead`
- Details including:
  - From agent ID
  - To agent ID
  - Client name
  - Email
  - Phone

## User Permissions
- **Admin**: Full access to the "Transfer Leads" feature
- **Agent**: No access (feature hidden)

## Error Handling
The component handles multiple error scenarios:
- Agent not found
- Lead not found
- Target agent not found
- Network errors
- Same source and target agent selection

## Success Scenarios
1. Lead successfully transferred
2. Source agent's lead list refreshed automatically
3. Success message displays for 5 seconds
4. Form resets for next transfer

## Testing Checklist

- [ ] Access "Transfer Leads" from admin sidebar
- [ ] Load agents list successfully
- [ ] Select an agent and verify leads are loaded
- [ ] Verify lead details display correctly
- [ ] Select target agent and verify summary
- [ ] Click "Transfer Lead" button
- [ ] Review confirmation modal
- [ ] Confirm transfer
- [ ] Verify success message
- [ ] Verify source agent's lead list is updated
- [ ] Verify target agent sees the transferred lead in their panel
- [ ] Test error handling (invalid agent, etc.)

## API Endpoints Used

### External Calls:
- `GET /admin/agents` - Fetch all agents
- `GET /admin/agents/:id/leads` - Fetch leads for specific agent
- `POST /admin/leads/:id/transfer` - Transfer lead

## Component Dependencies
- React hooks (useState, useEffect)
- `adminAPI` from api-service
- `Badge` and `Button` from common components
- `Spinner` component
- Type imports: `Lead`

## Styling
- Uses Tailwind CSS classes consistent with the rest of the application
- Dark mode support via `dark:` classes
- Responsive grid layout
- Clear visual separation of source and target sections
- Modal overlay for confirmation

## Future Enhancements
- Bulk transfer functionality (transfer multiple leads at once)
- Transfer history/audit view
- Filter leads by status before transfer
- Reason/note for transfer
- Email notification to both agents on transfer
- Automatic follow-up reassignment options
