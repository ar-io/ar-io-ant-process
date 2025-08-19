-- spec/utils_spec.lua
local utils = require(".common.utils")
local constants = require("src.common.constants")

local testEthAddress = "0xFCAd0B19bB29D4674531d6f115237E16AfCE377c"

describe("utils.camelCase", function()
	it("should convert snake_case to camelCase", function()
		assert.are.equal(utils.camelCase("start_end"), "startEnd")
		assert.are.equal(utils.camelCase("multiple_words_example"), "multipleWordsExample")
	end)

	it("should convert kebab-case to camelCase", function()
		assert.are.equal(utils.camelCase("start-end"), "startEnd")
		assert.are.equal(utils.camelCase("multiple-words-example"), "multipleWordsExample")
	end)

	it("should convert space-separated words to camelCase", function()
		assert.are.equal(utils.camelCase("start end"), "startEnd")
		assert.are.equal(utils.camelCase("multiple words example"), "multipleWordsExample")
	end)

	it("should convert PascalCase to camelCase", function()
		assert.are.equal(utils.camelCase("StartEnd"), "startEnd")
		assert.are.equal(utils.camelCase("MultipleWordsExample"), "multipleWordsExample")
	end)

	it("should handle mixed cases", function()
		assert.are.equal(utils.camelCase("Start_end-Test"), "startEndTest")
		assert.are.equal(utils.camelCase("Multiple_Words-example Test"), "multipleWordsExampleTest")
	end)

	it("should handle already camelCase strings", function()
		assert.are.equal(utils.camelCase("startEnd"), "startEnd")
		assert.are.equal(utils.camelCase("multipleWordsExample"), "multipleWordsExample")
	end)

	it("should handle single character strings", function()
		assert.are.equal(utils.camelCase("a"), "a")
		assert.are.equal(utils.camelCase("A"), "a")
	end)

	it("should handle empty strings", function()
		assert.are.equal(utils.camelCase(""), "")
	end)
end)

describe("isValidEthAddress", function()
	it("should validate eth address", function()
		assert.is_true(utils.isValidEthAddress(testEthAddress))
	end)

	it("should fail on non-hexadecimal character ", function()
		-- invalid non-hexadecimal G character
		assert.is_false(utils.isValidEthAddress("0xFCAd0B19bB29D4674531d6f115237E16AfCE377G"))
	end)

	it("should return false on an an invalid-length address", function()
		assert.is_false(utils.isValidEthAddress("0xFCAd0B19bB29D4674531d6f115237E16AfCE37"))
	end)

	it("should return false on passing in non-string value", function()
		assert.is_false(utils.isValidEthAddress(3))
	end)
end)

describe("utils.isValidArweaveAddress", function()
	it("should throw an error for invalid Arweave IDs", function()
		local invalid = utils.isValidArweaveAddress("invalid-arweave-id-123")
		assert.is_false(invalid)
	end)

	it("should not throw an error for a valid Arweave ID", function()
		local valid = utils.isValidArweaveAddress("0E7Ai_rEQ326_vLtgB81XHViFsLlcwQNqlT9ap24uQI")
		assert.is_true(valid)
	end)
end)

describe("utils.isValidAOAddress", function()
	it("should throw an error for invalid Arweave IDs", function()
		local invalid = utils.isValidAOAddress("invalid-arweave-id-123", false)
		assert.is_false(invalid)
	end)

	it("should not throw an error for a valid Arweave ID", function()
		local valid = pcall(utils.isValidAOAddress, "0E7Ai_rEQ326_vLtgB81XHViFsLlcwQNqlT9ap24uQI", false)
		assert.is_true(valid)
	end)

	it("should validate eth address", function()
		assert.is_true(utils.isValidAOAddress(testEthAddress, false))
	end)
end)

describe("utils.validateUndername", function()
	it("should allow valid undernames", function()
		local validNames = {
			"@",
			"a",
			"aA",
			"Z_",
			"z-",
			"1",
			"1-",
			string.rep("a", 61),
			string.rep("z", 60) .. "_",
			string.rep("0", 60) .. "-",
		}

		for _, name in ipairs(validNames) do
			local success, error = pcall(utils.validateUndername, name)
			assert.is_true(success, name .. " should be valid")
			assert.is_nil(error, name .. " got an error: " .. tostring(error))
		end
	end)

	it("should not allow invalid undernames", function()
		local invalidNames = {
			nil,

			"",
			"_",
			"-",
			"_a",
			"-a",
			string.rep("a", 62), -- overlength
			"-" .. string.rep("a", 60),
			"_" .. string.rep("a", 60),
			"@@",
			"a@",
			".",
			"#",
			"&",
			":",
			"a.",
			"a#",
			"a&",
			"a:",
		}

		for _, name in ipairs(invalidNames) do
			local invalid, error = pcall(utils.validateUndername, name)
			assert.is_false(invalid, name .. " should be invalid")
			assert.is_not_nil(error, "error for " .. name .. " was nil: " .. tostring(error))
			assert.equal(constants.UNDERNAME_DOES_NOT_EXIST_MESSAGE, tostring(error))
		end
	end)
end)

describe("utils.assertHasRecordPermission", function()
	before_each(function()
		-- Reset global state
		_G.Owner = "ant-owner"
		_G.Controllers = {"controller-1", "controller-2"}
		_G.Balances = { ["ant-owner"] = 1 }
		_G.Records = {
			["owned"] = {
				transactionId = "tx-id",
				ttlSeconds = 900,
				owner = "record-owner"
			},
			["unowned"] = {
				transactionId = "tx-id-2",
				ttlSeconds = 900
			}
		}
		_G.ao = {
			env = {
				Process = {
					Id = "process-id"
				}
			}
		}
	end)

	it("should allow ANT owner to modify any record", function()
		assert.has_no.error(function()
			utils.assertHasRecordPermission("ant-owner", "owned")
		end)

		assert.has_no.error(function()
			utils.assertHasRecordPermission("ant-owner", "unowned")
		end)
	end)

	it("should allow controllers to modify any record", function()
		assert.has_no.error(function()
			utils.assertHasRecordPermission("controller-1", "owned")
		end)

		assert.has_no.error(function()
			utils.assertHasRecordPermission("controller-2", "unowned")
		end)
	end)

	it("should allow process ID to modify any record", function()
		assert.has_no.error(function()
			utils.assertHasRecordPermission("process-id", "owned")
		end)
	end)

	it("should allow record owner to modify their own record", function()
		assert.has_no.error(function()
			utils.assertHasRecordPermission("record-owner", "owned")
		end)
	end)

	it("should deny record owner from modifying other records", function()
		assert.has_error(function()
			utils.assertHasRecordPermission("record-owner", "unowned")
		end, "Sender does not have permission for this record.")
	end)

	it("should deny random user from modifying any record", function()
		assert.has_error(function()
			utils.assertHasRecordPermission("random-user", "owned")
		end, "Sender does not have permission for this record.")

		assert.has_error(function()
			utils.assertHasRecordPermission("random-user", "unowned")
		end, "Sender does not have permission for this record.")
	end)

	it("should handle non-existent records", function()
		assert.has_error(function()
			utils.assertHasRecordPermission("random-user", "nonexistent")
		end, "Sender does not have permission for this record.")
	end)

	it("should handle records with nil owner", function()
		Records["owned"].owner = nil

		-- Only ANT-level permissions should work
		assert.has_no.error(function()
			utils.assertHasRecordPermission("ant-owner", "owned")
		end)

		assert.has_no.error(function()
			utils.assertHasRecordPermission("controller-1", "owned")
		end)

		-- Record owner should fail since owner is nil
		assert.has_error(function()
			utils.assertHasRecordPermission("record-owner", "owned")
		end, "Sender does not have permission for this record.")
	end)

	it("should check ANT permissions before record permissions", function()
		-- Even if someone is a record owner of one record,
		-- if they're a controller, they can modify all records
		_G.Controllers = {"record-owner"}

		assert.has_no.error(function()
			utils.assertHasRecordPermission("record-owner", "unowned")
		end)
	end)

	it("should allow owner via Balances check", function()
		-- Test the Balances check for ownership
		Balances["another-owner"] = 1

		assert.has_no.error(function()
			utils.assertHasRecordPermission("another-owner", "owned")
		end)
	end)
end)
