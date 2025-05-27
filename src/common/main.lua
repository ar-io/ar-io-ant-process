local ant = {}

function ant.init()
	-- main.lua
	-- utils
	local json = require(".common.json")
	local utils = require(".common.utils")
	local notices = require(".common.notices")
	local createActionHandler = utils.createActionHandler

	-- spec modules
	local balances = require(".common.balances")
	local initialize = require(".common.initialize")
	local records = require(".common.records")
	local controllers = require(".common.controllers")
	local constants = require(".common.constants")

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
	Logo = Logo or constants.DEFAULT_ANT_LOGO
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
	---@alias AntRegistryId string
	---@description The Arweave ID of the ANT Registry contract that this ANT is registered with
	AntRegistryId = AntRegistryId or ao.env.Process.Tags["ANT-Registry-Id"] or nil
	---@alias AntCacheRegistryId string
	---@description The Arweave ID of the ANT Cache Registry contract that this ANT is registered with
	AntCacheRegistryId = AntCacheRegistryId or ao.env.Process.Tags["ANT-Cache-Registry-Id"] or nil

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
		if msg.From ~= Owner then
			utils.Send(msg, {
				Target = msg.From,
				Action = "Transfer-Error",
				["Message-Id"] = msg.Id,
				Error = "Insufficient Balance!",
			})
		end
		balances.transfer(recipient, msg.Tags["Allow-Unsafe-Addresses"])

		if not msg.Cast then
			utils.Send(msg, notices.debit(msg))
			utils.Send(msg, notices.credit(msg))
		end
	end)

	createActionHandler(TokenSpecActionMap.Balance, function(msg)
		local addressToCheck = msg.Tags.Recipient or msg.Tags.Target or msg.From
		local balRes = balances.balance(addressToCheck, msg.Tags["Allow-Unsafe-Addresses"])

		utils.Send(msg, {
			Target = msg.From,
			Action = "Balance-Notice",
			Balance = tostring(balRes),
			Ticker = Ticker,
			Account = addressToCheck,
			Address = addressToCheck,
			Data = tostring(balRes),
		})
	end)

	createActionHandler(TokenSpecActionMap.Balances, function(msg)
		local bals = {}
		for k, v in pairs(balances.balances()) do
			bals[k] = tostring(v)
		end

		utils.Send(msg, { Target = msg.From, Data = json.encode(bals) })
	end)

	createActionHandler(TokenSpecActionMap.TotalSupply, function(msg)
		assert(msg.From ~= ao.id, "Cannot call Total-Supply from the same process!")

		utils.Send(msg, {
			Target = msg.From,
			Action = "Total-Supply",
			Data = tostring(TotalSupply),
			Ticker = Ticker,
		})
	end)

	createActionHandler(TokenSpecActionMap.Info, function(msg)
		utils.Send(msg, {
			Target = msg.From,
			Action = "Info-Notice",
			Tags = {
				Name = Name,
				Ticker = Ticker,
				["Total-Supply"] = tostring(TotalSupply),
				Logo = Logo,
				Description = Description,
				Keywords = json.encode(Keywords),
				Denomination = tostring(Denomination),
				Owner = Owner,
				Handlers = json.encode(utils.getHandlerNames(Handlers)),
			},
			Data = json.encode({
				Name = Name,
				Ticker = Ticker,
				["Total-Supply"] = tostring(TotalSupply),
				Logo = Logo,
				Description = Description,
				Keywords = Keywords,
				Denomination = tostring(Denomination),
				Owner = Owner,
				Handlers = utils.getHandlerNames(Handlers),
			}),
		})
	end)

	-- ActionMap (ANT Spec)

	createActionHandler(ActionMap.AddController, function(msg)
		utils.assertHasPermission(msg.From)
		return controllers.setController(msg.Tags.Controller, msg.Tags["Allow-Unsafe-Addresses"])
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

		local name, transactionId, ttlSeconds, priority =
			string.lower(msg["Sub-Domain"]),
			msg["Transaction-Id"],
			tonumber(msg["TTL-Seconds"]),
			tonumber(msg["Priority"])
		assert(ttlSeconds, "Missing ttl seconds")
		collectgarbage()
		return records.setRecord(name, transactionId, ttlSeconds, priority)
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

	createActionHandler(ActionMap.State, function()
		return utils.getState()
	end)

	-- IO Network Contract Handlers

	createActionHandler(ActionMap.ReleaseName, function(msg)
		utils.validateOwner(msg.From)
		assert(utils.isValidArweaveAddress(msg.Tags["IO-Process-Id"]), "Invalid Arweave ID")

		assert(msg.Tags.Name, "Name is required")

		local name = string.lower(msg.Tags.Name)
		local ioProcess = msg.Tags["IO-Process-Id"]

		-- send the release message to the provided IO Process Id
		utils.Send(msg, {
			Target = ioProcess,
			Action = "Release-Name",
			Initiator = msg.From,
			Name = name,
		})

		utils.Send(msg, {
			Target = msg.From,
			Action = "Release-Name-Notice",
			Initiator = msg.From,
			Name = name,
		})
	end)

	createActionHandler(ActionMap.ReassignName, function(msg)
		utils.validateOwner(msg.From)
		assert(utils.isValidArweaveAddress(msg.Tags["Process-Id"]), "Invalid Arweave ID")

		assert(msg.Tags.Name, "Name is required")

		local name = string.lower(msg.Tags.Name)
		local ioProcess = msg.Tags["IO-Process-Id"]
		local antProcessIdToReassign = msg.Tags["Process-Id"]

		-- send the release message to the provided IO Process Id
		utils.Send(msg, {
			Target = ioProcess,
			Action = "Reassign-Name",
			Initiator = msg.From,
			Name = name,
			["Process-Id"] = antProcessIdToReassign,
		})

		utils.Send(msg, {
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

		assert(utils.isValidArweaveAddress(msg.Tags["IO-Process-Id"]), "Invalid Arweave ID")
		assert(utils.isValidAOAddress(msg.Tags.Recipient, msg.Tags["Allow-Unsafe-Addresses"]), "Invalid AO Address")

		assert(msg.Tags.Name, "Name is required")

		local name = string.lower(msg.Tags.Name)
		local recipient = msg.Tags.Recipient
		local ioProcess = msg.Tags["IO-Process-Id"]

		utils.Send(msg, {
			Target = ioProcess,
			Action = "Approve-Primary-Name-Request",
			Name = name,
			Recipient = recipient,
		})
	end)

	createActionHandler(ActionMap.RemoveNames, function(msg)
		--- NOTE: this could be modified to allow specific users/controllers to remove primary names
		utils.validateOwner(msg.From)
		assert(utils.isValidArweaveAddress(msg.Tags["IO-Process-Id"]), "Invalid Arweave ID")

		assert(msg.Tags.Names, "Names are required")

		local ioProcess = msg.Tags["IO-Process-Id"]
		local names = utils.splitString(msg.Tags.Names)
		for _, name in ipairs(names) do
			utils.validateUndername(name)
		end

		utils.Send(msg, {
			Target = ioProcess,
			Action = "Remove-Primary-Names",
			Names = msg.Tags.Names,
		})
	end)

	--[[
	AOS provides a _boot handler that is designed to load Lua code on boot.
	This handler OVERRIDES this and replaces it with our ANT state initialization handler.

	NOTE: if we use utils.Send here memory blows up for some reason
	]]
	Handlers.prepend("_boot", function(msg)
		return msg.Tags.Type == "Process" and Owner == msg.From
	end, function(msg)
		if type(msg.Data) == "string" then
			-- If data is present assume its an attempt to initialize the state
			local status, res = xpcall(function()
				initialize.initializeANTState(msg.Data)
			end, utils.errorHandler)
			if not status then
				utils.Send(
					msg,
					notices.addForwardedTags(msg, {
						Target = Owner,
						Error = res or "",
						Data = res or "",
						Action = "Invalid-Boot-Notice",
						["Message-Id"] = msg.Id,
					})
				)
			end
		end

		if Owner then
			utils.Send(
				msg,
				notices.credit({
					Target = Owner,
					From = msg.From,
					Sender = Owner,
					Recipient = Owner,
				})
			)
		end

		if AntRegistryId then
			notices.notifyState(msg, AntRegistryId)
		end
	end, 1)
end

return ant
