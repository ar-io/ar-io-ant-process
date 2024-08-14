local utils = require(".common.utils")
local createActionHandler = utils.createActionHandler
local ant = {}

ant.ActionMap = {
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
	EvalStateAdvisory = "Eval-State-Advisory",
}
function ant.init()
	local utils = require(".common.utils")
	-- spec modules
	local balances = require(".common.balances")
	local initialize = require(".common.initialize")
	local records = require(".common.records")
	local controllers = require(".common.controllers")

	Controllers = Controllers or { Owner }
	Name = Name or "Arweave Name Token"
	Ticker = Ticker or "ANT"

	Initialized = Initialized or false
	-- INSERT placeholder used by build script to inject the appropriate ID
	SourceCodeTxId = SourceCodeTxId or "__INSERT_SOURCE_CODE_ID__"
	AntRegistryId = AntRegistryId or ao.env.Process.Tags["ANT-Registry-Id"] or nil
	-- Undername Purchasing variables

	createActionHandler(ant.ActionMap.AddController, function(msg)
		utils.assertHasPermission(msg.From)
		local controllerRes = controllers.setController(msg.Tags.Controller)
		ao.send({ Target = msg.From, Action = "Add-Controller-Notice", Data = controllerRes })
		utils.notices.notifyState(msg, AntRegistryId)
	end)

	createActionHandler(ant.ActionMap.RemoveController, function(msg)
		utils.assertHasPermission(msg.From)
		local removeRes = controllers.removeController(msg.Tags.Controller)
		ao.send({ Target = msg.From, Action = "Remove-Controller-Notice", Data = removeRes })
		utils.notices.notifyState(msg, AntRegistryId)
	end)

	createActionHandler(ant.ActionMap.Controllers, function(msg)
		ao.send({ Target = msg.From, Action = "Controllers-Notice", Data = controllers.getControllers() })
	end)

	createActionHandler(ant.ActionMap.SetRecord, function(msg)
		utils.assertHasPermission(msg.From)
		local tags = msg.Tags
		local setRecordResult =
			records.setRecord(tags["Sub-Domain"], tags["Transaction-Id"], tonumber(tags["TTL-Seconds"]))
		ao.send({ Target = msg.From, Action = "Set-Record-Notice", Data = setRecordResult })
	end)

	createActionHandler(ant.ActionMap.RemoveRecord, function(msg)
		utils.assertHasPermission(msg.From)
		local removeRecordResult = records.removeRecord(msg.Tags["Sub-Domain"])
		ao.send({ Target = msg.From, Data = removeRecordResult })
	end)

	createActionHandler(ant.ActionMap.Record, function(msg)
		local nameRes = records.getRecord(msg.Tags["Sub-Domain"])
		ao.send(utils.notices.addForwardedTags(msg, {
			Target = msg.From,
			Action = "Record-Notice",
			Name = msg.Tags["Sub-Domain"],
			Data = nameRes,
		}))
	end)

	createActionHandler(ant.ActionMap.Records, function(msg)
		ao.send(utils.notices.addForwardedTags(msg, {
			Target = msg.From,
			Action = "Records-Notice",
			Data = records.getRecords(),
		}))
	end)

	createActionHandler(ant.ActionMap.SetName, function(msg)
		utils.assertHasPermission(msg.From)
		local nameRes = balances.setName(msg.Tags.Name)
		ao.send({ Target = msg.From, Action = "Set-Name-Notice", Data = nameRes })
	end)

	createActionHandler(ant.ActionMap.SetTicker, function(msg)
		utils.assertHasPermission(msg.From)
		local tickerRes = balances.setTicker(msg.Tags.Ticker)
		ao.send({ Target = msg.From, Action = "Set-Ticker-Notice", Data = tickerRes })
	end)

	createActionHandler(ant.ActionMap.InitializeState, function(msg)
		assert(msg.From == Owner, "Only the owner can initialize the state")
		local result = initialize.initializeANTState(msg.Data)
		ao.send({ Target = msg.From, Action = "Initialize-State-Notice", Data = result })
		utils.notices.notifyState(msg, AntRegistryId)
	end)

	createActionHandler(ant.ActionMap.State, function(msg)
		utils.notices.notifyState(msg, msg.From)
	end)

	Handlers.prepend(
		utils.camelCase(ant.ActionMap.Evolve),
		Handlers.utils.hasMatchingTag("Action", "Eval"),
		function(msg)
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
		end
	)
	-- after doing evals update the ANT registry in case that eval changed the state
	Handlers.append(
		utils.camelCase(ant.ActionMap.EvalStateAdvisory),
		Handlers.utils.hasMatchingTag("Action", "Eval"),
		function(msg)
			utils.notices.notifyState(msg, AntRegistryId)
		end
	)
end

return ant
