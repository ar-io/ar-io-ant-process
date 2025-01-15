-- spec/utils_spec.lua
local utils = require(".common.utils")

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
	it("should validate undernames of all lengths from 1 to 61", function()
		for length = 1, 61 do
			local name = string.rep("a", length) -- Generate a name of the current length
			local valid, error = pcall(utils.validateUndername, name)
			assert.is_true(valid, "Expected name of length " .. length .. " to be valid")
			assert.is_nil(error, "Unexpected error for name of length " .. length)
		end
	end)

	it("should throw an error for names longer than 61 characters", function()
		local name = string.rep("a", 62) -- Generate a name of length 62
		local valid, error = pcall(utils.validateUndername, name)
		assert.is_false(valid, "Expected name of length 62 to be invalid")
		assert.is_not_nil(error, "Expected an error for name of length 62")
	end)

	it("should throw an error for invalid undernames", function()
		local invalid, error = pcall(utils.validateUndername, "_invalid_undername_")
		assert.is_false(invalid)
		assert.is_not_nil(error)
	end)

	it("should allow '@' as a valid undername", function()
		local valid, error = pcall(utils.validateUndername, "@")
		assert.is_true(valid)
		assert.is_nil(error)
	end)
end)
