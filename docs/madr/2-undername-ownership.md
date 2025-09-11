# Undername Ownership - Delegated Control for ANT Records

- Status: accepted
- Approvers: [Dylan, Phil]
- Date: 2025-08-01
- Authors: Claude Code, Atticus, Dylan, Phil

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

Records support optional ownership and metadata fields:

```lua
---@alias Record {
--- transactionId: string,
--- ttlSeconds: integer,
--- priority: integer|nil,        -- For non-@ undernames (> 0); '@' must be 0
--- owner: string|nil,            -- Record owner address
--- displayName: string|nil,      -- Display name (max 61 chars)
--- logo: string|nil,             -- Arweave TX ID for logo
--- description: string|nil,      -- Description (max 512 chars)
--- keywords: table<string>|nil   -- Up to 16 keywords; each <= 32 chars
---}
```

### Permission Hierarchy

1. **ANT Owner**: Full control via ownership (balance = 1) or process ID
2. **Controllers**: Full control via Controllers array
3. **Record Owners**: Control only their specific record

### Transfer-Record

Transfers ownership of a specific record to a new address.

Request tags (Action: `Transfer-Record`):

```lua
{
  ["Sub-Domain"] = "example",
  Recipient = "address123..."
}
```

Permissions:

- ANT owner/controllers may transfer any record
- Record owner may transfer their own record

### Updated Handlers

#### Set-Record

Set or update a record. Optional ownership and metadata fields are supported.

Request tags (Action: `Set-Record`):

```lua
{
  ["Sub-Domain"] = "example",
  ["Transaction-Id"] = "tx123...",
  ["TTL-Seconds"] = "3600",
  ["Priority"] = "1",                  -- Optional; only ANT owner/controllers
  ["Record-Owner"] = "address123...",  -- Optional; only ANT owner/controllers
  ["Display-Name"] = "Example Site",   -- Optional (<= 61 chars)
  Logo = "logoTx123...",                -- Optional (valid Arweave TX)
  Description = "...",                  -- Optional (<= 512 chars)
  Keywords = '["defi","dao"]'        -- Optional (JSON array)
}
```

Permissions:

- New records: only ANT owner/controllers can create
- Existing records: record owner may update (ANT owner/controllers retain full
  control)
- Priority and explicit owner assignment require ANT owner/controllers

#### Approve-Primary-Name / Remove-Primary-Names

Approve-Primary-Name (Action: `Approve-Primary-Name`):

```lua
{
  Name = "alice",                     -- undername or base name
  ["IO-Process-Id"] = "ioTx...",     -- required IO process id
  Recipient = "ownerAddress"           -- must be a valid AO address
}
```

Permissions:

- ANT owner OR record owner may approve
- If record owner approves, `Recipient` must equal the caller

Remove-Primary-Names (Action: `Remove-Primary-Names`):

```lua
{
  ["IO-Process-Id"] = "ioTx...",
  Names = "name1,name2,name3"
}
```

Permissions:

- ANT owner OR corresponding record owner for each name

### Security Measures

1. **Permission Validation**: `assertHasPermission()` and
   `assertHasRecordPermission()`
2. **Input Validation**: All addresses, metadata, and parameters validated
3. **Notice System**: Proper notices sent for all ownership changes

### State Management

The ANT state includes all record ownership data:

```lua
Records = {
  ["example"] = {
    transactionId = "...",
    ttlSeconds = 3600,
    owner = "address123...",
    displayName = "Example Site",
    logo = "logoTx...",
    description = "A sample site",
    keywords = {"sample", "example"}
  }
}
```

## Usage Examples

### Assigning Record Ownership

```lua
-- ANT owner assigns ownership when creating a record
Send({
  Target = antProcessId,
  Action = "Set-Record",
  ["Sub-Domain"] = "alice",
  ["Transaction-Id"] = "tx123...",
  ["TTL-Seconds"] = "86400",
  ["Record-Owner"] = "aliceAddress123...",
  ["Display-Name"] = "Alice's Site"
})
```

### Record Owner Updates Their Record

```lua
-- Alice updates her own record
Send({
  Target = antProcessId,
  Action = "Set-Record",
  ["Sub-Domain"] = "alice",
  ["Transaction-Id"] = "newTx456...",
  ["TTL-Seconds"] = "3600"
})
```

### Transferring Record Ownership

```lua
-- Transfer a record to Bob (ANT owner/controller or current record owner)
Send({
  Target = antProcessId,
  Action = "Transfer-Record",
  ["Sub-Domain"] = "alice",
  Recipient = "bobAddress456..."
})
```

### Setting as Primary Name

```lua
-- Approve primary name (by ANT owner or record owner)
Send({
  Target = antProcessId,
  Action = "Approve-Primary-Name",
  Name = "alice",
  ["IO-Process-Id"] = "ioTx...",
  Recipient = "aliceAddress123..."  -- If record owner: must equal msg.From
})
```
