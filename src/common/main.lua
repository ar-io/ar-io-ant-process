local ant = {}

function ant.init()
	-- main.lua
	-- utils
	local json = require(".common.json")
	local utils = require(".common.utils")
	local camel = utils.camelCase
	-- spec modules
	local balances = require(".common.balances")
	local initialize = require(".common.initialize")
	local records = require(".common.records")
	local controllers = require(".common.controllers")

	Owner = Owner or ao.env.Process.Owner
	Balances = Balances or { [Owner] = 1 }
	Controllers = Controllers or { Owner }

	Name = Name or "Arweave Name Token"
	Ticker = Ticker or "ANT"
	Logo = Logo or "Sie_26dvgyok0PZD_-iQAFOhOd5YxDTkczOLoqTTL_A"
	Denomination = Denomination or 0
	TotalSupply = TotalSupply or 1
	Initialized = Initialized or false
	-- INSERT placeholder used by build script to inject the appropriate ID
	SourceCodeTxId = SourceCodeTxId or "__INSERT_SOURCE_CODE_ID__"
	AntRegistryId = AntRegistryId or ao.env.Process.Tags["ANT-Registry-Id"] or nil

	FirstRun = FirstRun or true

	if FirstRun == true then
		FirstRun = false
		utils.notices.notifyState({}, AntRegistryId)
	end

	local ActionMap = {
		-- write
		AddController = "Add-Controller",
		RemoveController = "Remove-Controller",
		SetRecord = "Set-Record",
		RemoveRecord = "Remove-Record",
		SetName = "Set-Name",
		SetTicker = "Set-Ticker",
		--- initialization method for bootstrapping the contract from other platforms ---
		InitializeState = "Initialize-State",
		-- read
		Controllers = "Controllers",
		Record = "Record",
		Records = "Records",
		State = "State",
		Evolve = "Evolve",
	}

	local TokenSpecActionMap = {
		Info = "Info",
		Balances = "Balances",
		Balance = "Balance",
		Transfer = "Transfer",
		TotalSupply = "Total-Supply",
		CreditNotice = "Credit-Notice",
		-- not implemented
		Mint = "Mint",
		Burn = "Burn",
	}

	Handlers.add(
		camel(TokenSpecActionMap.Transfer),
		utils.hasMatchingTag("Action", TokenSpecActionMap.Transfer),
		function(msg)
			local recipient = msg.Tags.Recipient
			local function checkAssertions()
				utils.validateOwner(msg.From)
			end

			local inputStatus, inputResult = pcall(checkAssertions)

			if not inputStatus then
				ao.send({
					Target = msg.From,
					Tags = { Action = "Invalid-Transfer-Notice", Error = "Transfer-Error" },
					Data = tostring(inputResult),
					["Message-Id"] = msg.Id,
				})
				return
			end
			local transferStatus, transferResult = pcall(balances.transfer, recipient)

			if not transferStatus then
				ao.send({
					Target = msg.From,
					Tags = { Action = "Invalid-Transfer-Notice", Error = "Transfer-Error" },
					["Message-Id"] = msg.Id,
					Data = tostring(transferResult),
				})
				return
			elseif not msg.Cast then
				ao.send(utils.notices.debit(msg))
				ao.send(utils.notices.credit(msg))
				utils.notices.notifyState(msg, AntRegistryId)
				return
			end
			ao.send({
				Target = msg.From,
				Data = transferResult,
			})
			utils.notices.notifyState(msg, AntRegistryId)
		end
	)

	Handlers.add(
		camel(TokenSpecActionMap.Balance),
		utils.hasMatchingTag("Action", TokenSpecActionMap.Balance),
		function(msg)
			local balStatus, balRes = pcall(balances.balance, msg.Tags.Recipient or msg.From)
			if not balStatus then
				ao.send({
					Target = msg.From,
					Tags = { Action = "Invalid-Balance-Notice", Error = "Balance-Error" },
					["Message-Id"] = msg.Id,
					Data = tostring(balRes),
				})
			else
				ao.send({
					Target = msg.From,
					Action = "Balance-Notice",
					Balance = tostring(balRes),
					Ticker = Ticker,
					Address = msg.Tags.Recipient or msg.From,
					Data = balRes,
				})
			end
		end
	)

	Handlers.add(
		camel(TokenSpecActionMap.Balances),
		utils.hasMatchingTag("Action", TokenSpecActionMap.Balances),
		function(msg)
			ao.send({
				Target = msg.From,
				Action = "Balances-Notice",
				Data = balances.balances(),
			})
		end
	)

	Handlers.add(
		camel(TokenSpecActionMap.TotalSupply),
		utils.hasMatchingTag("Action", TokenSpecActionMap.TotalSupply),
		function(msg)
			assert(msg.From ~= ao.id, "Cannot call Total-Supply from the same process!")

			ao.send({
				Target = msg.From,
				Action = "Total-Supply-Notice",
				Data = TotalSupply,
				Ticker = Ticker,
			})
		end
	)

	Handlers.add(camel(TokenSpecActionMap.Info), utils.hasMatchingTag("Action", TokenSpecActionMap.Info), function(msg)
		local info = {
			Name = Name,
			Ticker = Ticker,
			["Total-Supply"] = tostring(TotalSupply),
			Logo = Logo,
			Denomination = tostring(Denomination),
			Owner = Owner,
			HandlerNames = utils.getHandlerNames(Handlers),
			["Source-Code-TX-ID"] = SourceCodeTxId,
			FirstRun = FirstRun,
		}
		ao.send({
			Target = msg.From,
			Action = "Info-Notice",
			Tags = info,
			Data = json.encode(info),
		})
	end)

	-- ActionMap (ANT Spec)

	Handlers.add(camel(ActionMap.AddController), utils.hasMatchingTag("Action", ActionMap.AddController), function(msg)
		local assertHasPermission, permissionErr = pcall(utils.assertHasPermission, msg.From)
		if assertHasPermission == false then
			return ao.send({
				Target = msg.From,
				Action = "Invalid-Add-Controller-Notice",
				Error = "Add-Controller-Error",
				["Message-Id"] = msg.Id,
				Data = permissionErr,
			})
		end
		local controllerStatus, controllerRes = pcall(controllers.setController, msg.Tags.Controller)
		if not controllerStatus then
			ao.send({
				Target = msg.From,
				Action = "Invalid-Add-Controller-Notice",
				Error = "Add-Controller-Error",
				["Message-Id"] = msg.Id,
				Data = controllerRes,
			})
			return
		end
		ao.send({ Target = msg.From, Action = "Add-Controller-Notice", Data = controllerRes })
		utils.notices.notifyState(msg, AntRegistryId)
	end)

	Handlers.add(
		camel(ActionMap.RemoveController),
		utils.hasMatchingTag("Action", ActionMap.RemoveController),
		function(msg)
			local assertHasPermission, permissionErr = pcall(utils.assertHasPermission, msg.From)
			if assertHasPermission == false then
				return ao.send({
					Target = msg.From,
					Action = "Invalid-Remove-Controller-Notice",
					Data = permissionErr,
					Error = "Remove-Controller-Error",
					["Message-Id"] = msg.Id,
				})
			end
			local removeStatus, removeRes = pcall(controllers.removeController, msg.Tags.Controller)
			if not removeStatus then
				ao.send({
					Target = msg.From,
					Action = "Invalid-Remove-Controller-Notice",
					Data = removeRes,
					Error = "Remove-Controller-Error",
					["Message-Id"] = msg.Id,
				})
				return
			end

			ao.send({ Target = msg.From, Action = "Remove-Controller-Notice", Data = removeRes })
			utils.notices.notifyState(msg, AntRegistryId)
		end
	)

	Handlers.add(camel(ActionMap.Controllers), utils.hasMatchingTag("Action", ActionMap.Controllers), function(msg)
		ao.send({ Target = msg.From, Action = "Controllers-Notice", Data = controllers.getControllers() })
	end)

	Handlers.add(camel(ActionMap.SetRecord), utils.hasMatchingTag("Action", ActionMap.SetRecord), function(msg)
		local assertHasPermission, permissionErr = pcall(utils.assertHasPermission, msg.From)
		if assertHasPermission == false then
			return ao.send({
				Target = msg.From,
				Action = "Invalid-Set-Record-Notice",
				Data = permissionErr,
				Error = "Set-Record-Error",
				["Message-Id"] = msg.Id,
			})
		end
		local tags = msg.Tags
		local name, transactionId, ttlSeconds =
			tags["Sub-Domain"], tags["Transaction-Id"], tonumber(tags["TTL-Seconds"])

		local setRecordStatus, setRecordResult = pcall(records.setRecord, name, transactionId, ttlSeconds)
		if not setRecordStatus then
			ao.send({
				Target = msg.From,
				Action = "Invalid-Set-Record-Notice",
				Data = setRecordResult,
				Error = "Set-Record-Error",
				["Message-Id"] = msg.Id,
			})
			return
		end

		ao.send({ Target = msg.From, Action = "Set-Record-Notice", Data = setRecordResult })
	end)

	Handlers.add(camel(ActionMap.RemoveRecord), utils.hasMatchingTag("Action", ActionMap.RemoveRecord), function(msg)
		local assertHasPermission, permissionErr = pcall(utils.assertHasPermission, msg.From)
		if assertHasPermission == false then
			return ao.send({ Target = msg.From, Action = "Invalid-Remove-Record-Notice", Data = permissionErr })
		end
		local removeRecordStatus, removeRecordResult = pcall(records.removeRecord, msg.Tags["Sub-Domain"])
		if not removeRecordStatus then
			ao.send({
				Target = msg.From,
				Action = "Invalid-Remove-Record-Notice",
				Data = removeRecordResult,
				Error = "Remove-Record-Error",
				["Message-Id"] = msg.Id,
			})
		else
			ao.send({ Target = msg.From, Data = removeRecordResult })
		end
	end)

	Handlers.add(camel(ActionMap.Record), utils.hasMatchingTag("Action", ActionMap.Record), function(msg)
		local nameStatus, nameRes = pcall(records.getRecord, msg.Tags["Sub-Domain"])
		if not nameStatus then
			ao.send({
				Target = msg.From,
				Action = "Invalid-Record-Notice",
				Data = nameRes,
				Error = "Record-Error",
				["Message-Id"] = msg.Id,
			})
			return
		end

		local recordNotice = {
			Target = msg.From,
			Action = "Record-Notice",
			Name = msg.Tags["Sub-Domain"],
			Data = nameRes,
		}

		-- Add forwarded tags to the credit and debit notice messages
		for tagName, tagValue in pairs(msg) do
			-- Tags beginning with "X-" are forwarded
			if string.sub(tagName, 1, 2) == "X-" then
				recordNotice[tagName] = tagValue
			end
		end

		-- Send Record-Notice
		ao.send(recordNotice)
	end)

	Handlers.add(camel(ActionMap.Records), utils.hasMatchingTag("Action", ActionMap.Records), function(msg)
		local records = records.getRecords()

		-- Credit-Notice message template, that is sent to the Recipient of the transfer
		local recordsNotice = {
			Target = msg.From,
			Action = "Records-Notice",
			Data = records,
		}

		-- Add forwarded tags to the records notice messages
		for tagName, tagValue in pairs(msg) do
			-- Tags beginning with "X-" are forwarded
			if string.sub(tagName, 1, 2) == "X-" then
				recordsNotice[tagName] = tagValue
			end
		end

		-- Send Records-Notice
		ao.send(recordsNotice)
	end)

	Handlers.add(camel(ActionMap.SetName), utils.hasMatchingTag("Action", ActionMap.SetName), function(msg)
		local assertHasPermission, permissionErr = pcall(utils.assertHasPermission, msg.From)
		if assertHasPermission == false then
			return ao.send({
				Target = msg.From,
				Action = "Invalid-Set-Name-Notice",
				Data = permissionErr,
				Error = "Set-Name-Error",
				["Message-Id"] = msg.Id,
			})
		end
		local nameStatus, nameRes = pcall(balances.setName, msg.Tags.Name)
		if not nameStatus then
			ao.send({
				Target = msg.From,
				Action = "Invalid-Set-Name-Notice",
				Data = nameRes,
				Error = "Set-Name-Error",
				["Message-Id"] = msg.Id,
			})
			return
		end
		ao.send({ Target = msg.From, Action = "Set-Name-Notice", Data = nameRes })
	end)

	Handlers.add(camel(ActionMap.SetTicker), utils.hasMatchingTag("Action", ActionMap.SetTicker), function(msg)
		local assertHasPermission, permissionErr = pcall(utils.assertHasPermission, msg.From)
		if assertHasPermission == false then
			return ao.send({
				Target = msg.From,
				Action = "Invalid-Set-Ticker-Notice",
				Data = permissionErr,
				Error = "Set-Ticker-Error",
				["Message-Id"] = msg.Id,
			})
		end
		local tickerStatus, tickerRes = pcall(balances.setTicker, msg.Tags.Ticker)
		if not tickerStatus then
			ao.send({
				Target = msg.From,
				Action = "Invalid-Set-Ticker-Notice",
				Data = tickerRes,
				Error = "Set-Ticker-Error",
				["Message-Id"] = msg.Id,
			})
			return
		end

		ao.send({ Target = msg.From, Action = "Set-Ticker-Notice", Data = tickerRes })
	end)

	Handlers.add(
		camel(ActionMap.InitializeState),
		utils.hasMatchingTag("Action", ActionMap.InitializeState),
		function(msg)
			assert(msg.From == Owner, "Only the owner can initialize the state")
			local initStatus, result = pcall(initialize.initializeANTState, msg.Data)

			if not initStatus then
				ao.send({
					Target = msg.From,
					Action = "Invalid-Initialize-State-Notice",
					Data = result,
					Error = "Initialize-State-Error",
					["Message-Id"] = msg.Id,
				})
				return
			else
				ao.send({ Target = msg.From, Action = "Initialize-State-Notice", Data = result })
				utils.notices.notifyState(msg, AntRegistryId)
			end
		end
	)
	Handlers.add(camel(ActionMap.State), utils.hasMatchingTag("Action", ActionMap.State), function(msg)
		utils.notices.notifyState(msg, msg.From)
	end)

	Handlers.prepend(camel(ActionMap.Evolve), utils.hasMatchingTag("Action", "Eval"), function(msg)
		local srcCodeTxId = msg.Tags["Source-Code-TX-ID"]
		if not srcCodeTxId then
			return
		end
		local srcCodeTxIdStatus, srcCodeTxIdResult = pcall(utils.validateArweaveId, srcCodeTxId)
		if srcCodeTxIdStatus and not srcCodeTxIdStatus then
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
	end)
end

return ant
