local utils = require(".common.utils")

local records = {}
-- defaults to landing page txid
Records = Records
	or {
		["@"] = {
			transactionId = "-k7t8xMoB8hW482609Z9F4bTFMC3MnuW8bTvTyT8pFI",
			ttlSeconds = 84600,
		},
	}

--- Set a record in the Records of the ANT.
---@param name string The name of the record.
---@param transactionId string The transaction ID of the record.
---@param ttlSeconds number The time-to-live in seconds for the record.
---@return Record
function records.setRecord(name, transactionId, ttlSeconds)
	utils.validateUndername(name)
	assert(utils.isValidArweaveAddress(transactionId), "Invalid Arweave ID")
	utils.validateTTLSeconds(ttlSeconds)

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
