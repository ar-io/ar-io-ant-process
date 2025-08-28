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
  Owner = "aliceAddress123..."  -- Requires ANT owner/controller permission
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
- ❌ Cannot set or modify priority (only ANT owner/controllers can set priority)
- ❌ Cannot assign new ownership (can only transfer existing ownership)
- ❌ Cannot override ANT owner/controller actions

### What ANT Owners/Controllers Can Do

- ✅ Everything record owners can do
- ✅ Assign initial ownership to any record
- ✅ Create new records
- ✅ Set priority on records (existing and new)
- ✅ Modify any record regardless of ownership
- ✅ Transfer ownership of any record
- ✅ Remove any record completely
- ✅ Set primary names for ANY wallet (not just themselves)

**Note**: There is no "Revoke-Record-Ownership" API. ANT owners can transfer
ownership or remove the record entirely.

## Record Metadata

Records can now include optional metadata:

```lua
{
  transactionId = "...",          -- Required: Arweave TX ID
  ttlSeconds = 3600,              -- Required: Time to live
  priority = 10,                  -- Optional: Priority (ANT owner/controllers only)
  owner = "address123...",        -- Optional: Record owner
  name = "Alice's Site",          -- Optional: Display name (max 61 chars)
  logo = "logoTx123...",          -- Optional: Logo TX ID
  description = "Personal site",   -- Optional: Description (max 512 chars)
  keywords = {"blog", "personal"} -- Optional: Keywords array (max 16, each max 32 chars)
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

- **For new records**: Only ANT owner/controllers can create records
- **For existing records without priority**: Record owners can update their
  record but cannot change `Owner` or `Priority`
- **For existing records with priority**: Only ANT owner/controllers can modify
  (priority prevents undername owners from overriding)
- **Owner assignment**: Only ANT owner/controllers can set the `Owner` field
- **Priority setting**: Only ANT owner/controllers can set `Priority`

**Note**: There is no separate "Set-Record-Metadata" action. All record updates,
including metadata, must be done through the "Set-Record" action with required
`Transaction-Id` and `TTL-Seconds` fields.

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

**Note**: There is no "Revoke-Record-Ownership" action. ANT owners/controllers
can:

- Transfer ownership to another address using "Transfer-Record-Ownership"
- Remove the record entirely using "Remove-Record"

### Primary Name Support

Record owners can set their undername as a primary name, but only for
themselves. The `Name` parameter must be the full primary name (e.g.,
"alice_ant") not just the subdomain:

```lua
-- Approve as primary name
Send({
  Target = antProcessId,
  Action = "Approve-Primary-Name",
  Name = "alice_ant",  -- Full name with base ANT name
  Recipient = "aliceAddress123...",  -- For undernames: MUST match sender (record owner)
  ["IO-Process-Id"] = ARIO_PROCESS_ID  -- Required!
})

-- Remove primary name(s) - supports multiple names separated by commas
Send({
  Target = antProcessId,
  Action = "Remove-Primary-Names",
  Names = "alice_ant,bob_ant",  -- Full name(s), comma-separated
  ["IO-Process-Id"] = ARIO_PROCESS_ID  -- Required!
})
```

**Permissions**:

- **For base names** (e.g., "example" without underscore): Only ANT
  owner/controllers can approve
- **For undernames** (e.g., "alice_example"): Record owner can approve, but
  recipient MUST match the sender (can only approve for themselves)
- **Remove names**: Same permission logic as approve - ANT owner/controllers for
  base names, record owners for their undernames

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
4. **Respect metadata limits** - name (61), description (512), keywords (16 max,
   each 32 chars max)
5. **Use keywords wisely** - they're searchable metadata (no spaces,
   alphanumeric + dash/underscore/#/@)
6. **Understand priority behavior** - records with priority can only be modified
   by ANT owner/controllers
7. **Plan for record removal** - ANT owner can remove records entirely (no
   separate revoke API)

## Error Handling

Common errors and their meanings:

- `"Sender does not have permission for this record"` - Not owner/controller for
  the specific record
- `"Only controllers and owners can set controllers, records, and change metadata."` -
  ANT-level permission required
- `"Record does not exist"` - Trying to access non-existent record
- `"Record has no owner"` - Trying to transfer unowned record
- `"Invalid new owner address"` - Malformed address
- `"New owner same as current owner"` - Redundant transfer
- `"Missing ttl seconds"` - TTL-Seconds parameter required
- `"Undername owners can only approve names for themselves"` - Record owner
  trying to approve for different recipient

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

**Q: Can I update just the metadata without Transaction-Id?** A: No, all record
updates require Transaction-Id and TTL-Seconds. There is no separate
metadata-only update API.

**Q: What happens when a record has priority set?** A: Records with priority can
only be modified by ANT owner/controllers, even if they have an assigned owner.

**Q: Can I have multiple owners per record?** A: No, each record has at most one
owner. Use Controllers for multi-sig scenarios.

**Q: What's the gas cost for ownership operations?** A: Same as any other ANT
operation - standard AO message costs apply.
