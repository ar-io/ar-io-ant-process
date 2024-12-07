local util = require(".deps.crypto.util.init")
local digest = require(".deps.crypto.digest.init")

local crypto = {
	_version = "0.0.1",
	digest = digest,
	utils = util,
}

return crypto
