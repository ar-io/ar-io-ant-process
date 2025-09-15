-- Bitwise operations shim for Luerl compatibility
local bit = bit or {}

if not bit.band then
	-- Bitwise AND
	bit.band = function(a, b)
		local result = 0
		local bitval = 1
		while a > 0 and b > 0 do
			if a % 2 == 1 and b % 2 == 1 then
				result = result + bitval
			end
			bitval = bitval * 2
			a = math.floor(a / 2)
			b = math.floor(b / 2)
		end
		return result
	end
end

if not bit.bor then
	-- Bitwise OR
	bit.bor = function(a, b)
		local result = 0
		local bitval = 1
		while a > 0 or b > 0 do
			if a % 2 == 1 or b % 2 == 1 then
				result = result + bitval
			end
			bitval = bitval * 2
			a = math.floor(a / 2)
			b = math.floor(b / 2)
		end
		return result
	end
end

if not bit.bxor then
	-- Bitwise XOR
	bit.bxor = function(a, b)
		local result = 0
		local bitval = 1
		while a > 0 or b > 0 do
			if (a % 2) ~= (b % 2) then
				result = result + bitval
			end
			bitval = bitval * 2
			a = math.floor(a / 2)
			b = math.floor(b / 2)
		end
		return result
	end
end

if not bit.bnot then
	-- Bitwise NOT (64-bit)
	bit.bnot = function(a)
		return bit.bxor(a, 0xFFFFFFFFFFFFFFFF)
	end
end

if not bit.lshift then
	-- Left shift
	bit.lshift = function(a, n)
		return a * (2 ^ n)
	end
end

if not bit.rshift then
	-- Right shift
	bit.rshift = function(a, n)
		return math.floor(a / (2 ^ n))
	end
end

-- Shim string.pack and string.unpack if they don't exist
if not string.pack then
	string.pack = function(fmt, ...)
		-- Basic implementation for common formats
		local args = { ... }
		local result = ""

		if fmt == ">I4" then
			-- Big-endian 4-byte integer
			local n = args[1] or 0
			result = string.char(
				math.floor(n / 16777216) % 256,
				math.floor(n / 65536) % 256,
				math.floor(n / 256) % 256,
				n % 256
			)
		elseif fmt == "<I4" then
			-- Little-endian 4-byte integer
			local n = args[1] or 0
			result = string.char(
				n % 256,
				math.floor(n / 256) % 256,
				math.floor(n / 65536) % 256,
				math.floor(n / 16777216) % 256
			)
		elseif fmt == "<I8" then
			-- Little-endian 8-byte integer
			local n = args[1] or 0
			-- Split into high and low 32-bit parts
			local low = n % 4294967296
			local high = math.floor(n / 4294967296)
			result = string.char(
				low % 256,
				math.floor(low / 256) % 256,
				math.floor(low / 65536) % 256,
				math.floor(low / 16777216) % 256,
				high % 256,
				math.floor(high / 256) % 256,
				math.floor(high / 65536) % 256,
				math.floor(high / 16777216) % 256
			)
		else
			error("Unsupported pack format: " .. fmt)
		end

		return result
	end
end

if not string.unpack then
	string.unpack = function(fmt, data, pos)
		pos = pos or 1

		if fmt == ">I4" then
			-- Big-endian 4-byte integer
			local b1, b2, b3, b4 = string.byte(data, pos, pos + 3)
			local result = (b1 * 16777216) + (b2 * 65536) + (b3 * 256) + b4
			return result, pos + 4
		elseif fmt == "<I4" then
			-- Little-endian 4-byte integer
			local b1, b2, b3, b4 = string.byte(data, pos, pos + 3)
			local result = (b4 * 16777216) + (b3 * 65536) + (b2 * 256) + b1
			return result, pos + 4
		elseif fmt == "<I8" then
			-- Little-endian 8-byte integer
			local b1, b2, b3, b4, b5, b6, b7, b8 = string.byte(data, pos, pos + 7)
			local low = (b4 * 16777216) + (b3 * 65536) + (b2 * 256) + b1
			local high = (b8 * 16777216) + (b7 * 65536) + (b6 * 256) + b5
			local result = high * 4294967296 + low
			return result, pos + 8
		else
			error("Unsupported unpack format: " .. fmt)
		end
	end
end

-- General debug logging (Luerl compatible)
output = output or {}
output.logs = output.logs or {}

-- Simple debug logging function
local function debug_log(message)
	table.insert(output.logs, "[DEBUG] " .. tostring(message))
end

-- Replace debug functions with Luerl-compatible alternatives
if not debug then
	debug = {}
end

if not debug.traceback then
	debug.traceback = function(err)
		return "Error: " .. tostring(err) .. " (traceback not available in Luerl)"
	end
end

require(".common.main").init()
