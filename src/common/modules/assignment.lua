--- The Assignment module provides functionality for handling assignments. Returns the Assignment table.
-- @module assignment

--- The Assignment module
-- @table Assignment
-- @field _version The version number of the assignment module
-- @field init The init function
local Assignment = { _version = "0.1.0" }
--- Given a pattern, a value, and a message, returns whether there is a pattern match.
-- @usage matchesPattern(pattern, value, msg)
-- @param pattern The pattern to match
-- @param value The value to check for in the pattern
-- @param msg The message to check for the pattern
-- @treturn {boolean} Whether there is a pattern match
local function matchesPattern(pattern, value, msg)
	-- If the key is not in the message, then it does not match
	if not pattern then
		return false
	end
	-- if the patternMatchSpec is a wildcard, then it always matches
	if pattern == "_" then
		return true
	end
	-- if the patternMatchSpec is a function, then it is executed on the tag value
	if type(pattern) == "function" then
		if pattern(value, msg) then
			return true
		else
			return false
		end
	end

	-- if the patternMatchSpec is a string, check it for special symbols (less `-` alone)
	-- and exact string match mode
	if type(pattern) == "string" then
		if string.match(pattern, "[%^%$%(%)%%%.%[%]%*%+%?]") then
			if string.match(value, pattern) then
				return true
			end
		else
			if value == pattern then
				return true
			end
		end
	end

	-- if the pattern is a table, recursively check if any of its sub-patterns match
	if type(pattern) == "table" then
		for _, subPattern in pairs(pattern) do
			if matchesPattern(subPattern, value, msg) then
				return true
			end
		end
	end

	return false
end

--- Given a message and a spec, returns whether there is a spec match.
-- @usage matchesSpec(msg, spec)
-- @param msg The message to check for the spec
-- @param spec The spec to check for in the message
-- @treturn {boolean} Whether there is a spec match
local function matchesSpec(msg, spec)
	if type(spec) == "function" then
		return spec(msg)
		-- If the spec is a table, step through every key/value pair in the pattern and check if the msg matches
		-- Supported pattern types:
		--   - Exact string match
		--   - Lua gmatch string
		--   - '_' (wildcard: Message has tag, but can be any value)
		--   - Function execution on the tag, optionally using the msg as the second argument
		--   - Table of patterns, where ANY of the sub-patterns matching the tag will result in a match
	end
	if type(spec) == "table" then
		for key, pattern in pairs(spec) do
			if not msg[key] then
				return false
			end
			if not matchesPattern(pattern, msg[key], msg) then
				return false
			end
		end
		return true
	end
	if type(spec) == "string" and msg.Action and msg.Action == spec then
		return true
	end
	return false
end

--- Implement assignable polyfills on ao.
-- Creates addAssignable, removeAssignable, isAssignment, and isAssignable fields on ao.
-- @function init
-- @tparam {table} ao The ao environment object
-- @see ao.addAssignable
-- @see ao.removeAssignable
-- @see ao.isAssignment
-- @see ao.isAssignable
function Assignment.init(ao)
	-- Find the index of an object in an array by a given property
	-- @lfunction findIndexByProp
	-- @tparam {table} array The array to search
	-- @tparam {string} prop The property to search by
	-- @tparam {any} value The value to search for
	-- @treturn {number|nil} The index of the object, or nil if not found
	local function findIndexByProp(array, prop, value)
		for index, object in ipairs(array) do
			if object[prop] == value then
				return index
			end
		end

		return nil
	end

	ao.assignables = ao.assignables or {}

	ao.addAssignable = ao.addAssignable
		or function(...)
			local name = nil
			local matchSpec = nil

			local idx = nil

			-- Initialize the parameters based on arguments
			if select("#", ...) == 1 then
				matchSpec = select(1, ...)
			else
				name = select(1, ...)
				matchSpec = select(2, ...)
				assert(type(name) == "string", "MatchSpec name MUST be a string")
			end

			if name then
				idx = findIndexByProp(ao.assignables, "name", name)
			end

			if idx ~= nil and idx > 0 then
				-- found update
				ao.assignables[idx].pattern = matchSpec
			else
				-- append the new assignable, including potentially nil name
				table.insert(ao.assignables, { pattern = matchSpec, name = name })
			end
		end

	ao.removeAssignable = ao.removeAssignable
		or function(name)
			local idx = nil

			if type(name) == "string" then
				idx = findIndexByProp(ao.assignables, "name", name)
			else
				assert(type(name) == "number", "index MUST be a number")
				idx = name
			end

			if idx == nil or idx <= 0 or idx > #ao.assignables then
				return
			end

			table.remove(ao.assignables, idx)
		end

	ao.isAssignment = ao.isAssignment or function(msg)
		return msg.Target ~= ao.id
	end

	ao.isAssignable = ao.isAssignable
		or function(msg)
			for _, assignable in pairs(ao.assignables) do
				if matchesSpec(msg, assignable.pattern) then
					return true
				end
			end

			-- If assignables is empty, the the above loop will noop,
			-- and this expression will execute.
			--
			-- In other words, all msgs are not assignable, by default.
			return false
		end
end

return Assignment
