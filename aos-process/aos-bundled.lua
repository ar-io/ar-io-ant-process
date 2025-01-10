

-- module: ".common.json"
local function _loaded_mod_common_json()
--
-- json.lua
--
-- Copyright (c) 2020 rxi
--
-- Permission is hereby granted, free of charge, to any person obtaining a copy of
-- this software and associated documentation files (the "Software"), to deal in
-- the Software without restriction, including without limitation the rights to
-- use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
-- of the Software, and to permit persons to whom the Software is furnished to do
-- so, subject to the following conditions:
--
-- The above copyright notice and this permission notice shall be included in all
-- copies or substantial portions of the Software.
--
-- THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
-- IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
-- FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
-- AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
-- LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
-- OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
-- SOFTWARE.
--

local json = { _version = "0.1.2" }

-------------------------------------------------------------------------------
-- Encode
-------------------------------------------------------------------------------

local encode

local escape_char_map = {
	["\\"] = "\\",
	['"'] = '"',
	["\b"] = "b",
	["\f"] = "f",
	["\n"] = "n",
	["\r"] = "r",
	["\t"] = "t",
}

local escape_char_map_inv = { ["/"] = "/" }
for k, v in pairs(escape_char_map) do
	escape_char_map_inv[v] = k
end

local function escape_char(c)
	return "\\" .. (escape_char_map[c] or string.format("u%04x", c:byte()))
end

local function encode_nil()
	return "null"
end

local function encode_table(val, stack)
	local res = {}
	stack = stack or {}

	-- Circular reference?
	if stack[val] then
		error("circular reference")
	end

	stack[val] = true

	if rawget(val, 1) ~= nil or next(val) == nil then
		-- Treat as array -- check keys are valid and it is not sparse
		local n = 0
		for k in pairs(val) do
			if type(k) ~= "number" then
				error("invalid table: mixed or invalid key types")
			end
			n = n + 1
		end
		if n ~= #val then
			error("invalid table: sparse array")
		end
		-- Encode
		for _, v in ipairs(val) do
			table.insert(res, encode(v, stack))
		end
		stack[val] = nil
		return "[" .. table.concat(res, ",") .. "]"
	else
		-- Treat as an object
		for k, v in pairs(val) do
			if type(k) ~= "string" then
				error("invalid table: mixed or invalid key types")
			end
			table.insert(res, encode(k, stack) .. ":" .. encode(v, stack))
		end
		stack[val] = nil
		return "{" .. table.concat(res, ",") .. "}"
	end
end

local function encode_string(val)
	return '"' .. val:gsub('[%z\1-\31\\"]', escape_char) .. '"'
end

local function encode_number(val)
	-- Check for NaN, -inf and inf
	if val ~= val or val <= -math.huge or val >= math.huge then
		error("unexpected number value '" .. tostring(val) .. "'")
	end
	return string.format("%.14g", val)
end

local type_func_map = {
	["nil"] = encode_nil,
	["table"] = encode_table,
	["string"] = encode_string,
	["number"] = encode_number,
	["boolean"] = tostring,
}

encode = function(val, stack)
	local t = type(val)
	local f = type_func_map[t]
	if f then
		return f(val, stack)
	end
	error("unexpected type '" .. t .. "'")
end

function json.encode(val)
	return (encode(val))
end

-------------------------------------------------------------------------------
-- Decode
-------------------------------------------------------------------------------

local parse

local function create_set(...)
	local res = {}
	for i = 1, select("#", ...) do
		res[select(i, ...)] = true
	end
	return res
end

local space_chars = create_set(" ", "\t", "\r", "\n")
local delim_chars = create_set(" ", "\t", "\r", "\n", "]", "}", ",")
local escape_chars = create_set("\\", "/", '"', "b", "f", "n", "r", "t", "u")
local literals = create_set("true", "false", "null")

local literal_map = {
	["true"] = true,
	["false"] = false,
	["null"] = nil,
}

local function next_char(str, idx, set, negate)
	for i = idx, #str do
		if set[str:sub(i, i)] ~= negate then
			return i
		end
	end
	return #str + 1
end

local function decode_error(str, idx, msg)
	local line_count = 1
	local col_count = 1
	for i = 1, idx - 1 do
		col_count = col_count + 1
		if str:sub(i, i) == "\n" then
			line_count = line_count + 1
			col_count = 1
		end
	end
	error(string.format("%s at line %d col %d", msg, line_count, col_count))
end

local function codepoint_to_utf8(n)
	-- http://scripts.sil.org/cms/scripts/page.php?site_id=nrsi&id=iws-appendixa
	local f = math.floor
	if n <= 0x7f then
		return string.char(n)
	elseif n <= 0x7ff then
		return string.char(f(n / 64) + 192, n % 64 + 128)
	elseif n <= 0xffff then
		return string.char(f(n / 4096) + 224, f(n % 4096 / 64) + 128, n % 64 + 128)
	elseif n <= 0x10ffff then
		return string.char(f(n / 262144) + 240, f(n % 262144 / 4096) + 128, f(n % 4096 / 64) + 128, n % 64 + 128)
	end
	error(string.format("invalid unicode codepoint '%x'", n))
end

local function parse_unicode_escape(s)
	local n1 = tonumber(s:sub(1, 4), 16)
	local n2 = tonumber(s:sub(7, 10), 16)
	-- Surrogate pair?
	if n2 then
		return codepoint_to_utf8((n1 - 0xd800) * 0x400 + (n2 - 0xdc00) + 0x10000)
	else
		return codepoint_to_utf8(n1)
	end
end

local function parse_string(str, i)
	local res = ""
	local j = i + 1
	local k = j

	while j <= #str do
		local x = str:byte(j)

		if x < 32 then
			decode_error(str, j, "control character in string")
		elseif x == 92 then -- `\`: Escape
			res = res .. str:sub(k, j - 1)
			j = j + 1
			local c = str:sub(j, j)
			if c == "u" then
				local hex = str:match("^[dD][89aAbB]%x%x\\u%x%x%x%x", j + 1)
					or str:match("^%x%x%x%x", j + 1)
					or decode_error(str, j - 1, "invalid unicode escape in string")
				res = res .. parse_unicode_escape(hex)
				j = j + #hex
			else
				if not escape_chars[c] then
					decode_error(str, j - 1, "invalid escape char '" .. c .. "' in string")
				end
				res = res .. escape_char_map_inv[c]
			end
			k = j + 1
		elseif x == 34 then -- `"`: End of string
			res = res .. str:sub(k, j - 1)
			return res, j + 1
		end

		j = j + 1
	end

	decode_error(str, i, "expected closing quote for string")
end

local function parse_number(str, i)
	local x = next_char(str, i, delim_chars)
	local s = str:sub(i, x - 1)
	local n = tonumber(s)
	if not n then
		decode_error(str, i, "invalid number '" .. s .. "'")
	end
	return n, x
end

local function parse_literal(str, i)
	local x = next_char(str, i, delim_chars)
	local word = str:sub(i, x - 1)
	if not literals[word] then
		decode_error(str, i, "invalid literal '" .. word .. "'")
	end
	return literal_map[word], x
end

local function parse_array(str, i)
	local res = {}
	local n = 1
	i = i + 1
	while 1 do
		local x
		i = next_char(str, i, space_chars, true)
		-- Empty / end of array?
		if str:sub(i, i) == "]" then
			i = i + 1
			break
		end
		-- Read token
		x, i = parse(str, i)
		res[n] = x
		n = n + 1
		-- Next token
		i = next_char(str, i, space_chars, true)
		local chr = str:sub(i, i)
		i = i + 1
		if chr == "]" then
			break
		end
		if chr ~= "," then
			decode_error(str, i, "expected ']' or ','")
		end
	end
	return res, i
end

local function parse_object(str, i)
	local res = {}
	i = i + 1
	while 1 do
		local key, val
		i = next_char(str, i, space_chars, true)
		-- Empty / end of object?
		if str:sub(i, i) == "}" then
			i = i + 1
			break
		end
		-- Read key
		if str:sub(i, i) ~= '"' then
			decode_error(str, i, "expected string for key")
		end
		key, i = parse(str, i)
		-- Read ':' delimiter
		i = next_char(str, i, space_chars, true)
		if str:sub(i, i) ~= ":" then
			decode_error(str, i, "expected ':' after key")
		end
		i = next_char(str, i + 1, space_chars, true)
		-- Read value
		val, i = parse(str, i)
		-- Set
		res[key] = val
		-- Next token
		i = next_char(str, i, space_chars, true)
		local chr = str:sub(i, i)
		i = i + 1
		if chr == "}" then
			break
		end
		if chr ~= "," then
			decode_error(str, i, "expected '}' or ','")
		end
	end
	return res, i
end

local char_func_map = {
	['"'] = parse_string,
	["0"] = parse_number,
	["1"] = parse_number,
	["2"] = parse_number,
	["3"] = parse_number,
	["4"] = parse_number,
	["5"] = parse_number,
	["6"] = parse_number,
	["7"] = parse_number,
	["8"] = parse_number,
	["9"] = parse_number,
	["-"] = parse_number,
	["t"] = parse_literal,
	["f"] = parse_literal,
	["n"] = parse_literal,
	["["] = parse_array,
	["{"] = parse_object,
}

parse = function(str, idx)
	local chr = str:sub(idx, idx)
	local f = char_func_map[chr]
	if f then
		return f(str, idx)
	end
	decode_error(str, idx, "unexpected character '" .. chr .. "'")
end

function json.decode(str)
	if type(str) ~= "string" then
		error("expected argument of type string, got " .. type(str))
	end
	local res, idx = parse(str, next_char(str, 1, space_chars, true))
	idx = next_char(str, idx, space_chars, true)
	if idx <= #str then
		decode_error(str, idx, "trailing garbage")
	end
	return res
end

return json

end

_G.package.loaded[".common.json"] = _loaded_mod_common_json()

-- module: ".common.crypto.init"
local function _loaded_mod_common_crypto_init()
local util = require(".crypto.util.init")
local digest = require(".crypto.digest.init")

local crypto = {
	_version = "0.0.1",
	digest = digest,
	utils = util,
}

return crypto

end

_G.package.loaded[".common.crypto.init"] = _loaded_mod_common_crypto_init()

-- module: ".common.constants"
local function _loaded_mod_common_constants()
local constants = {}

constants.MAX_UNDERNAME_LENGTH = 61
constants.UNDERNAME_DOES_NOT_EXIST_MESSAGE = "Name does not exist in the ANT!"
constants.INVALID_ARWEAVE_ID_MESSAGE = "Invalid Arweave ID"
constants.MIN_TTL_SECONDS = 900
constants.MAX_TTL_SECONDS = 3600
constants.INVALID_TTL_MESSAGE = "Invalid TTL. TLL must be an integer between "
	.. constants.MIN_TTL_SECONDS
	.. " and "
	.. constants.MAX_TTL_SECONDS
	.. " seconds"

return constants

end

_G.package.loaded[".common.constants"] = _loaded_mod_common_constants()

-- module: ".common.notices"
local function _loaded_mod_common_notices()
local json = require("json")
local notices = {}

--- @param oldMsg AoMessage
--- @param newMsg AoMessage
--- @description Add forwarded tags to the new message
--- @return AoMessage
function notices.addForwardedTags(oldMsg, newMsg)
	if oldMsg.Cast then
		return newMsg
	end
	for tagName, tagValue in pairs(oldMsg) do
		-- Tags beginning with "X-" are forwarded
		if string.sub(tagName, 1, 2) == "X-" then
			newMsg[tagName] = tagValue
		end
	end
	return newMsg
end

--- @param msg AoMessage
--- @description Create a credit notice message
--- @return AoMessage
function notices.credit(msg)
	return notices.addForwardedTags(msg, {
		Target = msg.Recipient,
		Action = "Credit-Notice",
		Sender = msg.From,
		Quantity = tostring(1),
	})
end

--- @param msg AoMessage
--- @description Create a debit notice message
--- @return AoMessage
function notices.debit(msg)
	return notices.addForwardedTags(msg, {
		Target = msg.From,
		Action = "Debit-Notice",
		Recipient = msg.Recipient,
		Quantity = tostring(1),
	})
end

--- @param noticesToSend table<AoMessage>
function notices.sendNotices(noticesToSend)
	for _, notice in ipairs(noticesToSend) do
		ao.send(notice)
	end
end

--- @param msg AoMessage
--- @param target string
--- @description Notify the target of the current state
--- @return nil
function notices.notifyState(msg, target)
	if not target then
		print("No target specified for state notice")
		return
	end

	---@type AntState
	local state = {
		Records = Records,
		Controllers = Controllers,
		Balances = Balances,
		Owner = Owner,
		Name = Name,
		Ticker = Ticker,
		Logo = Logo,
		Description = Description,
		Keywords = Keywords,
		Denomination = Denomination,
		TotalSupply = TotalSupply,
		Initialized = Initialized,
	}

	ao.send(notices.addForwardedTags(msg, {
		Target = target,
		Action = "State-Notice",
		Data = json.encode(state),
	}))
end

return notices

end

_G.package.loaded[".common.notices"] = _loaded_mod_common_notices()

-- module: ".common.utils"
local function _loaded_mod_common_utils()
-- the majority of this file came from https://github.com/permaweb/aos/blob/main/process/utils.lua
local crypto = require(".common.crypto.init")
local constants = require(".common.constants")
local json = require(".common.json")
local notices = require(".common.notices")
local utils = { _version = "0.0.1" }

--- @param t table
utils.keys = function(t)
	assert(type(t) == "table", "argument needs to be a table")
	local keys = {}
	for key in pairs(t) do
		table.insert(keys, key)
	end
	return keys
end

function utils.hasMatchingTag(tag, value)
	return Handlers.utils.hasMatchingTag(tag, value)
end

--- Deep copies a table
--- @param original table The table to copy
--- @return table|nil The deep copy of the table or nil if the original is nil
function utils.deepCopy(original)
	if not original then
		return nil
	end

	if type(original) ~= "table" then
		return original
	end

	local copy = {}
	for key, value in pairs(original) do
		if type(value) == "table" then
			copy[key] = utils.deepCopy(value) -- Recursively copy the nested table
		else
			copy[key] = value
		end
	end
	return copy
end

--- Splits a string by a delimiter
--- @param input string The string to split
--- @param delimiter string|nil The delimiter to split by, defaults to ","
--- @return table The split string
function utils.splitString(input, delimiter)
	delimiter = delimiter or ","
	local result = {}
	for token in (input or ""):gmatch(string.format("([^%s]+)", delimiter)) do
		table.insert(result, token)
	end
	return result
end
-- NOTE: lua 5.3 has limited regex support, particularly for lookaheads and negative lookaheads or use of {n}
---@param name string
---@description Asserts that the provided name is a valid undername
---@example
---```lua
---utils.validateUndername("my-undername")
---```
function utils.validateUndername(name)
	local validLength = #name <= constants.MAX_UNDERNAME_LENGTH
	local validRegex = string.match(name, "^@$") ~= nil
		or string.match(name, "^[a-zA-Z0-9][a-zA-Z0-9_-]*[a-zA-Z0-9]$") ~= nil
	local valid = validLength and validRegex
	assert(valid, constants.UNDERNAME_DOES_NOT_EXIST_MESSAGE)
end

--- Checks if an address is a valid Arweave address
--- @param address string The address to check
--- @return boolean isValidArweaveAddress - whether the address is a valid Arweave address
function utils.isValidArweaveAddress(address)
	return type(address) == "string" and #address == 43 and string.match(address, "^[%w-_]+$") ~= nil
end

--- Checks if an address is a valid Ethereum address
--- @param address string The address to check
--- @return boolean isValidEthAddress - whether the address is a valid Ethereum address
function utils.isValidEthAddress(address)
	return type(address) == "string" and #address == 42 and string.match(address, "^0x[%x]+$") ~= nil
end

function utils.isValidUnsafeAddress(address)
	if not address then
		return false
	end
	local match = string.match(address, "^[%w_-]+$")
	return match ~= nil and #address >= 1 and #address <= 128
end

--- Checks if an address is a valid AO address
--- @param address string|nil The address to check
--- @param allowUnsafe boolean Whether to allow unsafe addresses, defaults to false
--- @return boolean isValidAddress - whether the address is valid, depending on the allowUnsafe flag
function utils.isValidAOAddress(address, allowUnsafe)
	allowUnsafe = allowUnsafe or false -- default to false, only allow unsafe addresses if explicitly set
	if not address then
		return false
	end
	if allowUnsafe then
		return utils.isValidUnsafeAddress(address)
	end
	return utils.isValidArweaveAddress(address) or utils.isValidEthAddress(address)
end

--- Converts an address to EIP-55 checksum format
--- Assumes address has been validated as a valid Ethereum address (see utils.isValidEthAddress)
--- Reference: https://eips.ethereum.org/EIPS/eip-55
--- @param address string The address to convert
--- @return string formattedAddress - the EIP-55 checksum formatted address
function utils.formatEIP55Address(address)
	local hex = string.lower(string.sub(address, 3))

	local hash = crypto.digest.keccak256(hex)
	local hashHex = hash.asHex()

	local checksumAddress = "0x"

	for i = 1, #hashHex do
		local hexChar = string.sub(hashHex, i, i)
		local hexCharValue = tonumber(hexChar, 16)
		local char = string.sub(hex, i, i)
		if hexCharValue > 7 then
			char = string.upper(char)
		end
		checksumAddress = checksumAddress .. char
	end

	return checksumAddress
end

--- Formats an address to EIP-55 checksum format if it is a valid Ethereum address
--- @param address string The address to format
--- @return string formattedAddress - the EIP-55 checksum formatted address
function utils.formatAddress(address)
	if utils.isValidEthAddress(address) then
		return utils.formatEIP55Address(address)
	end
	return address
end

---@param ttl integer
---@description Asserts that the ttl is a valid number
---@example
---```lua
---utils.validateTTLSeconds(3600)
---```
function utils.validateTTLSeconds(ttl)
	local valid = type(ttl) == "number" and ttl >= constants.MIN_TTL_SECONDS and ttl <= constants.MAX_TTL_SECONDS
	assert(valid, constants.INVALID_TTL_MESSAGE)
end

---@param caller string
---@description Asserts that the caller is the owner
---@example
---```lua
---utils.validateOwner(msg.From)
---```
function utils.validateOwner(caller)
	local isOwner = false
	if Owner == caller or Balances[caller] or ao.env.Process.Id == caller then
		isOwner = true
	end
	assert(isOwner, "Sender is not the owner.")
end

--- @param from string
--- @description Asserts that the caller is the owner or a controller
--- @example
--- ```lua
--- utils.assertHasPermission(msg.From)
--- ```
function utils.assertHasPermission(from)
	for _, c in ipairs(Controllers) do
		if c == from then
			-- if is controller, return true
			return
		end
	end
	if Owner == from then
		return
	end
	if ao.env.Process.Id == from then
		return
	end
	assert(false, "Only controllers and owners can set controllers, records, and change metadata.")
end

function utils.camelCase(str)
	-- Remove any leading or trailing spaces
	str = string.gsub(str, "^%s*(.-)%s*$", "%1")

	-- Convert PascalCase to camelCase
	str = string.gsub(str, "^%u", string.lower)

	-- Handle kebab-case, snake_case, and space-separated words
	str = string.gsub(str, "[-_%s](%w)", function(s)
		return string.upper(s)
	end)

	return str
end

---@description gets the state of the relavent ANT globals
---@return AntState
function utils.getState()
	return {
		Records = Records,
		Controllers = Controllers,
		Balances = Balances,
		Owner = Owner,
		Name = Name,
		Ticker = Ticker,
		Logo = Logo,
		Description = Description,
		Keywords = Keywords,
		Denomination = Denomination,
		TotalSupply = TotalSupply,
		Initialized = Initialized,
	}
end

--- @param handlers Handlers
--- @description Get the names of all handlers
--- @return string[]
function utils.getHandlerNames(handlers)
	local names = {}

	for _, handler in ipairs(handlers.list) do
		table.insert(names, handler.name)
	end
	return names
end

--- @param err any
--- @description Error handler for xpcall
--- @return string
function utils.errorHandler(err)
	return debug.traceback(err)
end

---@param tagName string
---@param tagValue string
---@param handler function
---@param position "add" | "prepend" | "append" | nil
---@description
---Creates a handler for a specific tag
---If the handler returns a string, it will be sent as a notice to the sender
---If the Owner or Controllers change, a state notice will be sent to the sender
---If a handler throws an error, an error notice will be sent to the sender
---@example
---```lua
---utils.createHandler("Action", "InitializeState", function(msg) print("Initializing state") end)
---```
function utils.createHandler(tagName, tagValue, handler, position)
	assert(
		type(position) == "string" or type(position) == "nil",
		utils.errorHandler("Position must be a string or nil")
	)
	assert(
		position == nil or position == "add" or position == "prepend" or position == "append",
		"Position must be one of 'add', 'prepend', 'append'"
	)
	return Handlers[position or "add"](
		utils.camelCase(tagValue),
		Handlers.utils.continue(Handlers.utils.hasMatchingTag(tagName, tagValue)),
		function(msg)
			-- handling for eth EIP-55 format, returns address if is not eth address
			msg.From = utils.formatAddress(msg.From)
			local knownAddressTags = {
				"Recipient",
				"Controller",
			}
			for _, tName in ipairs(knownAddressTags) do
				-- Format all incoming addresses
				msg.Tags[tName] = msg.Tags[tName] and utils.formatAddress(msg.Tags[tName]) or nil
				-- aos assigns tag values to the base message level as well
				msg[tName] = msg[tName] and utils.formatAddress(msg[tName]) or nil
			end

			-- sometimes the message id is not present on dryrun so we add a stub string to prevent issues with concat string
			print("Handling Action [" .. msg.Id or "no-msg-id" .. "]: " .. tagValue)
			local prevOwner = tostring(Owner)
			local prevControllers = utils.deepCopy(Controllers)
			assert(prevControllers, "Unable to deep copy controllers")

			local handlerStatus, handlerRes = xpcall(function()
				return handler(msg)
			end, utils.errorHandler)

			if not handlerStatus then
				ao.send(notices.addForwardedTags(msg, {
					Target = msg.From,
					Action = "Invalid-" .. tagValue .. "-Notice",
					Error = tagValue .. "-Error",
					["Message-Id"] = msg.Id,
					Data = handlerRes,
				}))
			elseif handlerRes then
				ao.send(notices.addForwardedTags(msg, {
					Target = msg.From,
					Action = tagValue .. "-Notice",
					Data = type(handlerRes) == "string" and handlerRes or json.encode(handlerRes),
				}))
			end

			local hasNewOwner = Owner ~= prevOwner
			local hasDifferentControllers = #utils.keys(Controllers) ~= #utils.keys(prevControllers)
			if (hasNewOwner or hasDifferentControllers) and tagValue ~= "State" and AntRegistryId ~= nil then
				notices.notifyState(msg, AntRegistryId)
			end

			return handlerRes
		end
	)
end

---@param action string
---@param msgHandler function
---@param position "add" | "prepend" | "append" | nil
function utils.createActionHandler(action, msgHandler, position)
	return utils.createHandler("Action", action, msgHandler, position)
end

---@param keywords string[]
---@description Validates the keywords
---Amount of keywords must be less than or equal to 16
---Each keyword must be a unique string of 32 characters or less
---@example
---```lua
---utils.validateKeywords({"keyword1", "keyword2"})
---```
function utils.validateKeywords(keywords)
	assert(type(keywords) == "table", "Keywords must be an array")
	assert(#keywords <= 16, "There must not be more than 16 keywords")

	local seenKeywords = {} -- Table to track seen keywords

	for _, keyword in ipairs(keywords) do
		assert(type(keyword) == "string", "Each keyword must be a string")
		assert(#keyword <= 32, "Each keyword must not be longer than 32 characters")
		assert(not keyword:find("%s"), "Keywords must not contain spaces")
		assert(
			keyword:match("^[%w-_#@]+$"),
			"Keywords must only contain alphanumeric characters, dashes, underscores, #, or @"
		)
		-- Check for duplicates
		assert(not seenKeywords[keyword], "Duplicate keyword detected: " .. keyword)
		seenKeywords[keyword] = true
	end
end

return utils

end

_G.package.loaded[".common.utils"] = _loaded_mod_common_utils()

-- module: ".common.balances"
local function _loaded_mod_common_balances()
--- Module for managing balances and transactions.
-- @module balances

local utils = require(".common.utils")

local balances = {}

---@alias AllowUnsafeAddresses boolean Whether to allow unsafe addresses

--- Transfers the ANT to a specified wallet.
---@param to string - The wallet address to transfer the balance to.
---@param allowUnsafeAddresses AllowUnsafeAddresses
---@return table<string, integer>
function balances.transfer(to, allowUnsafeAddresses)
	assert(utils.isValidAOAddress(to, allowUnsafeAddresses), "Invalid AO Address")
	Balances = { [to] = 1 }
	--luacheck: ignore Owner Controllers
	Owner = to
	Controllers = {}

	return { [to] = 1 }
end

--- Retrieves the balance of a specified wallet.
---@param address string - The wallet address to retrieve the balance from.
---@param allowUnsafeAddresses AllowUnsafeAddresses
---@return integer - Returns the balance of the specified wallet.
function balances.balance(address, allowUnsafeAddresses)
	assert(utils.isValidAOAddress(address, allowUnsafeAddresses), "Invalid AO Address")
	local balance = Balances[address] or 0
	return balance
end

--- Retrieves all balances.
---@return table<string, integer> - Returns the encoded JSON representation of all balances.
function balances.balances()
	return Balances
end

--- Sets the name of the ANT.
---@param name string - The name to set.
---@return table<string, string>
function balances.setName(name)
	assert(type(name) == "string", "Name must be a string")
	Name = name
	return { Name = Name }
end

--- Sets the ticker of the ANT.
---@param ticker string - The ticker to set.
---@return table<string, string>
function balances.setTicker(ticker)
	assert(type(ticker) == "string", "Ticker must be a string")
	Ticker = ticker
	return { Ticker = Ticker }
end

--- Sets the description of the ANT.
---@param description string - The description to set.
---@return table<string, string>
function balances.setDescription(description)
	assert(type(description) == "string", "Description must be a string")
	assert(#description <= 512, "Description must not be longer than 512 characters")
	Description = description
	return { Description = Description }
end

--- Sets the keywords of the ANT.
---@param keywords table - The keywords to set.
---@return table<string, string>
function balances.setKeywords(keywords)
	utils.validateKeywords(keywords)

	Keywords = keywords
	return { Keywords = Keywords }
end

--- Sets the logo of the ANT.
---@param logo string - The Arweave transaction ID that represents the logo.
---@return table<string, string>
function balances.setLogo(logo)
	assert(utils.isValidArweaveAddress(logo), "Invalid arweave ID")
	Logo = logo
	return { Logo = Logo }
end

return balances

end

_G.package.loaded[".common.balances"] = _loaded_mod_common_balances()

-- module: ".common.initialize"
local function _loaded_mod_common_initialize()
local utils = require(".common.utils")
local json = require(".common.json")
local initialize = {}

function initialize.initializeANTState(state)
	local encoded = json.decode(state)
	local balances = encoded.balances
	local controllers = encoded.controllers
	local records = encoded.records
	local name = encoded.name
	local ticker = encoded.ticker
	local description = encoded.description
	local keywords = encoded.keywords
	local owner = encoded.owner
	assert(type(name) == "string", "name must be a string")
	assert(type(ticker) == "string", "ticker must be a string")
	assert(type(description) == "string", "description must be a string")
	assert(#description <= 512, "Description must not be longer than 512 characters")
	assert(type(balances) == "table", "balances must be a table")
	for k, v in pairs(balances) do
		balances[k] = tonumber(v)
	end
	assert(type(controllers) == "table", "controllers must be a table")
	assert(type(records) == "table", "records must be a table")
	assert(type(owner) == "string", "owner must be a string")
	for k, v in pairs(records) do
		utils.validateUndername(k)
		assert(type(v) == "table", "records values must be tables")
		assert(utils.isValidArweaveAddress(v.transactionId), "Invalid arweave ID")
		utils.validateTTLSeconds(v.ttlSeconds)
	end

	utils.validateKeywords(keywords)

	Name = name
	Ticker = ticker
	Description = description
	Keywords = keywords
	Balances = balances
	Controllers = controllers
	Records = records
	Initialized = true
	Owner = owner

	return json.encode({
		name = Name,
		ticker = Ticker,
		description = Description,
		keywords = Keywords,
		balances = Balances,
		controllers = Controllers,
		records = Records,
		owner = Owner,
		initialized = Initialized,
	})
end

local function findObject(array, key, value)
	for _, object in ipairs(array) do
		if object[key] == value then
			return object
		end
	end
	return nil
end

function initialize.initializeProcessState(msg, env)
	Errors = Errors or {}
	Inbox = Inbox or {}

	-- temporary fix for Spawn
	if not Owner then
		local _from = findObject(env.Process.Tags, "name", "From-Process")
		if _from then
			Owner = _from.value
		else
			Owner = msg.From
		end
	end

	if not Name then
		local taggedName = findObject(env.Process.Tags, "name", "Name")
		if taggedName then
			Name = taggedName.value
		else
			Name = "ANT"
		end
	end
end

return initialize

end

_G.package.loaded[".common.initialize"] = _loaded_mod_common_initialize()

-- module: ".common.records"
local function _loaded_mod_common_records()
local utils = require(".common.utils")
local records = {}
-- defaults to landing page txid
Records = Records or { ["@"] = { transactionId = "-k7t8xMoB8hW482609Z9F4bTFMC3MnuW8bTvTyT8pFI", ttlSeconds = 3600 } }

--- Set a record in the Records of the ANT.
---@param name string The name of the record.
---@param transactionId string The transaction ID of the record.
---@param ttlSeconds number The time-to-live in seconds for the record.
---@return Record
function records.setRecord(name, transactionId, ttlSeconds)
	utils.validateUndername(name)
	assert(utils.isValidArweaveAddress(transactionId), "Invalid Arweave ID")
	utils.validateTTLSeconds(ttlSeconds)

	local recordsCount = #Records

	if recordsCount >= 10000 then
		error("Max records limit of 10,000 reached, please delete some records to make space")
	end

	Records[name] = {
		transactionId = transactionId,
		ttlSeconds = ttlSeconds,
	}

	return {
		transactionId = transactionId,
		ttlSeconds = ttlSeconds,
	}
end

--- Remove a record from the ANT.
---@param name string The name of the record to remove.
---@return table<string, Record> Returns the records of the ANT
function records.removeRecord(name)
	utils.validateUndername(name)
	Records[name] = nil
	return Records
end

--- Get a record from the ANT.
---@param name string The name of the record to retrieve.
---@return Record
function records.getRecord(name)
	utils.validateUndername(name)
	assert(Records[name] ~= nil, "Record does not exist")

	return Records[name]
end

--- Get all records from the ANT
---@alias RecordEntry {
--- transactionId: string,
--- ttlSeconds: integer,
---}
---@return table<string, RecordEntry> The sorted records of the ANT
function records.getRecords()
	local antRecords = utils.deepCopy(Records)
	assert(antRecords, "Failed to copy Records")

	return antRecords
end

return records

end

_G.package.loaded[".common.records"] = _loaded_mod_common_records()

-- module: ".common.controllers"
local function _loaded_mod_common_controllers()
local utils = require(".common.utils")

local controllers = {}

--- Set a controller.
---@param controller string The controller to set.
---@param allowUnsafeAddresses AllowUnsafeAddresses
---@return string[]
function controllers.setController(controller, allowUnsafeAddresses)
	assert(utils.isValidAOAddress(controller, allowUnsafeAddresses), "Invalid AO Address")

	for _, c in ipairs(Controllers) do
		assert(c ~= controller, "Controller already exists")
	end

	table.insert(Controllers, controller)
	return Controllers
end

--- Remove a controller.
---@param controller string The controller to remove.
---@return string[]
function controllers.removeController(controller)
	assert(type(controller) == "string", "Controller must be a string")
	local controllerExists = false

	for i, v in ipairs(Controllers) do
		if v == controller then
			table.remove(Controllers, i)
			controllerExists = true
			break
		end
	end

	assert(controllerExists ~= false, "Controller does not exist")
	return Controllers
end

--- Get all controllers.
---@return string[]
function controllers.getControllers()
	return Controllers
end

return controllers

end

_G.package.loaded[".common.controllers"] = _loaded_mod_common_controllers()

-- module: ".common.main"
local function _loaded_mod_common_main()
local ant = {}

function ant.init()
	-- main.lua
	-- utils
	local json = require(".common.json")
	local utils = require(".common.utils")
	local notices = require(".common.notices")
	local createActionHandler = utils.createActionHandler

	-- spec modules
	local balances = require(".common.balances")
	local initialize = require(".common.initialize")
	local records = require(".common.records")
	local controllers = require(".common.controllers")

	---@alias Owner string
	---@description The owner of the ANT
	Owner = Owner or ao.env.Process.Owner
	---@alias Balances table<string, integer>
	---@description The list of balances for the ANT
	Balances = Balances or { [Owner] = 1 }
	---@alias Controllers table<integer, string>
	---@description The list of controllers for the ANT
	Controllers = Controllers or { Owner }

	---@alias Name string
	---@description The name of the ANT
	Name = Name or "Arweave Name Token"
	---@alias Ticker string
	---@description The ticker symbol of the ANT
	Ticker = Ticker or "ANT"
	---@alias Logo string
	---@description Arweave transaction ID that is the logo of the ANT
	Logo = Logo or "Sie_26dvgyok0PZD_-iQAFOhOd5YxDTkczOLoqTTL_A"
	---@alias Description string
	---@description A brief description of this ANT up to 255 characters
	Description = Description or "A brief description of this ANT."
	---@alias Keywords string[]
	---@description A list of keywords that describe this ANT. Each keyword must be a string, unique, and less than 32 characters. There can be up to 16 keywords
	Keywords = Keywords or {}
	---@alias Denomination integer
	---@description The denomination of the ANT - this is set to 0 to denote integer values
	Denomination = Denomination or 0
	---@alias TotalSupply integer
	---@description The total supply of the ANT - this is set to 1 to denote single ownership
	TotalSupply = TotalSupply or 1
	---@alias Initialized boolean
	---@description Whether the ANT has been initialized with the
	Initialized = Initialized or false
	---@alias AntRegistryId string
	---@description The Arweave ID of the ANT Registry contract that this ANT is registered with
	AntRegistryId = AntRegistryId or ao.env.Process.Tags["ANT-Registry-Id"] or nil

	local ActionMap = {
		-- write
		AddController = "Add-Controller",
		RemoveController = "Remove-Controller",
		SetRecord = "Set-Record",
		RemoveRecord = "Remove-Record",
		SetName = "Set-Name",
		SetTicker = "Set-Ticker",
		SetDescription = "Set-Description",
		SetKeywords = "Set-Keywords",
		SetLogo = "Set-Logo",
		--- initialization method for bootstrapping the contract from other platforms ---
		InitializeState = "Initialize-State",
		-- read
		Controllers = "Controllers",
		Record = "Record",
		Records = "Records",
		State = "State",
		Evolve = "Evolve",
		-- IO Network Contract Handlers
		ReleaseName = "Release-Name",
		ReassignName = "Reassign-Name",
		ApproveName = "Approve-Primary-Name",
		RemoveNames = "Remove-Primary-Names",
	}

	local TokenSpecActionMap = {
		Info = "Info",
		Balances = "Balances",
		Balance = "Balance",
		Transfer = "Transfer",
		TotalSupply = "Total-Supply",
	}

	createActionHandler(TokenSpecActionMap.Transfer, function(msg)
		local recipient = msg.Tags.Recipient
		utils.validateOwner(msg.From)
		balances.transfer(recipient, msg.Tags["Allow-Unsafe-Addresses"])
		if not msg.Cast then
			ao.send(notices.debit(msg))
			ao.send(notices.credit(msg))
		end
	end)

	createActionHandler(TokenSpecActionMap.Balance, function(msg)
		local balRes = balances.balance(msg.Tags.Recipient or msg.From, msg.Tags["Allow-Unsafe-Addresses"])

		ao.send({
			Target = msg.From,
			Action = "Balance-Notice",
			Balance = tostring(balRes),
			Ticker = Ticker,
			Address = msg.Tags.Recipient or msg.From,
			Data = balRes,
		})
	end)

	createActionHandler(TokenSpecActionMap.Balances, function()
		return balances.balances()
	end)

	createActionHandler(TokenSpecActionMap.TotalSupply, function(msg)
		assert(msg.From ~= ao.id, "Cannot call Total-Supply from the same process!")

		ao.send({
			Target = msg.From,
			Action = "Total-Supply-Notice",
			Data = TotalSupply,
			Ticker = Ticker,
		})
	end)

	createActionHandler(TokenSpecActionMap.Info, function(msg)
		local info = {
			Name = Name,
			Ticker = Ticker,
			["Total-Supply"] = tostring(TotalSupply),
			Logo = Logo,
			Description = Description,
			Keywords = Keywords,
			Denomination = tostring(Denomination),
			Owner = Owner,
			Handlers = utils.getHandlerNames(Handlers),
		}
		ao.send({
			Target = msg.From,
			Action = "Info-Notice",
			Tags = info,
			Data = json.encode(info),
		})
	end)

	-- ActionMap (ANT Spec)

	createActionHandler(ActionMap.AddController, function(msg)
		utils.assertHasPermission(msg.From)
		return controllers.setController(msg.Tags.Controller, msg.Tags["Allow-Unsafe-Addresses"])
	end)

	createActionHandler(ActionMap.RemoveController, function(msg)
		utils.assertHasPermission(msg.From)
		return controllers.removeController(msg.Tags.Controller)
	end)

	createActionHandler(ActionMap.Controllers, function()
		return controllers.getControllers()
	end)

	createActionHandler(ActionMap.SetRecord, function(msg)
		utils.assertHasPermission(msg.From)
		local tags = msg.Tags
		local name, transactionId, ttlSeconds =
			string.lower(tags["Sub-Domain"]), tags["Transaction-Id"], tonumber(tags["TTL-Seconds"])
		assert(ttlSeconds, "Missing ttl seconds")
		return records.setRecord(name, transactionId, ttlSeconds)
	end)

	createActionHandler(ActionMap.RemoveRecord, function(msg)
		utils.assertHasPermission(msg.From)
		return records.removeRecord(string.lower(msg.Tags["Sub-Domain"]))
	end)

	createActionHandler(ActionMap.Record, function(msg)
		local name = string.lower(msg.Tags["Sub-Domain"])
		return records.getRecord(name)
	end)

	createActionHandler(ActionMap.Records, function()
		return records.getRecords()
	end)

	createActionHandler(ActionMap.SetName, function(msg)
		utils.assertHasPermission(msg.From)
		return balances.setName(msg.Tags.Name)
	end)

	createActionHandler(ActionMap.SetTicker, function(msg)
		utils.assertHasPermission(msg.From)
		return balances.setTicker(msg.Tags.Ticker)
	end)

	createActionHandler(ActionMap.SetDescription, function(msg)
		utils.assertHasPermission(msg.From)
		return balances.setDescription(msg.Tags.Description)
	end)

	createActionHandler(ActionMap.SetKeywords, function(msg)
		utils.assertHasPermission(msg.From)
		local success, keywords = pcall(json.decode, msg.Tags.Keywords)
		assert(success and type(keywords) == "table", "Invalid JSON format for keywords")
		return balances.setKeywords(keywords)
	end)

	createActionHandler(ActionMap.SetLogo, function(msg)
		utils.assertHasPermission(msg.From)
		return balances.setLogo(msg.Logo)
	end)

	createActionHandler(ActionMap.InitializeState, function(msg)
		return initialize.initializeANTState(msg.Data)
	end)

	createActionHandler(ActionMap.State, function(msg)
		notices.notifyState(msg, msg.From)
	end)

	-- IO Network Contract Handlers

	createActionHandler(ActionMap.ReleaseName, function(msg)
		utils.validateOwner(msg.From)
		assert(utils.isValidArweaveAddress(msg.Tags["IO-Process-Id"]), "Invalid Arweave ID")

		assert(msg.Tags.Name, "Name is required")

		local name = string.lower(msg.Tags.Name)
		local ioProcess = msg.Tags["IO-Process-Id"]

		-- send the release message to the provided IO Process Id
		ao.send({
			Target = ioProcess,
			Action = "Release-Name",
			Initiator = msg.From,
			Name = name,
		})

		ao.send({
			Target = msg.From,
			Action = "Release-Name-Notice",
			Initiator = msg.From,
			Name = name,
		})
	end)

	createActionHandler(ActionMap.ReassignName, function(msg)
		utils.validateOwner(msg.From)
		assert(utils.isValidArweaveAddress(msg.Tags["Process-Id"]), "Invalid Arweave ID")

		assert(msg.Tags.Name, "Name is required")

		local name = string.lower(msg.Tags.Name)
		local ioProcess = msg.Tags["IO-Process-Id"]
		local antProcessIdToReassign = msg.Tags["Process-Id"]

		-- send the release message to the provided IO Process Id
		ao.send({
			Target = ioProcess,
			Action = "Reassign-Name",
			Initiator = msg.From,
			Name = name,
			["Process-Id"] = antProcessIdToReassign,
		})

		ao.send({
			Target = msg.From,
			Action = "Reassign-Name-Notice",
			Initiator = msg.From,
			Name = name,
			["Process-Id"] = antProcessIdToReassign,
		})
	end)

	createActionHandler(ActionMap.ApproveName, function(msg)
		--- NOTE: this could be modified to allow specific users/controllers to create claims
		utils.validateOwner(msg.From)

		assert(utils.isValidArweaveAddress(msg.Tags["IO-Process-Id"]), "Invalid Arweave ID")
		assert(utils.isValidAOAddress(msg.Tags.Recipient, msg.Tags["Allow-Unsafe-Addresses"]), "Invalid AO Address")

		assert(msg.Tags.Name, "Name is required")

		local name = string.lower(msg.Tags.Name)
		local recipient = msg.Tags.Recipient
		local ioProcess = msg.Tags["IO-Process-Id"]

		ao.send({
			Target = ioProcess,
			Action = "Approve-Primary-Name-Request",
			Name = name,
			Recipient = recipient,
		})
	end)

	createActionHandler(ActionMap.RemoveNames, function(msg)
		--- NOTE: this could be modified to allow specific users/controllers to remove primary names
		utils.validateOwner(msg.From)
		assert(utils.isValidArweaveAddress(msg.Tags["IO-Process-Id"]), "Invalid Arweave ID")

		assert(msg.Tags.Names, "Names are required")

		local ioProcess = msg.Tags["IO-Process-Id"]
		local names = utils.splitString(msg.Tags.Names)
		for _, name in ipairs(names) do
			utils.validateUndername(name)
		end

		ao.send({
			Target = ioProcess,
			Action = "Remove-Primary-Names",
			Names = msg.Tags.Names,
		})
	end)
end

return ant

end

_G.package.loaded[".common.main"] = _loaded_mod_common_main()

local ant = require(".common.main")

ant.init()
