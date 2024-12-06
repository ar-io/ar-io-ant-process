local utils = require(".common.utils")
local json = require(".common.json")
local validate = {}

---@param msg AoMessage AO messages to evaluate
---@param env table the AO env object
function validate.validateHandlers(msg, env)
	utils.validateOwner(msg.From)
	local messages = json.decode(msg.Data)

	local results = {}

	local stateBackup = json.decode(json.encode(utils.getState()))

	for name, message in pairs(messages) do
		local process = package.loaded[".process"]
		local _, res = pcall(process.handle, message, env)
		ao.clearOutbox()
		results[name] = { message = message, result = res }

		--- reset state
		for k, v in pairs(stateBackup) do
			_G[k] = v
		end
	end

	return results
end

return validate
