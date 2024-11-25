local utils = require(".common.utils")

local controllers = {}

--- Set a controller.
---@param controller string The controller to set.
---@return string[]
function controllers.setController(controller)
	utils.validateArweaveId(controller)

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
	utils.validateArweaveId(controller)
	local controllerExists = false

	for i, v in ipairs(Controllers) do
		if v == controller then
			table.remove(Controllers, i)
			controllerExists = true
			break
		end
	end

	assert(controllerExists ~= nil, "Controller does not exist")
	return Controllers
end

--- Get all controllers.
---@return string[]
function controllers.getControllers()
	return Controllers
end

return controllers
