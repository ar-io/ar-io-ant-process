local utils = require(".common.utils")
local json = require(".common.json")

local balances = {}

function balances.walletHasSufficientBalance(wallet)
	return Balances[wallet] ~= nil and Balances[wallet] > 0
end

function balances.transfer(to)
	utils.validateArweaveId(to)
	Balances = { [to] = 1 }
	Owner = to
	Controllers = {}
	return json.encode({ [to] = 1 })
end

function balances.balance(address)
	utils.validateArweaveId(address)
	local balance = Balances[address] or 0
	return balance
end

function balances.balances()
	return json.encode(Balances)
end

function balances.setName(name)
	assert(type(name) == "string", "Name must be a string")
	Name = name
	return json.encode({ name = Name })
end

function balances.setTicker(ticker)
	assert(type(ticker) == "string", "Ticker must be a string")
	Ticker = ticker
	return json.encode({ ticker = Ticker })
end

return balances
