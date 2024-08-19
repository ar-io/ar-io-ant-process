local constants = require(".common.constants")
local purchaseTypes = constants.purchaseTypes
local utils = require(".common.utils")
local createActionHandler = utils.createActionHandler
local json = require(".common.json")
local purchasing = {}

purchasing.ActionMap = {
	-- write
	SetPriceSettings = "Set-Price-Settings",
	SetTokenSettings = "Set-Token-Settings",
	-- X- because this will come in as a credit notice and should have forwarded tags
	BuyRecord = "X-Buy-Record",
	-- todo
	Publish = "Publish",
	-- read
	GetPriceSettings = "Get-Price-Settings",
	GetPriceForAction = "Get-Price-For-Action",
	-- response handler for token info on setting token settings
	InfoNotice = "Info-Notice",
}

function purchasing.init()
	PriceSettings = PriceSettings
		or {
			defaults = constants.purchasing.defaults, -- which tokens are allowed to be used for purchasing undernames
			whiteListedTokens = {
				["agYcCFJtrMG6cqMuZfskIkFTGvUPddICmtQSBIoPdiA"] = {
					info = {
						Name = "IO",
						Ticker = "IO",
						Logo = "",
						Owner = "",
						Denomination = "",
					},
					tokenRate = 1, -- multiplier for price, eg price * rate
					overrides = {
						--- overrides for the default settings ---
					},
				},
			},
		}

	createActionHandler(purchasing.ActionMap.SetPriceSettings, function(msg)
		assert(msg.From == Owner, "Only the owner can set the price settings")
		local settings = json.decode(msg.Data)
		PriceSettings.defaults = utils.setupSettings(PriceSettings.defaults, settings)
		ao.send(utils.notices.addForwardedTags(msg, {
			Target = msg.From,
			Action = "Set-Price-Settings-Notice",
			Data = json.encode(PriceSettings),
		}))
	end)

	createActionHandler(purchasing.ActionMap.SetTokenSettings, function(msg)
		assert(msg.From == Owner, "Only the owner can set the token settings")
		local token = msg.Tags["Token-Id"]
		assert(token, "Token-Id tag is required")
		local settingsStatus, settingsRes = pcall(json.decode, msg.Data)
		local settings = settingsStatus and settingsRes or {}

		if not PriceSettings.whiteListedTokens[token] then
			PriceSettings.whiteListedTokens[token] = {
				info = {
					Name = "",
					Ticker = "",
					Logo = "",
					Owner = "",
					Denomination = "",
				},
				tokenRate = 1,
				overrides = {},
			}
			ao.send(utils.notices.addForwardedTags(msg, {
				Target = token,
				Action = "Info",
			}))
		end

		local tokenRate = settings.tokenRate or PriceSettings.whiteListedTokens[token].tokenRate
		assert(type(tokenRate) == "number", "Invalid token rate")
		local overrides = settings.overrides or {}

		-- Use setupSettings to apply overrides recursively
		PriceSettings.whiteListedTokens[token].overrides =
			utils.setupSettings(overrides, PriceSettings.whiteListedTokens[token].overrides)

		PriceSettings.whiteListedTokens[token].tokenRate = tokenRate

		ao.send(utils.notices.addForwardedTags(msg, {
			Target = msg.From,
			Action = "Set-Token-Settings-Notice",
			Data = json.encode(PriceSettings.whiteListedTokens),
		}))
	end)

	createActionHandler(purchasing.ActionMap.GetPriceSettings, function(msg)
		ao.send(utils.notices.addForwardedTags(msg, {
			Target = msg.From,
			Action = "Get-Price-Settings-Notice",
			Data = json.encode(PriceSettings),
		}))
	end)

	utils.createForwardedActionHandler(purchasing.ActionMap.BuyRecord, function(msg)
		-- safely execute here and only then throw to refund the tokens
		--[[
			NOTE: this could possibly be abused to steal tokens from the ANT itself, but the ANT can protect itself by not holding too many tokens.
			Not exactly sure how this could be exploited, but it's a possibility.
		]]
		local buyStatus, buyRecordParams = pcall(utils.parseBuyRecord, msg)
		if not buyStatus then
			utils.refundTokens(msg)
			error(buyRecordParams)
		end

		local settings = buyRecordParams.settings
		local undername = buyRecordParams.undername
		local underAntId = buyRecordParams.underAntId
		local quantity = buyRecordParams.quantity
		local purchaseType = buyRecordParams.purchaseType
		local price = buyRecordParams.price

		if settings.taxSettings.enabled then
			utils.taxPurchase(msg, quantity, settings.taxSettings.taxRate, settings.taxSettings.taxCollector)
		end
		if settings.profitSettings.enabled then
			utils.distributeShares(
				msg,
				quantity,
				settings.profitSettings.profitRate,
				settings.profitSettings.collectors
			)
		end
		Records[undername] = {
			processId = underAntId,
			purchaseType = purchaseType,
			startTimestamp = tonumber(msg.Timestamp),
			-- endTimestamp is nil for buys, will need to add for leases
			purchasePrice = price,
			transactionId = "",
			ttlSeconds = "",
		}
		-- subscribe to under ant records changes
		ao.send(utils.notices.addForwardedTags(msg, {
			Target = underAntId,
			Action = "Add-Subscriber",
			["Subscriber"] = ao.id,
			Data = json.encode({ "Records" }),
		}))
	end)

	createActionHandler(purchasing.ActionMap.GetPriceForAction, function(msg)
		local actionData = json.decode(msg.Data)

		local tokenId = actionData.tokenId
		local action = actionData.action
		local undername = actionData.undername
		local purchaseType = actionData.purchaseType

		if action == purchasing.ActionMap.BuyRecord and purchaseTypes[purchaseType] then
			local price = utils.getPurchasePrice({
				tokenId = tokenId,
				undername = undername,
				purchaseType = purchaseType,
				settings = utils.mergeSettings(
					PriceSettings.defaults,
					PriceSettings.whiteListedTokens[tokenId].overrides
				),
			})

			ao.send(utils.notices.addForwardedTags(msg, {
				Target = msg.From,
				Action = "Price-For-Action-Notice",
				Data = price,
			}))
		else
			error("Invalid action: " .. action)
		end
	end)

	createActionHandler(purchasing.ActionMap.InfoNotice, function(msg)
		local token = msg.From
		assert(PriceSettings.whiteListedTokens[token], "Token not added to whitelist")
		PriceSettings.whiteListedTokens[token].info = {
			Name = msg.Tags["Name"] or "",
			Ticker = msg.Tags["Ticker"] or "",
			Logo = msg.Tags["Logo"] or "",
			Denomination = msg.Tags["Denomination"] or "",
		}
	end)

	createActionHandler(purchasing.ActionMap.Publish, function(msg)
		local underAntId = msg.From
		-- if topic not records, remove subscription and error out

		if msg.Topic ~= "Records" then
			ao.send(utils.notices.addForwardedTags(msg, {
				Target = underAntId,
				Action = "Remove-Subscriber",
				Subscriber = ao.id,
				-- if a topic was provided remove just that topic, else remove all topics
				Data = msg.Topic and json.encode({ msg.Topic }) or msg.Topic,
			}))
			error("Only topic of Records can be published, removing topic: " .. msg.Topic)
		end
		local newRecords = json.decode(msg.Data)
		local newApexRecord = newRecords["@"]

		for domain, recordData in pairs(Records) do
			if recordData.processId and recordData.processId == underAntId then
				Records[domain].transactionId = newApexRecord.transactionId or ""
				Records[domain].ttlSeconds = newApexRecord.ttlSeconds or constants.MIN_TTL_SECONDS
			end
		end

		-- if under ant is not a registered ant, send a message to remove this process as a subscriber
		local registeredUndernames = {}
		for domain, recordData in pairs(Records) do
			if recordData.processId and recordData.processId == underAntId then
				table.insert(registeredUndernames, domain)
			end
		end
		if #registeredUndernames == 0 then
			ao.send(utils.notices.addForwardedTags(msg, {
				Target = underAntId,
				Action = "Remove-Subscriber",
				Subscriber = ao.id,
				-- remove all topics that this process is subscribed to
			}))
		end
	end)
end

return purchasing
