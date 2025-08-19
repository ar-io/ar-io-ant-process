local utils = require(".common.utils")

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
---@param name string The name of the record.
---@param transactionId string The transaction ID of the record.
---@param ttlSeconds number The time-to-live in seconds for the record.
---@param priority integer|nil The sort order of the record - must be nil or 1 or greater
---@param owner string|nil The owner of the record
---@param recordName string|nil The display name of the record
---@param logo string|nil The logo transaction ID
---@param description string|nil The description of the record
---@param keywords table<string>|nil The keywords for the record
---@return Record
function records.setRecord(name, transactionId, ttlSeconds, priority, owner, recordName, logo, description, keywords)
	utils.validateUndername(name)
	assert(utils.isValidArweaveAddress(transactionId), "Invalid Arweave ID")
	utils.validateTTLSeconds(ttlSeconds)
	if priority then
		if name == "@" then
			assert(priority == 0, "Priority for '@' must be 0, but received " .. tostring(priority))
		else
			assert(
				math.type(priority) == "integer" and priority > 0,
				"Priority must be an integer greater than 0, but received " .. tostring(priority)
			)
		end
	end

	collectgarbage("stop")
	Records[name] = {
		transactionId = transactionId,
		ttlSeconds = ttlSeconds,
		priority = name == "@" and 0 or priority,
		-- Add optional fields only if provided
		owner = owner,
		name = recordName,
		logo = logo,
		description = description,
		keywords = keywords,
	}
	collectgarbage("restart")

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
---@param newOwner string The new owner address
---@param allowUnsafeAddresses boolean|nil Whether to allow unsafe addresses
---@return table Transfer details
function records.transferRecordOwnership(name, newOwner, allowUnsafeAddresses)
	utils.validateUndername(name)
	assert(Records[name] ~= nil, "Record does not exist")
	assert(Records[name].owner ~= nil, "Record has no owner")
	assert(utils.isValidAOAddress(newOwner, allowUnsafeAddresses), "Invalid new owner address")
	assert(newOwner ~= Records[name].owner, "New owner same as current owner")

	local previousOwner = Records[name].owner
	Records[name].owner = newOwner

	return {
		subdomain = name,
		previousOwner = previousOwner,
		newOwner = newOwner
	}
end

--- Revoke ownership of a record (set owner to nil)
---@param name string The name of the record
---@return table Revocation details
function records.revokeRecordOwnership(name)
	utils.validateUndername(name)
	assert(Records[name] ~= nil, "Record does not exist")

	local previousOwner = Records[name].owner
	Records[name].owner = nil

	return {
		subdomain = name,
		previousOwner = previousOwner,
		revoked = true
	}
end

return records
