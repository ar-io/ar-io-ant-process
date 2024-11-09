--- Module for managing balances and transactions.
-- @module balances
require(".common.types")
local utils = require(".common.utils")
local json = require(".common.json")

local balances = {}

--- Checks if a wallet has sufficient balance.
---@param wallet string - The wallet address to check.
---@return boolean - Returns true if the wallet has a balance greater than 0, otherwise false.
function balances.walletHasSufficientBalance(wallet)
	return Balances[wallet] ~= nil and Balances[wallet] > 0
end

--- Transfers the ANT to a specified wallet.
---@param to string - The wallet address to transfer the balance to.
---@return string - Returns the encoded JSON representation of the transferred balance.
function balances.transfer(to)
	utils.validateArweaveId(to)
	Balances = { [to] = 1 }
	--luacheck: ignore Owner Controllers
	Owner = to
	Controllers = {}
	return json.encode({ [to] = 1 })
end

--- Retrieves the balance of a specified wallet.
---@param address string - The wallet address to retrieve the balance from.
---@return number - Returns the balance of the specified wallet.
function balances.balance(address)
	utils.validateArweaveId(address)
	local balance = Balances[address] or 0
	return balance
end

--- Retrieves all balances.
---@return string - Returns the encoded JSON representation of all balances.
function balances.balances()
	return json.encode(Balances)
end

--- Sets the name of the ANT.
---@param name string - The name to set.
---@return string - Returns the encoded JSON representation of the updated name.
function balances.setName(name)
	assert(type(name) == "string", "Name must be a string")
	Name = name
	return json.encode({ name = Name })
end

--- Sets the ticker of the ANT.
---@param ticker string - The ticker to set.
---@return string - Returns the encoded JSON representation of the updated ticker.
function balances.setTicker(ticker)
	assert(type(ticker) == "string", "Ticker must be a string")
	Ticker = ticker
	return json.encode({ ticker = Ticker })
end

--- Sets the description of the ANT.
---@param description string - The description to set.
---@return string - Returns the encoded JSON representation of the updated description.
function balances.setDescription(description)
	assert(type(description) == "string", "Description must be a string")
	assert(#description <= 512, "Description must not be longer than 512 characters")
	Description = description
	return json.encode({ description = Description })
end

--- Sets the keywords of the ANT.
---@param keywords table - The keywords to set.
---@return string - Returns the encoded JSON representation of the updated keywords.
function balances.setKeywords(keywords)
	utils.validateKeywords(keywords)

	Keywords = keywords
	return json.encode({ keywords = Keywords })
end

--- Sets the logo of the ANT.
---@param logo string - The Arweave transaction ID that represents the logo.
---@return string - Returns the encoded JSON representation of the updated logo.
function balances.setLogo(logo)
	Logo = logo
	return json.encode({ logo = Logo })
end

return balances
