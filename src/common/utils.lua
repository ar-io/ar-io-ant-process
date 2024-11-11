-- the majority of this file came from https://github.com/permaweb/aos/blob/main/process/utils.lua
local constants = require(".common.constants")
local json = require(".common.json")
local utils = { _version = "0.0.1" }

local function isArray(table)
	if type(table) == "table" then
		local maxIndex = 0
		for k, _ in pairs(table) do
			if type(k) ~= "number" or k < 1 or math.floor(k) ~= k then
				return false -- If there's a non-integer key, it's not an array
			end
			maxIndex = math.max(maxIndex, k)
		end
		-- If the highest numeric index is equal to the number of elements, it's an array
		return maxIndex == #table
	end
	return false
end

--- @param fn function
--- @param arity number
utils.curry = function(fn, arity)
	assert(type(fn) == "function", "function is required as first argument")
	arity = arity or debug.getinfo(fn, "u").nparams
	if arity < 2 then
		return fn
	end

	return function(...)
		local args = { ... }

		if #args >= arity then
			return fn(table.unpack(args))
		else
			return utils.curry(function(...)
				return fn(table.unpack(args), ...)
			end, arity - #args)
		end
	end
end

--- Concat two Array Tables.
--- @param a table
--- @param b table
utils.concat = utils.curry(function(a, b)
	assert(type(a) == "table", "first argument should be a table that is an array")
	assert(type(b) == "table", "second argument should be a table that is an array")
	assert(isArray(a), "first argument should be a table")
	assert(isArray(b), "second argument should be a table")

	local result = {}
	for i = 1, #a do
		result[#result + 1] = a[i]
	end
	for i = 1, #b do
		result[#result + 1] = b[i]
	end
	return result
end, 2)

--- reduce applies a function to a table
--- @param fn function
--- @param initial any
--- @param t table
utils.reduce = utils.curry(function(fn, initial, t)
	assert(type(fn) == "function", "first argument should be a function that accepts (result, value, key)")
	assert(type(t) == "table" and isArray(t), "third argument should be a table that is an array")
	local result = initial
	for k, v in pairs(t) do
		if result == nil then
			result = v
		else
			result = fn(result, v, k)
		end
	end
	return result
end, 3)

--- @param fn function
--- @param data table
utils.map = utils.curry(function(fn, data)
	assert(type(fn) == "function", "first argument should be a unary function")
	assert(type(data) == "table" and isArray(data), "second argument should be an Array")

	local function map(result, v, k)
		result[k] = fn(v, k)
		return result
	end

	return utils.reduce(map, {}, data)
end, 2)

--- @param fn function
--- @param data table
utils.filter = utils.curry(function(fn, data)
	assert(type(fn) == "function", "first argument should be a unary function")
	assert(type(data) == "table" and isArray(data), "second argument should be an Array")

	local function filter(result, v)
		if fn(v) then
			table.insert(result, v)
		end
		return result
	end

	return utils.reduce(filter, {}, data)
end, 2)

--- @param fn function
--- @param t table
utils.find = utils.curry(function(fn, t)
	assert(type(fn) == "function", "first argument should be a unary function")
	assert(type(t) == "table", "second argument should be a table that is an array")
	for _, v in pairs(t) do
		if fn(v) then
			return v
		end
	end
end, 2)

--- @param propName string
--- @param value string
--- @param object table
utils.propEq = utils.curry(function(propName, value, object)
	assert(type(propName) == "string", "first argument should be a string")
	-- assert(type(value) == "string", "second argument should be a string")
	assert(type(object) == "table", "third argument should be a table<object>")

	return object[propName] == value
end, 3)

--- @param data table
utils.reverse = function(data)
	assert(type(data) == "table", "argument needs to be a table that is an array")
	return utils.reduce(function(result, v, i)
		result[#data - i + 1] = v
		return result
	end, {}, data)
end

--- @param ... function
utils.compose = utils.curry(function(...)
	local mutations = utils.reverse({ ... })

	return function(v)
		local result = v
		---@diagnostic disable-next-line
		for _, fn in pairs(mutations) do
			assert(type(fn) == "function", "each argument needs to be a function")
			result = fn(result)
		end
		return result
	end
end, 2)

--- @param propName string
--- @param object table
utils.prop = utils.curry(function(propName, object)
	return object[propName]
end, 2)

--- @param val any
--- @param t table
utils.includes = utils.curry(function(val, t)
	assert(type(t) == "table", "argument needs to be a table")
	return utils.find(function(v)
		return v == val
	end, t) ~= nil
end, 2)

--- @param t table
utils.keys = function(t)
	assert(type(t) == "table", "argument needs to be a table")
	local keys = {}
	for key in pairs(t) do
		table.insert(keys, key)
	end
	return keys
end

--- @param t table
utils.values = function(t)
	assert(type(t) == "table", "argument needs to be a table")
	local values = {}
	for _, value in pairs(t) do
		table.insert(values, value)
	end
	return values
end

function utils.hasMatchingTag(tag, value)
	return Handlers.utils.hasMatchingTag(tag, value)
end

---@param msg AoMessage
function utils.reply(msg)
	---@diagnostic disable-next-line
	Handlers.utils.reply(msg)
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

---@param id string
---@description Asserts that the provided id is a valid arweave id
---@example
---```lua
---utils.validateArweaveId("QWERTYUIOPASDFGHJKLZXCVBNM1234567890_-")
---```
function utils.validateArweaveId(id)
	-- the provided id matches the regex, and is not nil
	local validLength = #id == 43
	local validChars = string.match(id, "^[a-zA-Z0-9_-]+$") ~= nil
	local valid = validLength and validChars
	assert(valid, constants.INVALID_ARWEAVE_ID_MESSAGE)
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
		["Source-Code-TX-ID"] = SourceCodeTxId,
	}
end

utils.notices = {}

--- @param oldMsg AoMessage
--- @param newMsg AoMessage
--- @description Add forwarded tags to the new message
--- @return AoMessage
function utils.notices.addForwardedTags(oldMsg, newMsg)
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
function utils.notices.credit(msg)
	return utils.notices.addForwardedTags(msg, {
		Target = msg.Recipient,
		Action = "Credit-Notice",
		Sender = msg.From,
		Quantity = tostring(1),
	})
end

--- @param msg AoMessage
--- @description Create a debit notice message
--- @return AoMessage
function utils.notices.debit(msg)
	return utils.notices.addForwardedTags(msg, {
		Target = msg.From,
		Action = "Debit-Notice",
		Recipient = msg.Recipient,
		Quantity = tostring(1),
	})
end

--- @param notices table<AoMessage>
function utils.notices.sendNotices(notices)
	for _, notice in ipairs(notices) do
		ao.send(notice)
	end
end

--- @param msg AoMessage
--- @param target string
--- @description Notify the target of the current state
--- @return nil
function utils.notices.notifyState(msg, target)
	if not target then
		print("No target specified for state notice")
		return
	end

	ao.send(utils.notices.addForwardedTags(msg, {
		Target = target,
		Action = "State-Notice",
		Data = json.encode(utils.getState()),
	}))
end

--- @param handlers Handlers
--- @description Get the names of all handlers
--- @return table<string>
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
			-- sometimes the message id is not present on dryrun
			print("Handling Action [" .. msg.Id or "no-msg-id" .. "]: " .. tagValue)
			local prevOwner = tostring(Owner)
			local prevControllers = utils.deepCopy(Controllers)
			assert(prevControllers, "Unable to deep copy controllers")

			local handlerStatus, handlerRes = xpcall(function()
				return handler(msg)
			end, utils.errorHandler)

			if not handlerStatus then
				ao.send(utils.notices.addForwardedTags(msg, {
					Target = msg.From,
					Action = "Invalid-" .. tagValue .. "-Notice",
					Error = tagValue .. "-Error",
					["Message-Id"] = msg.Id,
					Data = handlerRes,
				}))
			elseif handlerRes then
				ao.send(utils.notices.addForwardedTags(msg, {
					Target = msg.From,
					Action = tagValue .. "-Notice",
					Data = type(handlerRes) == "string" and handlerRes or json.encode(handlerRes),
				}))
			end

			local hasNewOwner = Owner ~= prevOwner
			local hasDifferentControllers = #utils.keys(Controllers) ~= #utils.keys(prevControllers)
			if (hasNewOwner or hasDifferentControllers) and tagValue ~= "State" then
				utils.notices.notifyState(msg, msg.From)
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

---@param keywords table<string>
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
