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
		TransferRecord = "Transfer-Record",

		-- read
		Controllers = "Controllers",
		Record = "Record",
		Records = "Records",
		State = "State",
		-- IO Network Contract Handlers
		ReleaseName = "Release-Name",
		ReassignName = "Reassign-Name",
		ApprovePrimaryName = "Approve-Primary-Name",
		RemovePrimaryNames = "Remove-Primary-Names",
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

		-- For token spec compliance, we need to return an error message if the caller is not the owner
		-- action must be Transfer-Error, Error must be Insufficient Balance!
		if msg.From ~= Owner then
			utils.Send(msg, {
				Target = msg.From,
				Action = "Transfer-Error",
				["Message-Id"] = msg.Id,
				Error = "Insufficient Balance!",
			})
			return
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
		local caller = msg.From
		local allowUnsafeAddresses = msg.Tags["Allow-Unsafe-Addresses"]

		local name = assert(msg.Tags["Sub-Domain"], "Sub-Domain is required") and string.lower(msg.Tags["Sub-Domain"])
		local transactionId = msg.Tags["Transaction-Id"]
		local ttlSeconds = tonumber(msg.Tags["TTL-Seconds"])
		local priority = tonumber(msg.Tags["Priority"])
		local owner = msg.Tags["Record-Owner"]
		local displayName = msg.Tags["Display-Name"]
		local logo = msg.Tags["Logo"]
		local description = msg.Tags["Description"]
		local keywords = msg.Tags["Keywords"] and json.decode(msg.Tags["Keywords"]) or nil

		return records.setRecord(
			name,
			transactionId,
			ttlSeconds,
			priority,
			owner,
			displayName,
			logo,
			description,
			keywords,
			caller,
			allowUnsafeAddresses
		)
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

	createActionHandler(ActionMap.TransferRecord, function(msg)
		local subdomain = assert(msg.Tags["Sub-Domain"], "Sub-Domain is required")
			and string.lower(msg.Tags["Sub-Domain"])
		local recipient = msg.Tags["Recipient"]
		local caller = msg.From

		-- Validate inputs

		assert(utils.isValidAOAddress(recipient, msg.Tags["Allow-Unsafe-Addresses"]), "Invalid recipient address")

		-- Check if record exists and has an owner
		local record = Records[subdomain]
		assert(record ~= nil, "Record does not exist")
		assert(record.owner ~= nil, "Record has no owner - must have an owner to transfer")

		-- Check permissions (ANT owner/controllers can transfer any record, record owners can transfer their own)
		utils.assertHasRecordPermission(caller, subdomain)

		-- Use existing transfer function with proper garbage collection
		local transferResult = records.transferRecord(subdomain, recipient, msg.Tags["Allow-Unsafe-Addresses"])

		-- send an additional notice to the new owner to notify them of the ownership transfer
		utils.Send(msg, {
			Target = recipient,
			Action = "Transfer-Record-Notice",
			["Sub-Domain"] = subdomain,
			["Previous-Owner"] = transferResult.previousOwner,
			Data = json.encode(transferResult),
		})

		-- return the result so createActionHandler sends a notice to the caller
		return transferResult
	end)

	createActionHandler(ActionMap.State, function()
		return utils.getState()
	end)

	-- ARIO Network Contract Handlers
	--[[
		These handlers expect and IO-Process-Id tag to be present in the message and can only be called by the owner of the ANT.
		The handler acts as a proxy, and sends the corresponding message to the ARIO Network contract.
	]]
	createActionHandler(ActionMap.ReleaseName, function(msg)
		utils.validateOwner(msg.From)
		assert(utils.isValidArweaveAddress(msg.Tags["IO-Process-Id"]), "Invalid IO process ID")

		assert(msg.Tags.Name, "Name is required")

		local name = string.lower(msg.Tags.Name)
		local ioProcess = msg.Tags["IO-Process-Id"]

		-- Sends a release message to the provided IO Process ID
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
		assert(utils.isValidArweaveAddress(msg.Tags["Process-Id"]), "Invalid ANT process ID")
		assert(utils.isValidArweaveAddress(msg.Tags["IO-Process-Id"]), "Invalid IO process ID")
		assert(msg.Tags.Name, "Name is required")

		local name = string.lower(msg.Tags.Name)
		local ioProcess = msg.Tags["IO-Process-Id"]
		local antProcessIdToReassign = msg.Tags["Process-Id"]

		-- Sends a reassign message to the provided IO Process ID
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

	createActionHandler(ActionMap.ApprovePrimaryName, function(msg)
		local caller = msg.From
		assert(msg.Tags.Name, "Name is required")
		local name = string.lower(msg.Tags.Name)
		local ioProcess = msg.Tags["IO-Process-Id"]
		assert(utils.isValidArweaveAddress(msg.Tags["IO-Process-Id"]), "Invalid Arweave ID")

		local recipient = msg.Tags.Recipient
		assert(utils.isValidAOAddress(recipient, msg.Tags["Allow-Unsafe-Addresses"]), "Invalid AO Address")

		local undername = utils.undernameForName(name)
		local isAntOwner = caller == Owner
		local isRecordOwner = Records[undername] ~= nil and Records[undername].owner == caller

		assert(
			isAntOwner or isRecordOwner,
			"Only the ANT owner or the record owner can approve primary name requests for " .. name
		)

		if isAntOwner then
			utils.Send(msg, {
				Target = ioProcess,
				Action = "Approve-Primary-Name-Request",
				Name = name,
				Recipient = recipient,
			})
			return
		end

		if isRecordOwner then
			assert(undername ~= nil, "Undername must be provided")
			assert(recipient == caller, "Undername owners can only approve names for themselves")
			utils.Send(msg, {
				Target = ioProcess,
				Action = "Approve-Primary-Name-Request",
				Name = name,
				Recipient = recipient,
			})
			return
		end
	end)

	createActionHandler(ActionMap.RemovePrimaryNames, function(msg)
		local caller = msg.From
		assert(utils.isValidArweaveAddress(msg.Tags["IO-Process-Id"]), "Invalid Arweave ID")
		assert(msg.Tags.Names, "Names are required")

		local ioProcess = msg.Tags["IO-Process-Id"]
		local names = utils.splitString(msg.Tags.Names)

		-- Validate each name
		for _, name in ipairs(names) do
			utils.validateUndername(name)
			local lowerName = string.lower(name)
			local undername = utils.undernameForName(lowerName)
			local isAntOwner = caller == Owner
			local isRecordOwner = Records[undername] ~= nil and Records[undername].owner == caller

			assert(
				isAntOwner or isRecordOwner,
				"Only the ANT owner or the record owner can remove primary names for " .. name
			)
		end

		utils.Send(msg, {
			Target = ioProcess,
			Action = "Remove-Primary-Names",
			Names = msg.Tags.Names,
		})
	end)

	-- END ARIO Network Contract Handlers

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

		-- send a patch notice on instance boot
		ao.send({
			device = "patch@1.0",
			cache = utils.getState(), -- serialization is done by hyperbeam ~seralize@1.0 device, so no need to spend compute here to do it
		})

		-- send self state notice to enable hyperbeam to cache the state. The SU will not process the boot result otherwise.
		notices.notifyState(msg, ao.id)
	end, 1)
end

return ant
