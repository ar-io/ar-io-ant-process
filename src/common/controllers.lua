local utils = require(".utils")

local controllers = {}

--- Set a controller.
---@param controller string The controller to set.
---@param allowUnsafeAddresses AllowUnsafeAddresses
---@return string[]
function controllers.setController(controller, allowUnsafeAddresses)
	assert(utils.isValidAOAddress(controller, allowUnsafeAddresses), "Invalid AO Address")

	for _, c in ipairs(Controllers) do
		assert(c ~= controller, "Controller already exists")
	end

	table.insert(Controllers, controller)
	return Controllers
end

--- Remove a controller.
---@param controller string The controller to remove.
---@return string[]
function controllers.removeController(controller)
	assert(type(controller) == "string", "Controller must be a string")
	local controllerExists = false

	for i, v in ipairs(Controllers) do
		if v == controller then
			table.remove(Controllers, i)
			controllerExists = true
			break
		end
	end

	assert(controllerExists ~= false, "Controller does not exist")
	return Controllers
end

--- Get all controllers.
---@return string[]
function controllers.getControllers()
	return Controllers
end

return controllers
