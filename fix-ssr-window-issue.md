# SSR Window Object Fix

## Issue
The Next.js export was failing on `/dashboard/invitations` page due to accessing `window.location.origin` during server-side rendering (SSR) or static generation.

## Error
```
> Export encountered errors on following paths:
/dashboard/invitations/page: /dashboard/invitations
```

## Root Cause
```typescript
// ❌ Problematic code - window not available during SSR
const [invitations, setInvitations] = useState<Invitation[]>([
  {
    invitationLink: `${window.location.origin}/invite/lender/abc123`, // Error!
    // ...
  }
])
```

## Fix Applied

### 1. Move window access to useEffect
```typescript
// ✅ Fixed - Initialize empty array first
const [invitations, setInvitations] = useState<Invitation[]>([])

// ✅ Access window only after component mounts
useEffect(() => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
  const initialInvitations: Invitation[] = [
    {
      invitationLink: `${origin}/invite/lender/abc123`,
      // ...
    }
  ]
  setInvitations(initialInvitations)
}, [])
```

### 2. Safe window access in event handlers
```typescript
// ✅ Safe window access with fallback
const handleCreateInvitation = (e: React.FormEvent) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
  // ...
}
```

## Why This Works
- **SSR Safety**: `typeof window !== 'undefined'` check prevents errors during server rendering
- **Fallback**: Provides default URL for build-time static generation
- **Client Hydration**: Real `window.location.origin` is used once component mounts on client

## Result
- ✅ No more export errors
- ✅ Page renders correctly during SSR
- ✅ Proper URLs generated on client-side
- ✅ Maintains all functionality

## Best Practice
Always check for `window` availability when accessing browser APIs in Next.js:
```typescript
const origin = typeof window !== 'undefined' ? window.location.origin : 'fallback-url'
```