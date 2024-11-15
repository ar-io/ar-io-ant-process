local ant = {}

function ant.init()
	-- main.lua
	-- utils
	local json = require(".common.json")
	local utils = require(".common.utils")
	local notices = require(".common.notices")
	local camel = utils.camelCase
	local createActionHandler = utils.createActionHandler

	-- spec modules
	local balances = require(".common.balances")
	local initialize = require(".common.initialize")
	local records = require(".common.records")
	local controllers = require(".common.controllers")

	---@alias Owner string
	---@description The owner of the ANT
	Owner = Owner or ao.env.Process.Owner
	---@alias Balances table<string, integer>
	---@description The list of balances for the ANT
	Balances = Balances or { [Owner] = 1 }
	---@alias Controllers table<integer, string>
	---@description The list of controllers for the ANT
	Controllers = Controllers or { Owner }

	---@alias Name string
	---@description The name of the ANT
	Name = Name or "Arweave Name Token"
	---@alias Ticker string
	---@description The ticker symbol of the ANT
	Ticker = Ticker or "ANT"
	---@alias Logo string
	---@description Arweave transaction ID that is the logo of the ANT
	Logo = Logo or "Sie_26dvgyok0PZD_-iQAFOhOd5YxDTkczOLoqTTL_A"
	---@alias Description string
	---@description A brief description of this ANT up to 255 characters
	Description = Description or "A brief description of this ANT."
	---@alias Keywords string[]
	---@description A list of keywords that describe this ANT. Each keyword must be a string, unique, and less than 32 characters. There can be up to 16 keywords
	Keywords = Keywords or {}
	---@alias Denomination integer
	---@description The denomination of the ANT - this is set to 0 to denote integer values
	Denomination = Denomination or 0
	---@alias TotalSupply integer
	---@description The total supply of the ANT - this is set to 1 to denote single ownership
	TotalSupply = TotalSupply or 1
	---@alias Initialized boolean
	---@description Whether the ANT has been initialized with the
	Initialized = Initialized or false
	---@alias SourceCodeTxId string
	---@description The Arweave ID of the lua source the ANT currently uses. INSERT placeholder used by build script to inject the appropriate ID
	SourceCodeTxId = SourceCodeTxId or "__INSERT_SOURCE_CODE_ID__"
	---@alias AntRegistryId string
	---@description The Arweave ID of the ANT Registry contract that this ANT is registered with
	AntRegistryId = AntRegistryId or ao.env.Process.Tags["ANT-Registry-Id"] or nil

	local ActionMap = {
		-- write
		AddController = "Add-Controller",
		RemoveController = "Remove-Controller",
		SetRecord = "Set-Record",
		RemoveRecord = "Remove-Record",
		SetName = "Set-Name",
		SetTicker = "Set-Ticker",
		SetDescription = "Set-Description",
		SetKeywords = "Set-Keywords",
		SetLogo = "Set-Logo",
		--- initialization method for bootstrapping the contract from other platforms ---
		InitializeState = "Initialize-State",
		-- read
		Controllers = "Controllers",
		Record = "Record",
		Records = "Records",
		State = "State",
		Evolve = "Evolve",
		-- IO Network Contract Handlers
		ReleaseName = "Release-Name",
		ReassignName = "Reassign-Name",
		ApproveName = "Approve-Primary-Name",
		RemoveNames = "Remove-Primary-Names",
	}

	local TokenSpecActionMap = {
		Info = "Info",
		Balances = "Balances",
		Balance = "Balance",
		Transfer = "Transfer",
		TotalSupply = "Total-Supply",
	}

	createActionHandler(TokenSpecActionMap.Transfer, function(msg)
		local recipient = msg.Tags.Recipient
		utils.validateOwner(msg.From)
		balances.transfer(recipient)
		if not msg.Cast then
			ao.send(notices.debit(msg))
			ao.send(notices.credit(msg))
		end
	end)

	createActionHandler(TokenSpecActionMap.Balance, function(msg)
		local balRes = balances.balance(msg.Tags.Recipient or msg.From)

		ao.send({
			Target = msg.From,
			Action = "Balance-Notice",
			Balance = tostring(balRes),
			Ticker = Ticker,
			Address = msg.Tags.Recipient or msg.From,
			Data = balRes,
		})
	end)

	createActionHandler(TokenSpecActionMap.Balances, function()
		return balances.balances()
	end)

	createActionHandler(TokenSpecActionMap.TotalSupply, function(msg)
		assert(msg.From ~= ao.id, "Cannot call Total-Supply from the same process!")

		ao.send({
			Target = msg.From,
			Action = "Total-Supply-Notice",
			Data = TotalSupply,
			Ticker = Ticker,
		})
	end)

	createActionHandler(TokenSpecActionMap.Info, function(msg)
		local info = {
			Name = Name,
			Ticker = Ticker,
			["Total-Supply"] = tostring(TotalSupply),
			Logo = Logo,
			Description = Description,
			Keywords = Keywords,
			Denomination = tostring(Denomination),
			Owner = Owner,
			Handlers = utils.getHandlerNames(Handlers),
			["Source-Code-TX-ID"] = SourceCodeTxId,
		}
		ao.send({
			Target = msg.From,
			Action = "Info-Notice",
			Tags = info,
			Data = json.encode(info),
		})
	end)

	-- ActionMap (ANT Spec)

	createActionHandler(ActionMap.AddController, function(msg)
		utils.assertHasPermission(msg.From)
		return controllers.setController(msg.Tags.Controller)
	end)

	createActionHandler(ActionMap.RemoveController, function(msg)
		utils.assertHasPermission(msg.From)
		return controllers.removeController(msg.Tags.Controller)
	end)

	createActionHandler(ActionMap.Controllers, function()
		return controllers.getControllers()
	end)

	createActionHandler(ActionMap.SetRecord, function(msg)
		utils.assertHasPermission(msg.From)
		local tags = msg.Tags
		local name, transactionId, ttlSeconds =
			string.lower(tags["Sub-Domain"]), tags["Transaction-Id"], tonumber(tags["TTL-Seconds"])
		assert(ttlSeconds, "Missing ttl seconds")
		return records.setRecord(name, transactionId, ttlSeconds)
	end)

	createActionHandler(ActionMap.RemoveRecord, function(msg)
		utils.assertHasPermission(msg.From)
		return records.removeRecord(string.lower(msg.Tags["Sub-Domain"]))
	end)

	createActionHandler(ActionMap.Record, function(msg)
		local name = string.lower(msg.Tags["Sub-Domain"])
		return records.getRecord(name)
	end)

	createActionHandler(ActionMap.Records, function()
		return records.getRecords()
	end)

	createActionHandler(ActionMap.SetName, function(msg)
		utils.assertHasPermission(msg.From)
		return balances.setName(msg.Tags.Name)
	end)

	createActionHandler(ActionMap.SetTicker, function(msg)
		utils.assertHasPermission(msg.From)
		return balances.setTicker(msg.Tags.Ticker)
	end)

	createActionHandler(ActionMap.SetDescription, function(msg)
		utils.assertHasPermission(msg.From)
		return balances.setDescription(msg.Tags.Description)
	end)

	createActionHandler(ActionMap.SetKeywords, function(msg)
		utils.assertHasPermission(msg.From)
		local success, keywords = pcall(json.decode, msg.Tags.Keywords)
		assert(success and type(keywords) == "table", "Invalid JSON format for keywords")
		return balances.setKeywords(keywords)
	end)

	createActionHandler(ActionMap.SetLogo, function(msg)
		utils.assertHasPermission(msg.From)
		return balances.setLogo(msg.Logo)
	end)

	createActionHandler(ActionMap.InitializeState, function(msg)
		return initialize.initializeANTState(msg.Data)
	end)

	createActionHandler(ActionMap.State, function(msg)
		notices.notifyState(msg, msg.From)
	end)

	-- IO Network Contract Handlers

	createActionHandler(ActionMap.ReleaseName, function(msg)
		utils.validateOwner(msg.From)
		utils.validateArweaveId(msg.Tags["IO-Process-Id"])

		assert(msg.Tags.Name, "Name is required")

		local name = string.lower(msg.Tags.Name)
		local ioProcess = msg.Tags["IO-Process-Id"]

		-- send the release message to the provided IO Process Id
		ao.send({
			Target = ioProcess,
			Action = "Release-Name",
			Initiator = msg.From,
			Name = name,
		})

		ao.send({
			Target = msg.From,
			Action = "Release-Name-Notice",
			Initiator = msg.From,
			Name = name,
		})
	end)

	createActionHandler(ActionMap.ReassignName, function(msg)
		utils.validateOwner(msg.From)
		utils.validateArweaveId(msg.Tags["Process-Id"])

		assert(msg.Tags.Name, "Name is required")

		local name = string.lower(msg.Tags.Name)
		local ioProcess = msg.Tags["IO-Process-Id"]
		local antProcessIdToReassign = msg.Tags["Process-Id"]

		-- send the release message to the provided IO Process Id
		ao.send({
			Target = ioProcess,
			Action = "Reassign-Name",
			Initiator = msg.From,
			Name = name,
			["Process-Id"] = antProcessIdToReassign,
		})

		ao.send({
			Target = msg.From,
			Action = "Reassign-Name-Notice",
			Initiator = msg.From,
			Name = name,
			["Process-Id"] = antProcessIdToReassign,
		})
	end)

	createActionHandler(ActionMap.ApproveName, function(msg)
		--- NOTE: this could be modified to allow specific users/controllers to create claims
		utils.validateOwner(msg.From)
		utils.validateArweaveId(msg.Tags["IO-Process-Id"])
		utils.validateArweaveId(msg.Tags.Recipient)

		assert(msg.Tags.Name, "Name is required")

		local name = string.lower(msg.Tags.Name)
		local recipient = msg.Tags.Recipient
		local ioProcess = msg.Tags["IO-Process-Id"]

		ao.send({
			Target = ioProcess,
			Action = "Approve-Primary-Name-Request",
			Name = name,
			Recipient = recipient,
		})
	end)

	createActionHandler(ActionMap.RemoveNames, function(msg)
		--- NOTE: this could be modified to allow specific users/controllers to remove primary names
		utils.validateOwner(msg.From)
		utils.validateArweaveId(msg.Tags["IO-Process-Id"])

		assert(msg.Tags.Names, "Names are required")

		local ioProcess = msg.Tags["IO-Process-Id"]
		local names = utils.splitString(msg.Tags.Names)
		for _, name in ipairs(names) do
			utils.validateUndername(name)
		end

		ao.send({
			Target = ioProcess,
			Action = "Remove-Primary-Names",
			Names = json.encode(names),
		})
	end)

	Handlers.prepend(
		camel(ActionMap.Evolve),
		Handlers.utils.continue(utils.hasMatchingTag("Action", "Eval")),
		function(msg)
			local srcCodeTxId = msg.Tags["Source-Code-TX-ID"]
			if not srcCodeTxId then
				return
			end

			if Owner ~= msg.From then
				ao.send({
					Target = msg.From,
					Action = "Invalid-Evolve-Notice",
					Error = "Evolve-Error",
					["Message-Id"] = msg.Id,
					Data = "Only the Owner [" .. Owner or "no owner set" .. "] can call Evolve",
				})
				return
			end

			local srcCodeTxIdStatus = pcall(utils.validateArweaveId, srcCodeTxId)
			if not srcCodeTxIdStatus then
				ao.send({
					Target = msg.From,
					Action = "Invalid-Evolve-Notice",
					Error = "Evolve-Error",
					["Message-Id"] = msg.Id,
					Data = "Source-Code-TX-ID is required",
				})
				return
			end
			SourceCodeTxId = srcCodeTxId
		end
	)
end

return ant
