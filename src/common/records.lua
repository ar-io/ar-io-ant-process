local utils = require(".common.utils")
local constants = require(".common.constants")

local records = {}
-- defaults to landing page txid
Records = Records
	or {
		["@"] = {
			transactionId = "-k7t8xMoB8hW482609Z9F4bTFMC3MnuW8bTvTyT8pFI",
			ttlSeconds = 900,
			priority = 0,
		},
	}

--- Set a record in the Records of the ANT.
---@param name string The name of the record to set
---@param transactionId string The transaction ID of the record
---@param ttlSeconds integer|nil The TTL seconds of the record
---@param priority integer|nil The priority of the record
---@param owner string|nil The owner of the record
---@param displayName string|nil The display name of the record
---@param logo string|nil The logo of the record
---@param description string|nil The description of the record
---@param keywords table<string>|nil The keywords of the record
---@param caller string The caller of the record
---@param allowUnsafeAddresses boolean|nil Whether to allow unsafe addresses
---@return Record
function records.setRecord(
	name,
	transactionId,
	ttlSeconds,
	priority,
	owner,
	displayName,
	logo,
	description,
	keywords,
	caller,
	allowUnsafeAddresses
)
	utils.validateUndername(name)

	-- Check permissions based on whether record exists
	local recordDoesExist = Records[name] ~= nil
	-- only ANT owner/controllers can set priority for existing records - this is to prevent  undername owners from setting priority
	if recordDoesExist and priority == nil then
		-- For existing records, check record-specific permission
		utils.assertHasRecordPermission(caller, name)
	else
		-- For new records, only ANT owner/controllers can create
		utils.assertHasPermission(caller)
	end

	local previousRecord = Records[name] or {}

	local newRecord = {
		transactionId = transactionId or previousRecord.transactionId or constants.DEFAULT_TRANSACTION_ID,
		ttlSeconds = tonumber(ttlSeconds) or previousRecord.ttlSeconds or constants.DEFAULT_TTL_SECONDS,
		priority = name == "@" and 0 or tonumber(priority), -- set below with validation
		owner = owner or previousRecord.owner,
		displayName = displayName or previousRecord.displayName,
		logo = logo or previousRecord.logo,
		description = description or previousRecord.description,
		keywords = keywords or previousRecord.keywords,
	}
	-- Accept keywords as a formatted Lua table; validate if provided

	utils.validateKeywords(newRecord.keywords or {})
	assert(utils.isValidArweaveAddress(newRecord.transactionId), "Invalid Arweave ID")
	utils.validateTTLSeconds(newRecord.ttlSeconds)
	assert(
		(
			newRecord.priority == nil
			or ((newRecord.priority == 0 or newRecord.priority > 0) and math.type(newRecord.priority) == "integer")
		),
		"Priority must be an integer greater than 0"
	)
	assert(
		newRecord.owner == nil or utils.isValidAOAddress(newRecord.owner, allowUnsafeAddresses),
		"Invalid owner address"
	)
	assert(newRecord.displayName == nil or #newRecord.displayName <= constants.MAX_NAME_LENGTH, "Invalid display name")
	assert(newRecord.logo == nil or utils.isValidArweaveAddress(newRecord.logo), "Invalid logo")
	assert(
		newRecord.description == nil or #newRecord.description <= constants.MAX_DESCRIPTION_LENGTH,
		"Invalid description"
	)

	Records[name] = newRecord

	return Records[name]
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

--- Transfer ownership of a record to a new owner
---@param name string The name of the record
---@param recipient string The new owner address
---@param allowUnsafeAddresses boolean|nil Whether to allow unsafe addresses
---@return table Transfer details
function records.transferRecord(name, recipient, allowUnsafeAddresses)
	utils.validateUndername(name)
	assert(Records[name] ~= nil, "Record does not exist")
	assert(Records[name].owner ~= nil, "Record has no owner")
	assert(utils.isValidAOAddress(recipient, allowUnsafeAddresses), "Invalid new owner address")
	assert(recipient ~= Records[name].owner, "New owner same as current owner")

	local previousOwner = Records[name].owner
	Records[name].owner = recipient

	return {
		subdomain = name,
		previousOwner = previousOwner,
		newOwner = recipient,
		recipient = recipient,
		record = Records[name],
	}
end

return records
