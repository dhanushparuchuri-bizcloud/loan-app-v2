# Phased Implementation Plan - Desktop UX Overhaul

## 🎯 GOAL
Transform borrower and lender dashboards from cluttered cards to clean, scannable tables with lender search functionality.

**Focus**: Desktop only (mobile keeps existing cards)
**Timeline**: 3 phases, ~8-10 hours total

---

## 📋 PHASE 1: BACKEND - LENDER SEARCH API (1-2 hours)

### What We're Building:
New endpoint that returns previous lenders for a borrower

### Tasks:
1. **Add lender search endpoint** (45 min)
   - File: `backend/src/handlers/loan_handler/index.py`
   - Endpoint: `GET /lenders/search?q={query}`
   - Logic: Query borrower's loans → get accepted participants → aggregate stats
   - Return: List of lenders with investment history

2. **Update API client** (15 min)
   - File: `lib/api-client.ts`
   - Add `searchLenders(query)` method
   - Add TypeScript interfaces

3. **Test endpoint** (15 min)
   - Test with Postman or curl
   - Verify returns correct lenders
   - Test search filtering

### Deliverable:
```
GET /lenders/search?q=john
→ Returns previous lenders with stats
```

### Files to Modify:
- `backend/src/handlers/loan_handler/index.py`
- `lib/api-client.ts`

---

## 📋 PHASE 2: FRONTEND - BORROWER DASHBOARD (3-4 hours)

### What We're Building:
Replace card layout with table + search + expandable rows

### Tasks:

#### 2.1: Create Table Component (1 hour)
- File: `app/dashboard/borrower/page.tsx`
- Replace card grid with `<Table>` component
- Columns: Name, Amount, Funded %, Holders, Status, Actions
- Add [+ Add Holders] button to each row
- Keep mobile cards (wrap table in `hidden md:block`)

#### 2.2: Add Search & Filter (30 min)
- Add search input above table
- Add status filter dropdown (All, Active, Pending)
- Add sort dropdown (Recent, Amount High/Low)
- Implement client-side filtering with `useMemo`

#### 2.3: Add Expandable Rows (45 min)
- Add click handler to expand/collapse rows
- Show holder list, dates, metrics in expanded section
- Add chevron icon that rotates on expand
- Style expanded section with muted background

#### 2.4: Create Add Holders Modal (1.5 hours)
- File: `components/add-holders-modal.tsx`
- Create new component with Dialog
- Add two tabs: "Previous Holders" and "New Holders"
- Previous tab: Search input + checkbox list
- New tab: Email + amount form
- Show running total vs remaining
- Validate before submit

### Deliverable:
Clean table view with search, filter, expandable rows, and smart add holders modal

### Files to Create:
- `components/add-holders-modal.tsx`
- `components/status-badge.tsx` (if doesn't exist)

### Files to Modify:
- `app/dashboard/borrower/page.tsx`

---

## 📋 PHASE 3: FRONTEND - LENDER DASHBOARD (1-2 hours)

### What We're Building:
Improve lender table with expected returns and better layout

### Tasks:

#### 3.1: Enhance Lender Table (1 hour)
- File: `app/dashboard/lender/page.tsx`
- Update table columns: Note, Borrower, Investment, APR, Expected Returns, Status, Actions
- Calculate expected returns (contribution * APR / 100)
- Show annual and monthly returns
- Add expandable rows (optional)

#### 3.2: Improve Pending Invitations (30 min)
- Keep card layout but enhance
- Show expected returns prominently
- Add borrower name
- Make cards more compact

### Deliverable:
Lender dashboard with clear expected returns and better information hierarchy

### Files to Modify:
- `app/dashboard/lender/page.tsx`

---

## 📊 DETAILED BREAKDOWN

### PHASE 1: Backend (1-2 hours)

```
✅ Task 1.1: Add lender search handler (45 min)
   - Add handle_search_lenders() function
   - Query borrower's loans
   - Get participants from those loans
   - Aggregate lender stats
   - Filter by search query
   - Return sorted list

✅ Task 1.2: Update API client (15 min)
   - Add searchLenders() method
   - Add Lender interface
   - Add SearchLendersResponse interface

✅ Task 1.3: Test (15 min)
   - Test with curl/Postman
   - Verify data structure
   - Test search filtering
```

### PHASE 2: Borrower Dashboard (3-4 hours)

```
✅ Task 2.1: Table Component (1 hour)
   - Import Table components
   - Create table structure
   - Map loans to table rows
   - Add action buttons
   - Style with Tailwind

✅ Task 2.2: Search & Filter (30 min)
   - Add Input for search
   - Add Select for status filter
   - Add Select for sort
   - Implement useMemo for filtering
   - Test filtering logic

✅ Task 2.3: Expandable Rows (45 min)
   - Add state for expanded loan ID
   - Add click handler
   - Create expanded row component
   - Show holder list
   - Add quick actions

✅ Task 2.4: Add Holders Modal (1.5 hours)
   - Create modal component
   - Add Tabs component
   - Build previous lenders tab
   - Build new lenders tab
   - Add search functionality
   - Calculate totals
   - Add validation
   - Handle submit
```

### PHASE 3: Lender Dashboard (1-2 hours)

```
✅ Task 3.1: Enhance Table (1 hour)
   - Update table columns
   - Calculate expected returns
   - Format currency
   - Add expandable rows (optional)
   - Test calculations

✅ Task 3.2: Improve Invitations (30 min)
   - Enhance card layout
   - Add expected returns
   - Show borrower name
   - Make more compact
```

---

## 🎯 IMPLEMENTATION ORDER

### Day 1 (3-4 hours):
1. ✅ Phase 1: Backend lender search (1-2 hours)
2. ✅ Phase 2.1-2.2: Table + Search (1.5 hours)

### Day 2 (3-4 hours):
3. ✅ Phase 2.3-2.4: Expandable rows + Modal (2.5 hours)
4. ✅ Test borrower dashboard (30 min)

### Day 3 (2-3 hours):
5. ✅ Phase 3: Lender dashboard (1.5 hours)
6. ✅ Final testing and polish (1 hour)

---

## ✅ ACCEPTANCE CRITERIA

### Phase 1 Complete When:
- [ ] GET /lenders/search endpoint works
- [ ] Returns previous lenders with stats
- [ ] Search filtering works
- [ ] API client method added

### Phase 2 Complete When:
- [ ] Borrower dashboard shows table (desktop)
- [ ] Search filters loans in real-time
- [ ] Status filter works
- [ ] Rows expand to show details
- [ ] [+ Add Holders] button always visible
- [ ] Modal opens and shows previous lenders
- [ ] Can search previous lenders
- [ ] Can add new lenders
- [ ] Validation works
- [ ] Successfully adds lenders

### Phase 3 Complete When:
- [ ] Lender table shows expected returns
- [ ] Returns calculated correctly (annual + monthly)
- [ ] Pending invitations enhanced
- [ ] All data displays correctly

---

## 🧪 TESTING CHECKLIST

### After Phase 1:
- [ ] Test lender search with query
- [ ] Test lender search without query (returns all)
- [ ] Verify stats are correct
- [ ] Test with borrower who has no previous lenders

### After Phase 2:
- [ ] Test table displays all loans
- [ ] Test search filters correctly
- [ ] Test status filter
- [ ] Test sort options
- [ ] Test row expansion
- [ ] Test modal opens
- [ ] Test previous lenders tab
- [ ] Test new lenders tab
- [ ] Test adding lenders
- [ ] Test validation (over-funding)
- [ ] Test on different screen sizes

### After Phase 3:
- [ ] Test lender table displays correctly
- [ ] Test expected returns calculation
- [ ] Test pending invitations
- [ ] Test all user flows end-to-end

---

## 📦 DELIVERABLES

### Phase 1:
- New backend endpoint: `GET /lenders/search`
- Updated API client with `searchLenders()` method

### Phase 2:
- Redesigned borrower dashboard with table view
- Search and filter functionality
- Expandable rows
- Add Holders modal with lender search
- New component: `components/add-holders-modal.tsx`

### Phase 3:
- Enhanced lender dashboard with expected returns
- Improved pending invitations display

---

## 🚀 READY TO START?

**Phase 1 is ready to implement now.**

I'll start by:
1. Adding the lender search endpoint to the backend
2. Updating the API client
3. Testing the endpoint

Then we'll move to Phase 2 (frontend table).

**Shall I begin with Phase 1?**

