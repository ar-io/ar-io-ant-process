-- the majority of this file came from https://github.com/permaweb/aos/blob/main/process/utils.lua

local constants = require(".common.constants")
local json = require(".common.json")
local utils = { _version = "0.0.1" }
local crypto = require(".crypto")
local Stream = crypto.utils.stream

local function isArray(table)
	if type(table) == "table" then
		local maxIndex = 0
		for k, v in pairs(table) do
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

-- @param {function} fn
-- @param {number} arity
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
-- @param {table<Array>} a
-- @param {table<Array>} b
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
-- @param {function} fn
-- @param {any} initial
-- @param {table<Array>} t
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

-- @param {function} fn
-- @param {table<Array>} data
utils.map = utils.curry(function(fn, data)
	assert(type(fn) == "function", "first argument should be a unary function")
	assert(type(data) == "table" and isArray(data), "second argument should be an Array")

	local function map(result, v, k)
		result[k] = fn(v, k)
		return result
	end

	return utils.reduce(map, {}, data)
end, 2)

-- @param {function} fn
-- @param {table<Array>} data
utils.filter = utils.curry(function(fn, data)
	assert(type(fn) == "function", "first argument should be a unary function")
	assert(type(data) == "table" and isArray(data), "second argument should be an Array")

	local function filter(result, v, _k)
		if fn(v) then
			table.insert(result, v)
		end
		return result
	end

	return utils.reduce(filter, {}, data)
end, 2)

-- @param {function} fn
-- @param {table<Array>} t
utils.find = utils.curry(function(fn, t)
	assert(type(fn) == "function", "first argument should be a unary function")
	assert(type(t) == "table", "second argument should be a table that is an array")
	for _, v in pairs(t) do
		if fn(v) then
			return v
		end
	end
end, 2)

-- @param {string} propName
-- @param {string} value
-- @param {table} object
utils.propEq = utils.curry(function(propName, value, object)
	assert(type(propName) == "string", "first argument should be a string")
	-- assert(type(value) == "string", "second argument should be a string")
	assert(type(object) == "table", "third argument should be a table<object>")

	return object[propName] == value
end, 3)

-- @param {table<Array>} data
utils.reverse = function(data)
	assert(type(data) == "table", "argument needs to be a table that is an array")
	return utils.reduce(function(result, v, i)
		result[#data - i + 1] = v
		return result
	end, {}, data)
end

-- @param {function} ...
utils.compose = utils.curry(function(...)
	local mutations = utils.reverse({ ... })

	return function(v)
		local result = v
		for _, fn in pairs(mutations) do
			assert(type(fn) == "function", "each argument needs to be a function")
			result = fn(result)
		end
		return result
	end
end, 2)

-- @param {string} propName
-- @param {table} object
utils.prop = utils.curry(function(propName, object)
	return object[propName]
end, 2)

-- @param {any} val
-- @param {table<Array>} t
utils.includes = utils.curry(function(val, t)
	assert(type(t) == "table", "argument needs to be a table")
	return utils.find(function(v)
		return v == val
	end, t) ~= nil
end, 2)

-- @param {table} t
utils.keys = function(t)
	assert(type(t) == "table", "argument needs to be a table")
	local keys = {}
	for key in pairs(t) do
		table.insert(keys, key)
	end
	return keys
end

-- @param {table} t
utils.values = function(t)
	assert(type(t) == "table", "argument needs to be a table")
	local values = {}
	for _, value in pairs(t) do
		table.insert(values, value)
	end
	return values
end

function utils.validateUndername(name, allowedNamesRegex)
	local valid = string.match(name, constants.UNDERNAME_REGEXP) == nil
	assert(valid ~= false, constants.UNDERNAME_DOES_NOT_EXIST_MESSAGE)
	if allowedNamesRegex then
		valid = string.match(name, allowedNamesRegex) == nil
		assert(valid ~= false, "ANT does not allow this undername to be purchased currently.")
	end
end

function utils.validateArweaveId(id)
	local valid = string.match(id, constants.ARWEAVE_ID_REGEXP) == nil

	assert(valid == true, constants.INVALID_ARWEAVE_ID_MESSAGE)
end

function utils.validateTTLSeconds(ttl)
	local valid = type(ttl) == "number" and ttl >= constants.MIN_TTL_SECONDS and ttl <= constants.MAX_TTL_SECONDS
	return assert(valid ~= false, constants.INVALID_TTL_MESSAGE)
end

function utils.validateOwner(caller)
	local isOwner = false
	if Owner == caller or Balances[caller] or ao.id == caller then
		isOwner = true
	end
	assert(isOwner, "Sender is not the owner.")
end

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
	if ao.id == from then
		return
	end
	error("Only controllers and owners can set controllers, records, and change metadata.")
end

function utils.assertRecordPermission(from, subDomain)
	local record = Records[subDomain]
	if record ~= nil and from ~= nil then
		if record.processId ~= nil then
			assert(record.processId == from, "Undername is leased and cannot be set manually")
		end

		assert(not Auctions[subDomain], "Undername is in auction and cannot be set manually")
	end
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

function utils.getState()
	return {
		Records = Records,
		Controllers = Controllers,
		Balances = Balances,
		Owner = Owner,
		Name = Name,
		Ticker = Ticker,
		Logo = Logo,
		Denomination = Denomination,
		TotalSupply = TotalSupply,
		Initialized = Initialized,
		["Source-Code-TX-ID"] = SourceCodeTxId,
	}
end

utils.notices = {}

-- @param oldMsg table
-- @param newMsg table
-- Add forwarded tags to the new message
-- @return newMsg table
function utils.notices.addForwardedTags(oldMsg, newMsg)
	for tagName, tagValue in pairs(oldMsg) do
		-- Tags beginning with "X-" are forwarded
		if string.sub(tagName, 1, 2) == "X-" then
			newMsg[tagName] = tagValue
		end
	end
	return newMsg
end

function utils.notices.credit(msg)
	return utils.notices.addForwardedTags(msg, {
		Target = msg.From,
		Action = "Credit-Notice",
		Recipient = msg.Recipient,
		Quantity = tostring(1),
	})
end

function utils.notices.debit(msg)
	return utils.notices.addForwardedTags(msg, {
		Target = msg.From,
		Action = "Debit-Notice",
		Recipient = msg.Recipient,
		Quantity = tostring(1),
	})
end

-- @param notices table
function utils.notices.sendNotices(notices)
	for _, notice in ipairs(notices) do
		ao.send(notice)
	end
end

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

function utils.getHandlerNames(handlers)
	local names = {}
	for _, handler in ipairs(handlers.list) do
		table.insert(names, handler.name)
	end
	return names
end

function utils.errorHandler(err)
	return debug.traceback(err)
end

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
			print("Handling Action [" .. msg.Id .. "]: " .. tagValue)
			local handlerStatus, handlerRes = xpcall(function()
				handler(msg)
			end, utils.errorHandler)

			if not handlerStatus then
				ao.send({
					Target = msg.From,
					Action = "Invalid-" .. tagValue .. "-Notice",
					Error = tagValue .. "-Error",
					["Message-Id"] = msg.Id,
					Data = handlerRes,
				})
			end

			return handlerRes
		end
	)
end

function utils.createActionHandler(action, msgHandler, position)
	return utils.createHandler("Action", action, msgHandler, position)
end

function utils.createForwardedActionHandler(action, msgHandler, position)
	return utils.createHandler("X-Action", action, msgHandler, position)
end

function utils.mergeSettings(defaults, tokenSettings)
	local newSettings = defaults
	for settingName, tokenSetting in pairs(tokenSettings) do
		newSettings[settingName] = tokenSetting
	end
	return newSettings
end

function utils.getCollectorIds(collectorsType)
	if collectorsType == constants.profitSharing.collectorPresets.owner then
		return { Owner }
	elseif collectorsType == constants.profitSharing.collectorPresets.controllers then
		return Controllers
	elseif collectorsType == constants.profitSharing.collectorPresets.balanceHolders then
		return utils.keys(Balances)
	elseif collectorsType == constants.profitSharing.collectorPresets.undernameHolders then
		local processIds = {}
		for _, record in pairs(Records) do
			if record.processId then
				processIds[record.processId] = true
			end
			return utils.keys(processIds)
		end
	elseif collectorsType == constants.profitSharing.collectorPresets.all then
		local processIds = { [Owner] = true }
		for _, record in pairs(Records) do
			if record.processId then
				processIds[record.processId] = true
			end
		end
		for _, controller in pairs(Controllers) do
			processIds[controller] = true
		end
		for holder in pairs(Balances) do
			processIds[holder] = true
		end
		return utils.keys(processIds)
	end
end

function utils.taxPurchase(msg, qty, rate, taxCollector)
	assert(type(msg) == "table", "Message must be a table")
	assert(type(qty) == "number", "Quantity must be a number")
	assert(type(rate) == "number", "Rate must be a number")
	assert(type(taxCollector) == "string", "Tax collector must be a string")
	local tax = qty * rate
	ao.send(utils.notices.addForwardedTags(msg, {
		Target = taxCollector,
		Action = "Transfer",
		Recipient = taxCollector,
		Quantity = tax,
	}))
end

function utils.distributeShares(msg, qty, rate, collectorsType)
	assert(type(msg) == "table", "Message must be a table")
	assert(type(qty) == "number", "Quantity must be a number")
	assert(type(rate) == "number", "Rate must be a number")
	assert(constants.profitSharing.collectorPresets[collectorsType], "Invalid collector preset")
	local collectors = utils.getCollectorIds(collectorsType)
	local collectorsShare = qty * rate
	local share = collectorsShare / #collectors
	for _, collector in ipairs(collectors) do
		ao.send(utils.notices.addForwardedTags(msg, {
			Target = collector,
			Action = "Transfer",
			Recipient = collector,
			Quantity = share * rate,
		}))
	end
end

function utils.refundTokens(msg, qty)
	local sender = msg.Sender
	if not sender then
		print("No sender specified for transfer, unable to refund sender.")
	else
		ao.send(utils.notices.addForwardedTags(msg, {
			Target = msg.From,
			Action = "Transfer",
			Recipient = sender,
			Quantity = qty or msg.Quantity,
			Error = qty and "You over paid! refunding the extra tokens" or "Invalid token for purchasing undernames",
		}))
	end
end

function utils.getPurchasePrice(p)
	assert(type(p) == "table", "Params must be a table")
	local tokenId = p.tokenId
	local undername = p.undername
	local purchaseType = p.purchaseType
	local leaseDuration = p.leaseDuration
	local auctionType = p.auctionType
	local settings = p.settings

	assert(
		auctionType == nil
			or auctionType == constants.auctionTypes.dutch
			or auctionType == constants.auctionTypes.english,
		"Invalid auction type"
	)

	local token = PriceSettings.whiteListedTokens[tokenId]
	local tokenRate = token.tokenRate
	local basePrice = (undername == "@" and settings.apexRecord.price or settings.undername.price) * tokenRate
	if undername ~= "@" then
		basePrice = basePrice * settings.undername.lengthFactor ^ #undername
	end
	local price = 0

	if purchaseType == constants.purchaseTypes.lease then
		assert(type(leaseDuration) == "number", "Lease duration is required for lease purchases")
		assert(leaseDuration >= settings.leaseSettings.minLeaseTime, "Lease duration is too short")
		assert(leaseDuration <= settings.leaseSettings.maxLeaseTime, "Lease duration is too long")
		local increments = leaseDuration / settings.leaseSettings.leaseIncrement
		assert(increments == math.floor(increments), "Invalid lease duration of: " .. tostring(increments))
		price = basePrice * settings.leaseSettings.incrementRate * increments
	end

	if purchaseType == constants.purchaseTypes.buy then
		price = basePrice * settings.buySettings.rate
	end

	if purchaseType == constants.purchaseTypes.auctionBuy then
		local auctionSettings = settings.auctionSettings[auctionType]
		price = basePrice * settings.buySettings.rate * auctionSettings.floorRate
	end

	if purchaseType == constants.purchaseTypes.auctionLease then
		local increments = leaseDuration / settings.leaseSettings.leaseIncrement
		assert(increments == math.floor(increments), "Invalid lease duration of: " .. tostring(increments))
		local auctionSettings = settings.auctionSettings[auctionType]
		price = basePrice * settings.leaseSettings.incrementRate * increments * auctionSettings.floorRate
	end

	return price
end

function utils.createAuction(p)
	assert(type(p) == "table", "Params must be a table")
	local undername = p.undername
	local underAntId = p.underAntId
	local purchaseType = p.purchaseType
	local auctionType = p.auctionType
	local startTimestamp = p.startTimestamp
	local leaseDuration = p.leaseDuration
	local settings = p.settings
	local tokenSettings = p.tokenSettings
	local auctionSettings = settings.auctionSettings[auctionType]

	local basePrice = (undername == "@" and settings.apexRecord.price or settings.undername.price)
		* tokenSettings.tokenRate
	if undername ~= "@" then
		basePrice = basePrice * settings.undername.lengthFactor ^ #undername
	end
	local auction = {
		underAntId = underAntId,
		auctionType = auctionType,
		startTimestamp = startTimestamp,
		endTimestamp = startTimestamp + auctionSettings.duration,
		floorPrice = basePrice * settings.buySettings.rate * auctionSettings.floorRate,
		ceilingPrice = basePrice * settings.buySettings.rate * auctionSettings.ceilingRate,
		ceilingTime = auctionSettings.ceilingTime,
		bids = auctionType == constants.auctionTypes.english and {} or nil,
	}

	if purchaseType == constants.purchaseTypes.auctionLease then
		local increments = leaseDuration / settings.leaseSettings.leaseIncrement
		assert(increments == math.floor(increments), "Invalid lease duration of: " .. tostring(increments))
		auction.floorPrice = basePrice * settings.leaseSettings.incrementRate * increments * auctionSettings.floorRate
		auction.ceilingPrice = basePrice
			* settings.leaseSettings.incrementRate
			* increments
			* auctionSettings.ceilingRate
	end

	return auction
end

function utils.parseBuyRecord(msg)
	assert(
		msg.Tags["Action"] == "Credit-Notice",
		"Not a 'Credit-Notice' action and thus invalid Buy-Record. Buy-Records should be initiated via Credit-Notice to pay for the undername."
	)
	assert(PriceSettings.whiteListedTokens[msg.From], "Invalid token for purchasing undernames")
	local settings = utils.mergeSettings(PriceSettings.defaults, PriceSettings.whiteListedTokens[msg.From].overrides)
	utils.validateUndername(msg.Tags["Undername"], settings.undername.allowedNamesRegex)
	assert(
		not Records[msg.Tags["Undername"]] and not Auctions[msg.Tags["Undername"]],
		"Undername already exists or is currently being auctioned"
	)
	assert(type(msg.Tags["Under-ANT-ID"]) == "string", "Under-ANT-ID tag is required")
	assert(constants.purchaseTypes[msg.Tags["Purchase-Type"]], "Invalid purchase type")
	if msg.Tags["Purchase-Type"] == constants.purchaseTypes.lease then
		assert(type(msg.Tags["Lease-Duration"]) == "number", "Lease duration is required for lease purchases")
		assert(msg.Tags["Lease-Duration"] >= settings.leaseSettings.minLeaseTime, "Lease duration is too short")
		assert(msg.Tags["Lease-Duration"] <= settings.leaseSettings.maxLeaseTime, "Lease duration is too long")
	end
	assert(msg.Tags["Auction-Type"] == nil or constants.auctionTypes[msg.Tags["Auction-Type"]], "Invalid auction type")
	local quantity = tonumber(msg.Quantity)
	assert(quantity, "Quantity is required")
	local recordSettings = msg.Tags["Undername"] and settings.apexRecord or settings.undername
	assert(recordSettings.purchaseTypes[msg.Tags["Purchase-Type"]], "Invalid purchase type for undername")

	local price = utils.getPurchasePrice({
		tokenId = msg.From,
		undername = msg.Tags["Undername"],
		purchaseType = msg.Tags["Purchase-Type"],
		leaseDuration = msg.Tags["Lease-Duration"],
		auctionType = msg.Tags["Auction-Type"],
		settings = settings,
	})

	assert(quantity >= price, "Insufficient funds to purchase undername")

	if price < quantity then -- refund the difference and continue
		utils.refundTokens(msg, tostring(quantity - price))
	end

	return {
		settings = settings,
		undername = msg.Tags["Undername"],
		underAntId = msg.Tags["Under-ANT-ID"],
		leaseDuration = msg.Tags["Lease-Duration"],
		purchaseType = msg.Tags["Purchase-Type"],
		auctionType = msg.Tags["Auction-Type"],
		quantity = quantity,
		price = price,
	}
end
-- returns hex string hash of the property value
function utils.hashGlobalProperty(property)
	local stream = Stream.fromString(json.encode(_G[property]))
	local hash = crypto.digest.sha2_256(stream)
	return tostring(hash.asHex())
end

function utils.generateGlobalStateHashes()
	local hashes = {}
	for _, property in ipairs(utils.keys(_G)) do
		local hashStat, hashRes = pcall(utils.hashGlobalProperty, property)
		if hashStat then
			hashes[property] = hashRes
		else
			print("Error hashing property '" .. property .. "' :" .. " " .. hashRes)
		end
	end
	return hashes
end

return utils
