local utils = require(".common.utils")
local json = require(".common.json")
local records = {}
-- defaults to landing page txid
Records = Records or { ["@"] = { transactionId = "-k7t8xMoB8hW482609Z9F4bTFMC3MnuW8bTvTyT8pFI", ttlSeconds = 3600 } }

--- Set a record in the Records of the ANT.
---@param name string The name of the record.
---@param transactionId string The transaction ID of the record.
---@param ttlSeconds number The time-to-live in seconds for the record.
---@return string The encoded JSON representation of the record.
function records.setRecord(name, transactionId, ttlSeconds)
	utils.validateUndername(name)
	utils.validateArweaveId(transactionId)
	utils.validateTTLSeconds(ttlSeconds)

	local recordsCount = #Records

	if recordsCount >= 10000 then
		error("Max records limit of 10,000 reached, please delete some records to make space")
	end

	Records[name] = {
		transactionId = transactionId,
		ttlSeconds = ttlSeconds,
	}

	return json.encode({
		transactionId = transactionId,
		ttlSeconds = ttlSeconds,
	})
end

--- Remove a record from the ANT.
---@param name string The name of the record to remove.
---@return string The encoded JSON representation of the deletion message.
function records.removeRecord(name)
	utils.validateUndername(name)
	Records[name] = nil
	return json.encode({ message = "Record deleted" })
end

--- Get a record from the ANT.
---@param name string The name of the record to retrieve.
---@return string The encoded JSON representation of the record.
function records.getRecord(name)
	utils.validateUndername(name)
	assert(Records[name] ~= nil, "Record does not exist")

	return json.encode(Records[name])
end

--- Get all records from the ANT
---@return string The encoded JSON representation of all records.
function records.getRecords()
	local antRecords = utils.deepCopy(Records)
	assert(antRecords, "Failed to copy Records")
	local recordEntries = utils.entries(antRecords)
	-- sort the records alphabetically, ensuring "@" record is first
	table.sort(recordEntries, function(a, b)
		if a[1] == "@" then
			return true
		end
		if b[1] == "@" then
			return false
		end
		return a[1] < b[1]
	end)

	return json.encode(recordEntries)
end

return records
