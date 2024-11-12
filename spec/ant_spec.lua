local balances = require("src.common.balances")
local controllers = require("src.common.controllers")
local initialize = require("src.common.initialize")
local records = require("src.common.records")
local json = require("src.common.json")

local fake_address = "1111111111111111111111111111111111111111111"

local originalState = {
	name = "Arweave Name Token",
	ticker = "ANT",
	description = "ANT's description",
	keywords = { "KEYWORD-1", "KEYWORD-2", "KEYWORD-3" },
	controllers = { fake_address },
	records = { ["@"] = { transactionId = fake_address, ttlSeconds = 900 } },
	balances = { [fake_address] = 1 },
	owner = fake_address,
}

describe("Arweave Name Token", function()
	before_each(function()
		_G.Balances = { [fake_address] = 1 }
		_G.Records = {}
		_G.Controllers = { fake_address }
		_G.Name = "Arweave Name Token"
		_G.Ticker = "ANT"
		_G.Description = "ANT's description"
		_G.Keywords = { "KEYWORD-1", "KEYWORD-2", "KEYWORD-3" }
		_G.Denomination = 1
	end)

	it("Initializes the state of the process", function()
		initialize.initializeANTState(json.encode(originalState)) -- happy

		assert.are.same(_G.Balances, originalState.balances)
		assert.are.same(_G.Records, originalState.records)
		assert.are.same(_G.Controllers, originalState.controllers)
		assert.are.same(_G.Name, originalState.name)
		assert.are.same(_G.Ticker, originalState.ticker)
		assert.are.same(_G.Description, originalState.description)
		assert.are.same(_G.Keywords, originalState.keywords)
	end)

	it("Transfers tokens between accounts", function()
		local to = "1111111111111111111111111111111111111111112"
		balances.transfer(to) -- happy path

		assert.are.same(_G.Balances[fake_address], nil)
		assert.are.same(_G.Balances[to], 1)
	end)

	it("sets a controller", function()
		local newController = "1111111111111111111111111111111111111111112"
		controllers.setController(newController) -- happy path

		local hasController = nil
		for _, controller in ipairs(_G.Controllers) do
			if controller == newController then
				hasController = true
			end
		end
		assert.is_true(hasController)
	end)

	it("removes a controller", function()
		local controllerToRemove = fake_address
		controllers.removeController(fake_address) -- happy path

		local hasController = false
		for _, controller in ipairs(_G.Controllers) do
			if controller == controllerToRemove then
				hasController = true
			end
		end
		assert.is_false(hasController)
	end)

	it("sets a record", function()
		local name, transactionId, ttlSeconds = "@", fake_address, 900
		records.setRecord(name, transactionId, ttlSeconds) -- happy path
		assert.are.same(_G.Records["@"].transactionId, fake_address)
		assert.are.same(_G.Records["@"].ttlSeconds, 900)
	end)

	it("gets all records", function()
		records.setRecord("zed", string.rep("1", 43), 3600)
		records.setRecord("@", string.rep("1", 43), 3600)
		local recordEntries = records.getRecords()

		assert.are.same(recordEntries[1].name, "@")
		assert.are.same(recordEntries[#recordEntries].name, "zed")
	end)

	it("removes a record", function()
		local name = "@"
		records.removeRecord(name) -- happy path

		assert.are.same(_G.Records[name], nil)
	end)

	it("sets the name", function()
		local newName = "New Name"
		balances.setName(newName) -- happy path

		assert.are.same(_G.Name, newName)
	end)

	it("sets the ticker", function()
		local newTicker = "NEW"
		balances.setTicker(newTicker) -- happy path

		assert.are.same(_G.Ticker, newTicker)
	end)

	it("sets the description", function()
		local newDescription = "NEW DESCRIPTION"
		balances.setDescription(newDescription) -- happy path

		assert.are.same(_G.Description, newDescription)
	end)

	it("sets the keywords", function()
		local newKeywords = { "NEW-KEYWORD-1", "NEW-KEYWORD-2", "NEW-KEYWORD-3" }
		balances.setKeywords(newKeywords) -- setKeywords now handles JSON string

		assert.are.same(_G.Keywords, newKeywords)
	end)

	-- Test when too many keywords are provided
	it("throws an error if keywords exceed 16 elements", function()
		local tooManyKeywords = {}
		for i = 1, 17 do -- 17 keywords, exceeds limit
			table.insert(tooManyKeywords, "keyword" .. i)
		end
		assert.has_error(function()
			balances.setKeywords(tooManyKeywords)
		end, "There must not be more than 16 keywords")
	end)

	-- Test when any keyword is too long
	it("throws an error if any keyword is too long", function()
		local keywordsWithLongEntry = { "valid", string.rep("a", 33) } -- Second keyword is 33 characters long
		assert.has_error(function()
			balances.setKeywords(keywordsWithLongEntry)
		end, "Each keyword must not be longer than 32 characters")
	end)

	-- Test when any keyword contains spaces
	it("throws an error if any keyword contains spaces", function()
		local keywordsWithSpace = { "valid", "invalid keyword" } -- Contains a space
		assert.has_error(function()
			balances.setKeywords(keywordsWithSpace)
		end, "Keywords must not contain spaces")
	end)

	-- Test when keywords contain invalid characters
	it("throws an error if keywords contain invalid characters", function()
		local keywordsWithSpecialChars = { "valid", "inva!lid" } -- Contains special character '!'
		assert.has_error(function()
			balances.setKeywords(keywordsWithSpecialChars)
		end, "Keywords must only contain alphanumeric characters, dashes, underscores, #, or @")
	end)

	-- Test when any keyword is duplicated
	it("throws an error if any keyword is duplicated", function()
		local keywordsWithDuplicates = { "keyword", "keyword" } -- Duplicate keyword
		assert.has_error(function()
			balances.setKeywords(keywordsWithDuplicates)
		end, "Duplicate keyword detected: keyword")
	end)

	-- Test when the keywords array is not actually an array
	it("throws an error if the keywords array is not actually an array", function()
		local notAnArray = "not-an-array"
		assert.has_error(function()
			balances.setKeywords(notAnArray)
		end, "Keywords must be an array")
	end)
end)
