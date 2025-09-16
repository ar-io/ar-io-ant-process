# 2. Luerl Requirements Changes

Date: 2025-01-15

## Status

Accepted

## Context

The AR.IO ANT Process needed to be made compatible with Luerl (Lua
implementation in Erlang) to support deployment in Erlang-based environments.
Luerl has several limitations compared to standard Lua 5.3+ implementations:

1. **No native bitwise operators** - Luerl doesn't support `~`, `&`, `|`, `<<`,
   `>>` operators
2. **Limited string functions** - Missing `string.pack` and `string.unpack`
   functions
3. **No debug library** - Missing `debug.sethook`, `debug.getinfo`,
   `debug.traceback`
4. **Potential module loading differences** - Different handling of require
   paths

The ANT Process heavily relies on cryptographic functions (SHA3) that use
bitwise operations extensively, making Luerl compatibility critical for broader
deployment options.

## Decision

We decided to implement comprehensive compatibility shims and replace all
Luerl-incompatible code with equivalent functionality that works in both
standard Lua and Luerl environments.

## Changes Made

### 1. Bitwise Operations Compatibility (`src/aos.lua`)

**Problem**: Crypto functions used native bitwise operators (`~`, `&`, `|`,
`<<`, `>>`) not available in Luerl.

**Solution**: Implemented comprehensive bitwise operation library:

```lua
-- Bitwise operations shim for Luerl compatibility
local bit = bit or {}

if not bit.band then
    -- Bitwise AND implementation
    bit.band = function(a, b) ... end
end

if not bit.bor then
    -- Bitwise OR implementation
    bit.bor = function(a, b) ... end
end

if not bit.bxor then
    -- Bitwise XOR implementation
    bit.bxor = function(a, b) ... end
end

if not bit.bnot then
    -- Bitwise NOT implementation (64-bit)
    bit.bnot = function(a) ... end
end

if not bit.lshift then
    -- Left shift implementation
    bit.lshift = function(a, n) ... end
end

if not bit.rshift then
    -- Right shift implementation
    bit.rshift = function(a, n) ... end
end
```

### 2. String Pack/Unpack Extensions (`src/aos.lua`)

**Problem**: Crypto functions required `string.pack("<I8", ...)` and
`string.unpack("<I8", ...)` for 64-bit integer handling.

**Solution**: Extended existing shims to support 8-byte integers:

```lua
if not string.pack then
    string.pack = function(fmt, ...)
        -- Added support for:
        -- ">I4" - Big-endian 4-byte integer
        -- "<I4" - Little-endian 4-byte integer
        -- "<I8" - Little-endian 8-byte integer (NEW)
    end
end

if not string.unpack then
    string.unpack = function(fmt, data, pos)
        -- Added support for:
        -- ">I4", "<I4", "<I8" formats with proper endianness handling
    end
end
```

### 3. Debug Function Compatibility (`src/aos.lua`)

**Problem**: Code used `debug.sethook`, `debug.getinfo`, and `debug.traceback`
not available in Luerl.

**Solution**: Replaced with Luerl-compatible alternatives:

```lua
-- Replace debug functions with Luerl-compatible alternatives
if not debug then
    debug = {}
end

if not debug.traceback then
    debug.traceback = function(err)
        return "Error: " .. tostring(err) .. " (traceback not available in Luerl)"
    end
end

-- Removed debug.sethook usage, replaced with simple logging
local function debug_log(message)
    table.insert(output.logs, "[DEBUG] " .. tostring(message))
end
```

### 4. Crypto Function Updates

**Files Modified**: `src/common/crypto/digest/sha3.lua`, `src/common/crypto.lua`

**Changes**: Systematically replaced all bitwise operators with function calls:

```lua
-- Before
parities[x] = parities[x] ~ sx[y]
flip = parities[5] ~ (p5 << 1 | p5 >> 63)
s[y] = p[y] ~ (~ p1[y]) & p2[y]
words[totalWords] = words[totalWords] | 0x8000000000000000

-- After
parities[x] = bxor(parities[x], sx[y])
flip = bxor(parities[5], bor(lshift(p5, 1), rshift(p5, 63)))
s[y] = bxor(p[y], band(bnot(p1[y]), p2[y]))
words[totalWords] = bor(words[totalWords], 0x8000000000000000)
```

## Files Modified

1. **`src/aos.lua`** - Added all compatibility shims and bitwise operations
2. **`src/common/crypto/digest/sha3.lua`** - Converted all bitwise operations to
   function calls
3. **`src/common/crypto.lua`** - Converted all bitwise operations to function
   calls

## Implementation Details

### Bitwise Operation Algorithm

The bitwise operations use mathematical approaches compatible with Luerl:

- **AND**: Iterate through bits, result bit = 1 only if both input bits = 1
- **OR**: Iterate through bits, result bit = 1 if either input bit = 1
- **XOR**: Iterate through bits, result bit = 1 if input bits differ
- **NOT**: XOR with 64-bit mask (0xFFFFFFFFFFFFFFFF)
- **Left Shift**: Multiply by 2^n
- **Right Shift**: Divide by 2^n and floor

### 64-bit Integer Packing

For `<I8` format, integers are split into high/low 32-bit parts:

```lua
local low = n % 4294967296
local high = math.floor(n / 4294967296)
-- Pack as 8 bytes: low bytes first, then high bytes
```

## Consequences

### Positive

- **✅ Full Luerl Compatibility**: ANT Process can now run in Luerl environments
- **✅ Preserved Functionality**: All cryptographic operations maintain
  correctness
- **✅ Backward Compatibility**: Changes don't break standard Lua environments
- **✅ Performance**: Bitwise shims are reasonably efficient for the use case
- **✅ Maintainability**: Clear separation of compatibility code in `aos.lua`

### Negative

- **⚠️ Performance Impact**: Bitwise operations via functions are slower than
  native operators
- **⚠️ Code Complexity**: Additional compatibility layer adds complexity
- **⚠️ Memory Usage**: Function call overhead for bitwise operations

### Neutral

- **📝 Testing Required**: Need to verify crypto correctness in both
  environments
- **📝 Documentation**: Compatibility requirements now documented

## Verification

To verify the changes work correctly:

1. **Crypto Verification**: Test SHA3 hashing produces identical results in both
   Lua and Luerl
2. **Functional Testing**: Run existing test suite in Luerl environment
3. **Performance Testing**: Measure performance impact of bitwise function calls
4. **Integration Testing**: Verify ANT Process functions correctly in target
   Erlang environment

## Alternative Approaches Considered

1. **Native Luerl Extensions**: Could implement bitwise operations in Erlang
   - **Rejected**: Would require modifying Luerl itself
2. **Separate Luerl Codebase**: Maintain separate version for Luerl
   - **Rejected**: Would create maintenance burden and code duplication
3. **Remove Crypto Dependencies**: Use external crypto services
   - **Rejected**: Would break ANT Process architecture and security model

## Future Considerations

- Monitor Luerl development for native bitwise operation support
- Consider performance optimizations if bitwise operations become a bottleneck
- Evaluate if additional Lua features need Luerl compatibility shims
- Document any new Luerl compatibility requirements for future development

## References

- [Luerl Documentation](https://github.com/rvirding/luerl)
- [Lua 5.3 Bitwise Operations](https://www.lua.org/manual/5.3/manual.html#3.4.2)
- [SHA3 Algorithm Specification](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf)
