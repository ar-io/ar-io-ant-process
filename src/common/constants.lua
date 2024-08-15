local constants = {}

constants.MAX_UNDERNAME_LENGTH = 61
constants.UNDERNAME_DOES_NOT_EXIST_MESSAGE = "Name does not exist in the ANT!"
constants.UNDERNAME_REGEXP = "^(?:@|[a-zA-Z0-9][a-zA-Z0-9-_]{0,"
	.. (constants.MAX_UNDERNAME_LENGTH - 2)
	.. "}[a-zA-Z0-9])$"
constants.ARWEAVE_ID_REGEXP = "^[a-zA-Z0-9-_]{43}$"
constants.INVALID_ARWEAVE_ID_MESSAGE = "Invalid Arweave ID"
constants.MIN_TTL_SECONDS = 900
constants.MAX_TTL_SECONDS = 3600
constants.INVALID_TTL_MESSAGE = "Invalid TTL. TLL must be an integer between "
	.. constants.MIN_TTL_SECONDS
	.. " and "
	.. constants.MAX_TTL_SECONDS
	.. " seconds"
constants.purchaseTypes = {
	buy = "buy",
	lease = "lease",
	auctionBuy = "auctionBuy",
	auctionLease = "auctionLease",
}
constants.auctionTypes = {
	dutch = "dutch",
	english = "english",
}
constants.times = {}
-- seconds
constants.times.MINUTE_IN_SECONDS = 60
constants.times.HOUR_IN_SECONDS = 60 * 60
constants.times.DAY_IN_SECONDS = 60 * 60 * 24
constants.times.WEEK_IN_SECONDS = 60 * 60 * 24 * 7
constants.times.MONTH_IN_SECONDS = 60 * 60 * 24 * 30
constants.times.YEAR_IN_SECONDS = 31536000
-- milliseconds
constants.times.SECOND_IN_MS = 1000
constants.times.MINUTE_IN_MS = 60 * 1000
constants.times.HOUR_IN_MS = 60 * 60 * 1000
constants.times.DAY_IN_MS = 60 * 60 * 24 * 1000
constants.times.WEEK_IN_MS = 60 * 60 * 24 * 7 * 1000
constants.times.MONTH_IN_MS = 60 * 60 * 24 * 30 * 1000
constants.times.YEAR_IN_MS = 31536000 * 1000

constants.profitSharing = {}
constants.profitSharing.collectorPresets = {
	Owner = "Owner",
	Controllers = "Controllers",
	BalanceHolders = "BalanceHolders",
	UndernameHolders = "UndernameHolders", -- the under ANTs that are registered to undernames in the ANT
	all = "all", -- all of the above
}
constants.purchasing = {}
constants.purchasing.defaults = {

	apexRecord = {
		price = 100,
		purchaseTypes = { [constants.purchaseTypes.auctionLease] = true },
	},
	undername = {
		price = 1,
		lengthFactor = 1, -- nameLength * (price * tokenRate) * lengthFactor * taxRate = price
		allowedNamesRegex = "^[a-zA-Z0-9-]{8,42}$", -- any undername between 8 and 42 characters long
		purchaseTypes = { [constants.purchaseTypes.buy] = true, [constants.purchaseTypes.lease] = true },
	},
	profitSettings = {
		enabled = true, -- enable or disable profit sharing
		profitRate = 1, -- 100% of the price from sales after tax
		collectors = constants.profitSharing.collectorPresets.Owner, -- who gets the profit
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
}

return constants
