local records = require("src.common.records")
local constants = require("src.common.constants")

-- Valid 43-character test addresses (Base64URL format)
local validOwner = "BaMK_9bFWZMsRmk1L5h0UgO0p-xh_oUpqdCCPQhJlkI"
local validRecordOwner = "Th2GyXvBSav3fV6I_4RgjV-xXJZnN2LNYnzgIJQxgKg"
local validNewOwner = "aWn0lF5sc8JLrBIGxQvBcUoXqFQCTh5ATaW6N4GNGxw"
local validTxId = "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ"
local validLogoTxId = "KTzTXT_ANmF84bg8W0YfoD7bBmJyq0D2K5SvkJ6dJnU"
local validTxId2 = "xjMaPnMBPvfXqTCg4XLEkJ-5da8p1v7E9IwLHqGa-ck"
local validOwner2 = "1A9RgCNOL6NnmQQf0zWVlrX0XnWmvaZ4sNjVCn5BmMg"

describe("Record Ownership", function()
	before_each(function()
		-- Reset global state before each test
		_G.Records = {
			["@"] = {
				transactionId = "test-tx-id",
				ttlSeconds = 900,
				priority = 0,
			},
		}
		_G.Owner = validOwner
		_G.Controllers = {}
		_G.Balances = { [validOwner] = 1 }
	end)

	describe("setRecord with ownership", function()
		it("should allow setting a record with an owner", function()
			local result = records.setRecord(
				"test",
				validTxId,
				1800,
				1,
				validRecordOwner,
				"Test Record",
				validLogoTxId,
				"Test description",
				{ "keyword1", "keyword2" }
			)

			assert.are.equal(validTxId, result.transactionId)
			assert.are.equal(1800, result.ttlSeconds)
			assert.are.equal(1, result.priority)
			assert.are.equal(validRecordOwner, result.owner)
			assert.are.equal("Test Record", result.displayName)
			assert.are.equal(validLogoTxId, result.logo)
			assert.are.equal("Test description", result.description)
			assert.are.same({ "keyword1", "keyword2" }, result.keywords)
		end)

		it("should allow setting a record without optional fields", function()
			local result = records.setRecord("minimal", validTxId, 900)

			assert.are.equal(validTxId, result.transactionId)
			assert.are.equal(900, result.ttlSeconds)
			assert.is_nil(result.priority)
			assert.is_nil(result.owner)
			assert.is_nil(result.name)
			assert.is_nil(result.logo)
			assert.is_nil(result.description)
			assert.is_nil(result.keywords)
		end)

		it("should validate undername", function()
			assert.has_error(function()
				records.setRecord("invalid-name-too-long-" .. string.rep("a", 50), "tx-id", 900)
			end, constants.UNDERNAME_DOES_NOT_EXIST_MESSAGE)
		end)

		it("should validate transaction ID", function()
			assert.has_error(function()
				records.setRecord("test", "invalid-tx", 900)
			end, "Invalid Arweave ID")
		end)

		it("should validate TTL seconds", function()
			assert.has_error(function()
				records.setRecord("test", validTxId, 30)
			end, constants.INVALID_TTL_MESSAGE)
		end)
	end)

	describe("transferRecord", function()
		before_each(function()
			-- Create a record with an owner
			_G.Records["owned"] = {
				transactionId = validTxId,
				ttlSeconds = 900,
				owner = validRecordOwner,
			}
		end)

		it("should transfer ownership to new owner", function()
			local result = records.transferRecord("owned", validNewOwner)

			assert.are.equal("owned", result.subdomain)
			assert.are.equal(validRecordOwner, result.previousOwner)
			assert.are.equal(validNewOwner, result.recipient)
			assert.are.equal(validNewOwner, Records["owned"].owner)
		end)

		it("should fail if record does not exist", function()
			assert.has_error(function()
				records.transferRecord("nonexistent", validNewOwner)
			end, "Record does not exist")
		end)

		it("should fail if record has no owner", function()
			Records["owned"].owner = nil

			assert.has_error(function()
				records.transferRecord("owned", validNewOwner)
			end, "Record has no owner")
		end)

		it("should fail if new owner is invalid", function()
			assert.has_error(function()
				records.transferRecord("owned", "invalid")
			end, "Invalid new owner address")
		end)

		it("should fail if new owner is same as current", function()
			assert.has_error(function()
				records.transferRecord("owned", validRecordOwner)
			end, "New owner same as current owner")
		end)
	end)

	describe("getRecord with ownership", function()
		it("should return record with all metadata", function()
			Records["metadata"] = {
				transactionId = validTxId,
				ttlSeconds = 900,
				priority = 1,
				owner = validRecordOwner,
				name = "My Record",
				logo = validLogoTxId,
				description = "A test record",
				keywords = { "test", "record" },
			}

			local result = records.getRecord("metadata")

			assert.are.equal(validTxId, result.transactionId)
			assert.are.equal(validRecordOwner, result.owner)
			assert.are.equal("My Record", result.name)
			assert.are.equal(validLogoTxId, result.logo)
			assert.are.equal("A test record", result.description)
			assert.are.same({ "test", "record" }, result.keywords)
		end)
	end)

	describe("getRecords with ownership", function()
		it("should return all records including metadata", function()
			Records["one"] = {
				transactionId = validTxId,
				ttlSeconds = 900,
				owner = validOwner2,
				name = "Record One",
			}
			Records["two"] = {
				transactionId = validTxId2,
				ttlSeconds = 1800,
				-- No owner or metadata
			}

			local result = records.getRecords()

			assert.are.equal(validTxId, result["one"].transactionId)
			assert.are.equal(validOwner2, result["one"].owner)
			assert.are.equal("Record One", result["one"].name)

			assert.are.equal(validTxId2, result["two"].transactionId)
			assert.is_nil(result["two"].owner)
			assert.is_nil(result["two"].name)
		end)
	end)
end)
