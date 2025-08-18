# Undername Ownership Guide for ANTs

## Overview

Undername ownership allows individual records (subdomains) within an Arweave
Name Token (ANT) to have designated owners who can manage their specific record
independently. This enables delegation of control while maintaining the ANT
owner's ultimate authority.

## Quick Start

### Check if a record has an owner

```lua
local record = Send({
  Target = antProcessId,
  Action = "Record",
  ["Sub-Domain"] = "alice"
}).receive().Data

-- record.owner will be the owner address or nil
```

### Assign ownership to a record

```lua
-- Only ANT owner/controllers can assign initial ownership
Send({
  Target = antProcessId,
  Action = "Set-Record",
  ["Sub-Domain"] = "alice",
  ["Transaction-Id"] = "tx123...",
  ["TTL-Seconds"] = "86400",
  Owner = "aliceAddress123..."
})
```

### Transfer ownership

```lua
-- Current owner transfers to new owner
Send({
  Target = antProcessId,
  Action = "Transfer-Record-Ownership",
  ["Sub-Domain"] = "alice",
  ["Recipient"] = "bobAddress456..."
})
```

## Key Concepts

### Permission Hierarchy

1. **ANT Owner** - Has full control over all records (god mode)
2. **Controllers** - Have full control over all records
3. **Record Owners** - Can only modify their specific record

### What Record Owners Can Do

- ✅ Update their record's transaction ID
- ✅ Update their record's TTL
- ✅ Add/update record metadata (name, logo, description, keywords)
- ✅ Transfer ownership to another address
- ✅ Set their record as a primary name (for themselves only)
- ❌ Cannot modify other records
- ❌ Cannot change the subdomain name itself
- ❌ Cannot override ANT owner/controller actions

### What ANT Owners/Controllers Can Do

- ✅ Everything record owners can do
- ✅ Assign initial ownership to any record
- ✅ Revoke ownership from any record
- ✅ Modify any record regardless of ownership
- ✅ Override any record owner's settings
- ✅ (Owner Only) Set primary names for ANY wallet (not just themselves)

## Record Metadata

Records can now include optional metadata:

```lua
{
  transactionId = "...",          -- Required: Arweave TX ID
  ttlSeconds = 3600,              -- Required: Time to live
  owner = "address123...",        -- Optional: Record owner
  name = "Alice's Site",          -- Optional: Display name (max 50 chars)
  logo = "logoTx123...",          -- Optional: Logo TX ID
  description = "Personal site",   -- Optional: Description (max 300 chars)
  keywords = {"blog", "personal"} -- Optional: Keywords array
}
```

## API Reference

### Set-Record (Enhanced)

Assigns ownership and metadata when setting a record:

```lua
Send({
  Target = antProcessId,
  Action = "Set-Record",
  ["Sub-Domain"] = "example",
  ["Transaction-Id"] = "tx123...",     -- Required
  ["TTL-Seconds"] = "3600",             -- Required
  Owner = "address123...",         -- Optional: Assign owner
  Name = "Example Site",           -- Optional: Display name
  Logo = "logoTx123...",           -- Optional: Logo TX ID
  Description = "...",             -- Optional: Description
  Keywords = '["blog","tech"]'     -- Optional: JSON array
})
```

**Permissions**:

- ANT owner/controllers can set any field including `Owner`
- Record owners can update their own record but cannot change `Owner`

### Set-Record-Metadata

Update only metadata fields without requiring transactionId or ttlSeconds:

```lua
Send({
  Target = antProcessId,
  Action = "Set-Record-Metadata",
  ["Sub-Domain"] = "example",
  Owner = "address123...",         -- Optional: Change owner (ANT owner/controllers only)
  ["Record-Name"] = "New Name",    -- Optional: Display name
  ["Record-Logo"] = "logoTx123...",-- Optional: Logo TX ID
  ["Record-Description"] = "...",  -- Optional: Description
  ["Record-Keywords"] = '["blog"]' -- Optional: JSON array
})
```

**Permissions**:

- Record owners can update metadata but not ownership
- ANT owner/controllers can update any field including ownership
- Preserves existing transactionId, ttlSeconds, and any unspecified fields

### Transfer-Record-Ownership

Transfer ownership from current owner to new owner:

```lua
Send({
  Target = antProcessId,
  Action = "Transfer-Record-Ownership",
  ["Sub-Domain"] = "example",
  ["Recipient"] = "newAddress456..."
})
```

**Permissions**:

- Current record owner
- ANT owner/controllers

**Response**: Sends notices to both previous and new owner

### Revoke-Record-Ownership

Remove ownership from a record:

```lua
Send({
  Target = antProcessId,
  Action = "Revoke-Record-Ownership",
  ["Sub-Domain"] = "example"
})
```

**Permissions**:

- ANT owner/controllers only

**Response**: Sends notice to previous owner

### Primary Name Support

Record owners can set their undername as a primary name. Note that the `Name`
parameter must be the full primary name (e.g., "alice_ant") not just the
subdomain:

```lua
-- Approve as primary name (owner must be setting for themselves)
Send({
  Target = antProcessId,
  Action = "Approve-Primary-Name",
  Name = "alice_ant",  -- Full name with base ANT name
  Recipient = "aliceAddress123...",  -- Must match sender
  ["IO-Process-Id"] = ARIO_PROCESS_ID  -- Required!
})

-- Remove primary name
Send({
  Target = antProcessId,
  Action = "Remove-Primary-Names",
  Names = "alice_ant",  -- Full name(s)
  ["IO-Process-Id"] = ARIO_PROCESS_ID  -- Required!
})
```

## Common Patterns

### Community ANT with Member Undernames

```lua
-- Admin creates member records with ownership
local members = {"alice", "bob", "charlie"}
for _, member in ipairs(members) do
  Send({
    Target = antProcessId,
    Action = "Set-Record",
    ["Sub-Domain"] = member,
    ["Transaction-Id"] = defaultTx,
    ["TTL-Seconds"] = "86400",
    Owner = memberAddresses[member]
  })
end
```

### Marketplace with Tradeable Undernames

```lua
-- List undername for sale (update metadata)
Send({
  Target = antProcessId,
  Action = "Set-Record",
  ["Sub-Domain"] = "rare-name",
  ["Transaction-Id"] = currentTx,
  ["TTL-Seconds"] = "86400",
  Description = "For Sale: 1000 AR",
  Keywords = '["forsale","marketplace"]'
})

-- Transfer after payment verified
Send({
  Target = antProcessId,
  Action = "Transfer-Record-Ownership",
  ["Sub-Domain"] = "rare-name",
  ["Recipient"] = buyerAddress
})
```

### Identity System with Profiles

```lua
-- User sets up their profile
Send({
  Target = antProcessId,
  Action = "Set-Record",
  ["Sub-Domain"] = "alice",
  ["Transaction-Id"] = profileTx,
  ["TTL-Seconds"] = "86400",
  Name = "Alice Smith",
  Logo = avatarTx,
  Description = "Developer & Designer",
  Keywords = '["developer","designer","web3"]'
})

-- Set as primary identity
Send({
  Target = antProcessId,
  Action = "Approve-Primary-Name",
  Name = "alice_ant",  -- Full name with base ANT name
  Recipient = aliceAddress,  -- Must match sender
  ["IO-Process-Id"] = ARIO_PROCESS_ID  -- Required!
})
```

## Best Practices

1. **Always validate ownership** before showing UI controls
2. **Check permissions** before attempting operations
3. **Handle both owned and unowned records** - not all records have owners
4. **Respect metadata limits** - name (50), description (300)
5. **Use keywords wisely** - they're searchable metadata
6. **Plan for revocation** - ANT owner can always revoke

## Error Handling

Common errors and their meanings:

- `"Sender does not have permission for this record"` - Not owner/controller
- `"Record has no owner"` - Trying to transfer unowned record
- `"Invalid new owner address"` - Malformed address
- `"New owner same as current owner"` - Redundant transfer
- `"This name is not registered"` - Invalid subdomain

## Migration & Compatibility

- **Existing records work unchanged** - ownership is optional
- **No breaking changes** - all existing handlers still work
- **Progressive enhancement** - add ownership when needed
- **State compatible** - registry receives ownership data

## Security Considerations

1. **ANT owner maintains control** - can always revoke/modify
2. **No privilege escalation** - record owners can't become controllers
3. **Atomic operations** - all changes are transactional
4. **Validated inputs** - addresses, metadata, and parameters checked
5. **Notice system** - all changes generate appropriate notices

## FAQ

**Q: Can a record owner change the subdomain name?** A: No, subdomain names are
immutable. Owners can only update the record's properties.

**Q: What happens if an ANT transfers ownership?** A: The new ANT owner inherits
god mode over all records, including owned ones.

**Q: Do record ownership changes notify the registry?** A: No, only ANT-level
changes notify the registry. Record ownership is internal.

**Q: Can I have multiple owners per record?** A: No, each record has at most one
owner. Use Controllers for multi-sig scenarios.

**Q: What's the gas cost for ownership operations?** A: Same as any other ANT
operation - standard AO message costs apply.
