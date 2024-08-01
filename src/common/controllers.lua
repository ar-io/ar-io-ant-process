local json = require(".common.json")
local utils = require(".common.utils")

local controllers = {}

function controllers.setController(controller)
	assert(type(controller) == "string", "Controller must be a string")

	for _, c in ipairs(Controllers) do
		assert(c ~= controller, "Controller already exists")
	end

	table.insert(Controllers, controller)
	return json.encode(Controllers)
end

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

	assert(controllerExists ~= nil, "Controller does not exist")
	return json.encode(Controllers)
end

function controllers.getControllers()
	return json.encode(Controllers)
end

return controllers
