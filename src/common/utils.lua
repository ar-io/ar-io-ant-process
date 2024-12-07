-- the majority of this file came from https://github.com/permaweb/aos/blob/main/process/utils.lua
local crypto = require(".modules.crypto.init")
local constants = require(".constants")
local json = require(".modules.json")
local notices = require(".notices")
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
