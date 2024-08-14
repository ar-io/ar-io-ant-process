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
	PurchasingInfo = "Purchasing-Info",
	-- X- because this will come in as a credit notice and should have forwarded tags
	BuyRecord = "X-Buy-Record",
	BidUndername = "X-Bid-Undername",
	Publish = "Publish",
	-- read
	GetPriceSettings = "Get-Price-Settings",
	GetPriceForAction = "Get-Price-For-Action",
	InfoNotice = "Info-Notice",
}

function purchasing.init()
	Auctions = Auctions or {}
	PriceSettings = PriceSettings
		or {
			defaults = {
				apexRecord = {
					price = 100,
					purchaseTypes = { [purchaseTypes.auctionLease] = true },
				},
				undername = {
					price = 1,
					lengthFactor = 1, -- nameLength * (price * tokenRate) * lengthFactor * taxRate = price
					allowedNamesRegex = "^[a-zA-Z0-9-]{8,42}$", -- any undername between 8 and 42 characters long
					purchaseTypes = { [purchaseTypes.buy] = true, [purchaseTypes.lease] = true },
				},
				profitSettings = {
					enabled = true, -- enable or disable profit sharing
					profitRate = 1, -- 100% of the price from sales after tax
					collectors = constants.profitSharing.collectorPresets.owner, -- who gets the profit
				},
				taxSettings = {
					enabled = true, -- to tax or not to tax for this token
					taxRate = 0.05, -- this can be set to 1 (100%) to transfer all tokens to the taxCollector (eg process.Owner or another process or wallet)
					taxCollector = "agYcCFJtrMG6cqMuZfskIkFTGvUPddICmtQSBIoPdiA",
				},
				leaseSettings = {
					minLeaseTime = constants.times.YEAR_IN_MS, -- 1 year
					maxLeaseTime = constants.times.YEAR_IN_MS * 5, -- 5 years,
					increment = constants.times.YEAR_IN_MS, -- 1 year
					incrementRate = 0.10, -- 10% of the base price
				},
				buySettings = {
					rate = 10, -- 10x the base price
				},
				auctionSettings = {
					[constants.auctionTypes.dutch] = {
						floorRate = 0.1, -- 10% of the base price
						ceilingRate = 10, -- 10x the base price
						ceilingTime = constants.times.WEEK_IN_MS,
						interval = constants.times.HOUR_IN_MS * 2, -- price changes every 2 hours
					},
					[constants.auctionTypes.english] = {
						floorRate = 0.5, -- 50% of the base price
						ceilingRate = 10, -- 10x the base price, if reached accepts the bid and ends the auction
						ceilingTime = constants.times.WEEK_IN_MS, -- 1 week, if reached ends the auction and accepts the bid
					},
				},
			}, -- which tokens are allowed to be used for purchasing undernames
			whiteListedTokens = {
				["agYcCFJtrMG6cqMuZfskIkFTGvUPddICmtQSBIoPdiA"] = {
					info = {
						Name = "",
						Ticker = "",
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
		local newSettings = {}
		for settingName, tokenSettings in pairs(settings) do
			assert(PriceSettings.defaults[settingName], "Invalid setting name: " .. settingName)
			newSettings[settingName] = tokenSettings
		end
		PriceSettings.defaults = newSettings
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
		local overrides = settings.overrides or PriceSettings.whiteListedTokens[token].overrides

		local newOverrides = PriceSettings.whiteListedTokens[token].overrides
		for settingName, tokenSettings in pairs(overrides) do
			assert(PriceSettings.defaults[settingName], "Invalid setting name: " .. settingName)
			newOverrides[settingName] = tokenSettings
		end

		PriceSettings.whiteListedTokens[token].tokenRate = tokenRate
		PriceSettings.whiteListedTokens[token].overrides = newOverrides

		ao.send(utils.notices.addForwardedTags(msg, {
			Target = msg.From,
			Action = "Set-Token-Settings-Notice",
			Data = json.encode(PriceSettings.whiteListedTokens),
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
		local leaseDuration = buyRecordParams.leaseDuration
		local auctionType = buyRecordParams.auctionType
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
		if auctionType then
			Auctions[undername] = utils.createAuction({
				undername = undername,
				underAntId = underAntId,
				purchaseType = purchaseType,
				auctionType = auctionType,
				startTimestamp = msg.Timestamp,
				leaseDuration = leaseDuration,
				settings = settings,
				tokenSettings = PriceSettings.whiteListedTokens[msg.From],
			})
		else
			Records[undername] = {
				processId = underAntId,
				purchaseType = purchaseType,
				startTimestamp = msg.Timestamp,
				-- endTimestamp is nil for buys
				endTimestamp = leaseDuration and msg.Timestamp + leaseDuration or nil,
				purchasePrice = price,
				transactionId = "",
				ttlSeconds = "",
			}
			ao.send(utils.notices.addForwardedTags(msg, {
				Target = underAntId,
				Action = "State",
				["X-Undername"] = undername,
			}))
		end
	end)

	createActionHandler(purchasing.ActionMap.GetPriceForAction, function(msg)
		local actionData = json.decode(msg.Data)

		local tokenId = actionData.tokenId
		local action = actionData.action
		local undername = actionData.undername
		local leaseDuration = actionData.leaseDuration
		local purchaseType = actionData.purchaseType
		local auctionType = actionData.auctionType

		if action == purchasing.ActionMap.BuyRecord and purchaseTypes[purchaseType] then
			local price = utils.getPurchasePrice({
				tokenId = tokenId,
				undername = undername,
				purchaseType = purchaseType,
				leaseDuration = leaseDuration,
				auctionType = auctionType,
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
