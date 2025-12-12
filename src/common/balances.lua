--- Module for managing balances and transactions.
-- @module balances

local utils = require(".common.utils")
local constants = require(".common.constants")

local balances = {}

---@alias AllowUnsafeAddresses boolean Whether to allow unsafe addresses

--- Transfers the ANT to a specified wallet.
---@param to string - The wallet address to transfer the balance to.
---@param removeControllers boolean - Whether to remove all controllers.
---@param allowUnsafeAddresses AllowUnsafeAddresses
---@return table<string, integer>
function balances.transfer(to, removeControllers, allowUnsafeAddresses)
	assert(utils.isValidAOAddress(to, allowUnsafeAddresses), "Invalid AO Address")
	Balances = { [to] = 1 }
	--luacheck: ignore Owner Controllers
	Owner = to
	if removeControllers == true then
		Controllers = {}
	end

	return { [to] = 1 }
end

--- Retrieves the balance of a specified wallet.
---@param address string - The wallet address to retrieve the balance from.
---@param allowUnsafeAddresses AllowUnsafeAddresses
---@return integer - Returns the balance of the specified wallet.
function balances.balance(address, allowUnsafeAddresses)
	assert(utils.isValidAOAddress(address, allowUnsafeAddresses), "Invalid AO Address")
	local balance = Balances[address] or 0
	return balance
end

--- Retrieves all balances.
---@return table<string, integer> - Returns the encoded JSON representation of all balances.
function balances.balances()
	return Balances
end

--- Sets the name of the ANT.
---@param name string - The name to set.
---@return table<string, string>
function balances.setName(name)
	assert(type(name) == "string", "Name must be a string")
	assert(
		#name <= constants.MAX_NAME_LENGTH,
		"Name must not be longer than " .. constants.MAX_NAME_LENGTH .. " characters"
	)
	Name = name
	return { Name = Name }
end

--- Sets the ticker of the ANT.
---@param ticker string - The ticker to set.
---@return table<string, string>
function balances.setTicker(ticker)
	assert(type(ticker) == "string", "Ticker must be a string")
	Ticker = ticker
	return { Ticker = Ticker }
end

--- Sets the description of the ANT.
---@param description string - The description to set.
---@return table<string, string>
function balances.setDescription(description)
	assert(type(description) == "string", "Description must be a string")
	assert(
		#description <= constants.MAX_DESCRIPTION_LENGTH,
		"Description must not be longer than " .. constants.MAX_DESCRIPTION_LENGTH .. " characters"
	)
	Description = description
	return { Description = Description }
end

--- Sets the keywords of the ANT.
---@param keywords table - The keywords to set.
---@return table<string, string>
function balances.setKeywords(keywords)
	utils.validateKeywords(keywords)

	Keywords = keywords
	return { Keywords = Keywords }
end

--- Sets the logo of the ANT.
---@param logo string - The Arweave transaction ID that represents the logo.
---@return table<string, string>
function balances.setLogo(logo)
	assert(utils.isValidArweaveAddress(logo), "Invalid arweave ID")
	Logo = logo
	return { Logo = Logo }
end

return balances
