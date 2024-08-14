local utils = require(".common.utils")
local createActionHandler = utils.createActionHandler
local balances = require(".common.balances")
local json = require(".common.json")
local token = {}

token.ActionMap = {
	Info = "Info",
	Balances = "Balances",
	Balance = "Balance",
	Transfer = "Transfer",
	TotalSupply = "Total-Supply",
	-- not implemented
	CreditNotice = "Credit-Notice",
	DebitNotice = "Debit-Notice",
	Mint = "Mint",
	Burn = "Burn",
}
function token.init()
	Owner = Owner or ao.env.Process.Owner
	Balances = Balances or { [Owner] = 1 }
	Denomination = Denomination or 0
	TotalSupply = TotalSupply or 1
	Logo = Logo or "Sie_26dvgyok0PZD_-iQAFOhOd5YxDTkczOLoqTTL_A"

	createActionHandler(token.ActionMap.Info, function(msg)
		local info = {
			Name = Name,
			Ticker = Ticker,
			["Total-Supply"] = tostring(TotalSupply),
			Logo = Logo,
			Denomination = tostring(Denomination),
			Owner = Owner,
			HandlerNames = utils.getHandlerNames(Handlers),
			["Source-Code-TX-ID"] = SourceCodeTxId,
		}
		ao.send(utils.notices.addForwardedTags(msg, {
			Target = msg.From,
			Action = "Info-Notice",
			Tags = info,
			Data = json.encode(info),
		}))
	end)
	createActionHandler(token.ActionMap.Transfer, function(msg)
		local recipient = msg.Tags.Recipient
		utils.validateOwner(msg.From)
		local transferResult = balances.transfer(recipient)
		if not msg.Cast then
			ao.send(utils.notices.debit(msg))
			ao.send(utils.notices.credit(msg))
			utils.notices.notifyState(msg, AntRegistryId)
		end
		ao.send({
			Target = msg.From,
			Data = transferResult,
		})
		return transferResult
	end)

	createActionHandler(token.ActionMap.Balance, function(msg)
		local bal = balances.balance(msg.Tags.Recipient or msg.From)
		ao.send(utils.notices.addForwardedTags(msg, {
			Target = msg.From,
			Action = "Balance-Notice",
			Balance = tostring(bal),
			Ticker = Ticker,
			Address = msg.Tags.Recipient or msg.From,
			Data = bal,
		}))
	end)

	createActionHandler(token.ActionMap.Balances, function(msg)
		ao.send(utils.notices.addForwardedTags(msg, {
			Target = msg.From,
			Action = "Balances-Notice",
			Data = balances.balances(),
		}))
	end)

	createActionHandler(token.ActionMap.TotalSupply, function(msg)
		assert(msg.From ~= ao.id, "Cannot call Total-Supply from the same process!")
		ao.send(utils.notices.addForwardedTags(msg, {
			Target = msg.From,
			Action = "Total-Supply-Notice",
			Data = TotalSupply,
			Ticker = Ticker,
		}))
	end)
end

return token
