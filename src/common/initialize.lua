local utils = require(".common.utils")
local json = require(".common.json")
local constants = require(".common.constants")
local initialize = {}

---@alias InitialANTState {
--- name: string,
--- ticker: string,
--- description: string,
--- keywords: table<string>,
--- logo: string,
--- balances: table<string, integer>,
--- owner: string,
--- controllers: string[],
--- records: table<string, Record>,
--- logo: string,
---}

--- Initializes the ANT state from a JSON string
---@param state InitialANTState
---@return string JSON representation of the initialized ANT State
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
	local logo = encoded.logo or constants.DEFAULT_ANT_LOGO

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
	assert(type(logo) == "string", "logo must be a string")

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
	Logo = logo

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
		logo = Logo,
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
