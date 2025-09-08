# Undername Ownership - Delegated Control for ANT Records

- Status: accepted
- Approvers: [to be determined]
- Date: 2025-08-01
- Authors: Claude Code, Contributors

## Context and Problem Statement

Arweave Name Tokens (ANTs) manage undernames (subdomains) as records within the
token. Currently, all records are exclusively controlled by the ANT owner and
designated controllers. This creates limitations for use cases where individual
undername control needs to be delegated to specific users while maintaining the
ANT owner's ultimate authority.

For example, a community ANT might want to allow members to manage their own
undernames independently, or a marketplace might want to enable undername
ownership transfers without changing the entire ANT ownership.

## Decision Drivers

- **Delegation Requirements**: Enable ANT owners to delegate control of specific
  undernames to other users
- **Backward Compatibility**: Existing ANTs and records must continue
  functioning without modification
- **Security**: Maintain ANT owner's ultimate authority and prevent unauthorized
  modifications
- **Flexibility**: Support metadata and identity features at the record level
- **Simplicity**: Keep implementation straightforward and consistent with
  existing patterns

## Considered Options

1. **Full Delegation Model**: Complete transfer of record control with no ANT
   owner override
2. **Hierarchical Permission Model**: ANT owner retains override capability for
   all operations
3. **No Change**: Keep current model where only ANT owner/controllers manage
   records

## Decision Outcome

We implemented the **Hierarchical Permission Model** where:

- ANT owners and controllers maintain "god mode" - full control over all records
- Individual records can have designated owners who control that specific record
- Record owners can manage their record's transaction ID, TTL, and metadata
- Record owners can set their undername as a primary name (identity feature)

### Positive Consequences

- **Enables new use cases**: Communities, marketplaces, and delegated management
- **Maintains security**: ANT owner retains ultimate control
- **Backward compatible**: Existing records work unchanged
- **Flexible metadata**: Records can have names, logos, descriptions, and
  keywords
- **Identity support**: Undernames can serve as primary ArNS identities

### Negative Consequences

- **Increased complexity**: Additional permission checks and state management
- **Storage overhead**: Optional fields increase state size (mitigated by
  optional nature)
- **Registry sync**: Record ownership changes don't immediately notify the
  registry

## Implementation Details

### Extended Record Type

Records now support optional ownership and metadata fields:

```lua
---@alias Record {
--- transactionId: string,
--- ttlSeconds: integer,
--- priority: integer|nil,
--- owner: string|nil,           -- NEW: Record owner address
--- name: string|nil,             -- NEW: Display name (max 50 chars)
--- logo: string|nil,             -- NEW: Arweave TX ID for logo
--- description: string|nil,      -- NEW: Description (max 300 chars)
--- keywords: table<string>|nil   -- NEW: Keywords array
---}
```

### Permission Hierarchy

1. **ANT Owner**: Full control via ownership (balance = 1) or process ID
2. **Controllers**: Full control via Controllers array
3. **Record Owners**: Control only their specific record

### New Handlers

#### Transfer-Record

Transfers ownership of a specific record to a new address:

```lua
{
  Action = "Transfer-Record",
  SubDomain = "example",
  NewOwner = "address123..."
}
```

#### Revoke-Record-Ownership

ANT owner/controllers can revoke any record ownership:

```lua
{
  Action = "Revoke-Record-Ownership",
  SubDomain = "example"
}
```

#### Set-Record-Metadata

Update only metadata fields without requiring transactionId:

```lua
{
  Action = "Set-Record-Metadata",
  SubDomain = "example",
  Owner = "address123...",         -- Optional (ANT owner/controllers only)
  ["Record-Name"] = "New Name",    -- Optional
  ["Record-Logo"] = "logoTx123...",-- Optional
  ["Record-Description"] = "...",  -- Optional
  ["Record-Keywords"] = '["blog"]' -- Optional (JSON array)
}
```

### Updated Handlers

#### Set-Record

Now accepts optional ownership and metadata parameters:

```lua
{
  Action = "Set-Record",
  SubDomain = "example",
  TransactionId = "tx123...",
  TtlSeconds = "3600",
  Owner = "address123...",      -- Optional
  Name = "Example Site",         -- Optional
  Logo = "logoTx123...",         -- Optional
  Description = "...",           -- Optional
  Keywords = '["defi","dao"]'    -- Optional, JSON array
}
```

#### Approve-Primary-Name / Remove-Primary-Names

Record owners can only set/remove primary names for themselves:

- Must be the record owner
- Recipient must match the caller's address

### Security Measures

1. **Atomic Operations**: All state changes wrapped with `collectgarbage()`
2. **Permission Validation**: New `assertHasRecordPermission()` utility
3. **Input Validation**: All addresses, metadata, and parameters validated
4. **Notice System**: Proper notices sent for all ownership changes

### State Management

The ANT state includes all record ownership data:

```lua
Records = {
  ["example"] = {
    transactionId = "...",
    ttlSeconds = 3600,
    owner = "address123...",        -- Record owner
    name = "Example Site",
    logo = "logoTx...",
    description = "A sample site",
    keywords = {"sample", "example"}
  }
}
```

### Registry Integration

When ANT ownership transfers occur, the registry receives the complete state
including all record ownership data. Individual record ownership changes do not
trigger registry notifications - the registry is updated on the next ANT-level
state change.

## Usage Examples

### Assigning Record Ownership

```lua
-- ANT owner assigns ownership when creating a record
Send({
  Target = antProcessId,
  Action = "Set-Record",
  SubDomain = "alice",
  TransactionId = "tx123...",
  TtlSeconds = "86400",
  Owner = "aliceAddress123...",
  Name = "Alice's Site"
})
```

### Record Owner Updates Their Record

```lua
-- Alice updates her own record
Send({
  Target = antProcessId,
  Action = "Set-Record",
  SubDomain = "alice",
  TransactionId = "newTx456...",
  TtlSeconds = "3600"
})

-- Alice updates only metadata (new handler)
Send({
  Target = antProcessId,
  Action = "Set-Record-Metadata",
  SubDomain = "alice",
  ["Record-Name"] = "Alice's Updated Site",
  ["Record-Description"] = "New description"
})
```

### Transferring Record Ownership

```lua
-- Alice transfers her record to Bob
Send({
  Target = antProcessId,
  Action = "Transfer-Record",
  SubDomain = "alice",
  NewOwner = "bobAddress456..."
})
```

### Setting as Primary Name

```lua
-- Alice sets her undername as her primary identity
Send({
  Target = antProcessId,
  Action = "Approve-Primary-Name",
  Name = "alice",
  Recipient = "aliceAddress123..."  -- Must match sender
})
```

## Pros and Cons of the Options

### Hierarchical Permission Model (Chosen)

- `+` Maintains ANT owner authority
- `+` Enables delegation use cases
- `+` Backward compatible
- `+` Consistent with ANT security model
- `-` More complex permission checks
- `-` Requires careful state management

### Full Delegation Model

- `+` Simpler ownership model
- `+` True ownership transfer
- `-` ANT owner loses control
- `-` Security risks for ANT integrity
- `-` Breaks existing trust model

### No Change

- `+` Simplest - no new code
- `+` No compatibility concerns
- `-` Limits ANT use cases
- `-` No delegation possible
- `-` Restricts adoption

## Links

- [Original Proposal](../../UNDERNAME-OWNERSHIP.md)
- [Implementation Plan](../../UNDERNAME-OWNERSHIP-SECURE-IMPLEMENTATION.md)
- [Code Changes Plan](../../UNDERNAME-OWNERSHIP-CODE-PLAN.md)

## Related Decisions

- [ADR-1](1-reassign-evolve.md) - Reassign and Evolve Pattern

## Notes

This implementation carefully balances flexibility with security, enabling new
use cases while preserving the fundamental security properties of ANTs. The
optional nature of all new fields ensures zero impact on existing deployments.
