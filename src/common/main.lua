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

	local ActionMap = {
		-- write
		SetController = "Set-Controller",
		RemoveController = "Remove-Controller",
		SetRecord = "Set-Record",
		RemoveRecord = "Remove-Record",
		SetName = "Set-Name",
		SetTicker = "Set-Ticker",
		--- initialization method for bootstrapping the contract from other platforms ---
		InitializeState = "Initialize-State",
		-- read
		GetControllers = "Get-Controllers",
		GetRecord = "Get-Record",
		GetRecords = "Get-Records",
		State = "State",
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
				utils.validateArweaveId(recipient)
				utils.validateOwner(msg.From)
			end

			local inputStatus, inputResult = pcall(checkAssertions)

			if not inputStatus then
				ao.send({
					Target = msg.From,
					Tags = { Error = "Transfer-Error" },
					Error = tostring(inputResult),
					["Message-Id"] = msg.Id,
					Data = inputResult,
				})
				return
			end
			local transferStatus, transferResult = pcall(balances.transfer, recipient)

			if not transferStatus then
				ao.send({
					Target = msg.From,
					Action = "Transfer-Error",
					Error = tostring(transferResult),
					["Message-Id"] = msg.Id,
					Data = transferResult,
				})
				return
			elseif not msg.Cast then
				ao.send(utils.notices.debit(msg))
				ao.send(utils.notices.credit(msg))
				return
			end
			ao.send({
				Target = msg.From,
				Data = transferResult,
			})
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
					Tags = { Error = "Balance-Error" },
					Error = tostring(balRes),
					["Message-Id"] = msg.Id,
					Data = balRes,
				})
			else
				ao.send({
					Target = msg.From,
					Balance = balRes,
					Ticker = Ticker,
					Account = msg.Tags.Recipient or msg.From,
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
				Action = "Total-Supply",
				Data = TotalSupply,
				Ticker = Ticker,
			})
		end
	)

	Handlers.add(camel(TokenSpecActionMap.Info), utils.hasMatchingTag("Action", TokenSpecActionMap.Info), function(msg)
		local info = {
			Name = Name,
			Ticker = Ticker,
			["Total-Supply"] = TotalSupply,
			Logo = Logo,
			Denomination = Denomination,
			Owner = Owner,
		}
		ao.send({
			Target = msg.From,
			Tags = info,
			Data = json.encode(info),
		})
	end)

	-- ActionMap (ANT Spec)

	Handlers.add(camel(ActionMap.SetController), utils.hasMatchingTag("Action", ActionMap.SetController), function(msg)
		local assertHasPermission, permissionErr = pcall(utils.assertHasPermission, msg.From)
		if assertHasPermission == false then
			return ao.send({
				Target = msg.From,
				Error = "Set-Controller-Error",
				["Message-Id"] = msg.Id,
				Data = permissionErr,
			})
		end
		local controllerStatus, controllerRes = pcall(controllers.setController, msg.Tags.Controller)
		if not controllerStatus then
			ao.send({
				Target = msg.From,
				Error = "Set-Controller-Error",
				["Message-Id"] = msg.Id,
				Data = controllerRes,
			})
			return
		end
		ao.send({ Target = msg.From, Data = controllerRes })
	end)

	Handlers.add(
		camel(ActionMap.RemoveController),
		utils.hasMatchingTag("Action", ActionMap.RemoveController),
		function(msg)
			local assertHasPermission, permissionErr = pcall(utils.assertHasPermission, msg.From)
			if assertHasPermission == false then
				return ao.send({
					Target = msg.From,
					Data = permissionErr,
					Error = "Remove-Controller-Error",
					["Message-Id"] = msg.Id,
				})
			end
			local removeStatus, removeRes = pcall(controllers.removeController, msg.Tags.Controller)
			if not removeStatus then
				ao.send({
					Target = msg.From,
					Data = removeRes,
					Error = "Remove-Controller-Error",
					["Message-Id"] = msg.Id,
				})
				return
			end

			ao.send({ Target = msg.From, Data = removeRes })
		end
	)

	Handlers.add(
		camel(ActionMap.GetControllers),
		utils.hasMatchingTag("Action", ActionMap.GetControllers),
		function(msg)
			ao.send({ Target = msg.From, Data = controllers.getControllers() })
		end
	)

	Handlers.add(camel(ActionMap.SetRecord), utils.hasMatchingTag("Action", ActionMap.SetRecord), function(msg)
		local assertHasPermission, permissionErr = pcall(utils.assertHasPermission, msg.From)
		if assertHasPermission == false then
			return ao.send({
				Target = msg.From,
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
			ao.send({ Target = msg.From, Data = setRecordResult, Error = "Set-Record-Error", ["Message-Id"] = msg.Id })
			return
		end

		ao.send({ Target = msg.From, Data = setRecordResult })
	end)

	Handlers.add(camel(ActionMap.RemoveRecord), utils.hasMatchingTag("Action", ActionMap.RemoveRecord), function(msg)
		local assertHasPermission, permissionErr = pcall(utils.assertHasPermission, msg.From)
		if assertHasPermission == false then
			return ao.send({ Target = msg.From, Data = permissionErr })
		end
		local removeRecordStatus, removeRecordResult = pcall(records.removeRecord, msg.Tags["Sub-Domain"])
		if not removeRecordStatus then
			ao.send({
				Target = msg.From,
				Data = removeRecordResult,
				Error = "Remove-Record-Error",
				["Message-Id"] = msg.Id,
			})
		else
			ao.send({ Target = msg.From, Data = removeRecordResult })
		end
	end)

	Handlers.add(camel(ActionMap.GetRecord), utils.hasMatchingTag("Action", ActionMap.GetRecord), function(msg)
		local nameStatus, nameRes = pcall(records.getRecord, msg.Tags["Sub-Domain"])
		if not nameStatus then
			ao.send({ Target = msg.From, Data = nameRes, Error = "Get-Record-Error", ["Message-Id"] = msg.Id })
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

	Handlers.add(camel(ActionMap.GetRecords), utils.hasMatchingTag("Action", ActionMap.GetRecords), function(msg)
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
				Data = permissionErr,
				Error = "Set-Name-Error",
				["Message-Id"] = msg.Id,
			})
		end
		local nameStatus, nameRes = pcall(balances.setName, msg.Tags.Name)
		if not nameStatus then
			ao.send({ Target = msg.From, Data = nameRes, Error = "Set-Name-Error", ["Message-Id"] = msg.Id })
			return
		end
		ao.send({ Target = msg.From, Data = nameRes })
	end)

	Handlers.add(camel(ActionMap.SetTicker), utils.hasMatchingTag("Action", ActionMap.SetTicker), function(msg)
		local assertHasPermission, permissionErr = pcall(utils.assertHasPermission, msg.From)
		if assertHasPermission == false then
			return ao.send({
				Target = msg.From,
				Data = permissionErr,
				Error = "Set-Ticker-Error",
				["Message-Id"] = msg.Id,
			})
		end
		local tickerStatus, tickerRes = pcall(balances.setTicker, msg.Tags.Ticker)
		if not tickerStatus then
			ao.send({ Target = msg.From, Data = tickerRes, Error = "Set-Ticker-Error", ["Message-Id"] = msg.Id })
			return
		end

		ao.send({ Target = msg.From, Data = tickerRes })
	end)

	Handlers.add(
		camel(ActionMap.InitializeState),
		utils.hasMatchingTag("Action", ActionMap.InitializeState),
		function(msg)
			assert(msg.From == Owner, "Only the owner can initialize the state")
			local initStatus, result = pcall(initialize.initializeANTState, msg.Data)

			if not initStatus then
				ao.send({ Target = msg.From, Data = result, Error = "Initialize-State-Error", ["Message-Id"] = msg.Id })
				return
			else
				ao.send({ Target = msg.From, Data = result })
			end
		end
	)
	Handlers.add(camel(ActionMap.State), utils.hasMatchingTag("Action", ActionMap.State), function(msg)
		local state = {
			records = Records,
			controllers = Controllers,
			balances = Balances,
			owner = Owner,
			name = Name,
			ticker = Ticker,
			logo = Logo,
			denomination = Denomination,
			totalSupply = TotalSupply,
			initialized = Initialized,
		}
		ao.send({ Target = msg.From, Data = json.encode(state) })
	end)
end

return ant
