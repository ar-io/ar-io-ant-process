--- The Process library provides an environment for managing and executing processes on the AO network. It includes capabilities for handling messages, spawning processes, and customizing the environment with programmable logic and handlers. Returns the process table.
-- @module process

-- @dependencies
Handlers = require(".modules.handlers")
ao = require(".modules.ao")
utils = require(".utils")
local coroutine = require("coroutine")
local json = require(".modules.json")
local assignment = require(".modules.assignment")

local ant = require(".main")

-- Implement assignable polyfills on _ao
assignment.init(ao)

--- The process table
-- @table process
-- @field _version The version number of the process
local process = { _version = "0.0.1" }

-- wrap ao.send for magic table
local aosend = ao.send

ao.send = function(msg)
	if msg.Data and type(msg.Data) == "table" then
		msg["Content-Type"] = "application/json"
		msg.Data = json.encode(msg.Data)
	end
	return aosend(msg)
end

--- Convert a message's tags to a table of key-value pairs
-- @function Tab
-- @tparam {table} msg The message containing tags
-- @treturn {table} A table with tag names as keys and their values
function Tab(msg)
	local inputs = {}
	for _, o in ipairs(msg.Tags) do
		if not inputs[o.name] then
			inputs[o.name] = o.value
		end
	end
	return inputs
end

--- Print a value, formatting tables and converting non-string types
-- @function print
-- @tparam {any} a The value to print
function print(a)
	if type(a) == "table" then
		a = json.encode(a)
	end

	if
		type(a) == "boolean"
		or type(a) == "nil"
		or type(a) == "number"
		or type(a) == "function"
		or type(a) == "thread"
	then
		a = tostring(a)
	end

	local data = a
	if ao.outbox.Output.data then
		data = ao.outbox.Output.data .. "\n" .. a
	end
	ao.outbox.Output = { data = data }

	-- Only supported for newer version of AOS
	if HANDLER_PRINT_LOGS then
		table.insert(HANDLER_PRINT_LOGS, a)
		return nil
	end

	return tostring(a)
end

--- Send a message to a target process
-- @function Send
-- @tparam {table} msg The message to send
function Send(msg)
	if not msg.Target then
		print("WARN: No target specified for message. Data will be stored, but no process will receive it.")
	end
	local result = ao.send(msg)
	return {
		output = "Message added to outbox",
		receive = result.receive,
		onReply = result.onReply,
	}
end

--- Main handler for processing incoming messages. It initializes the state, processes commands, and handles message evaluation and inbox management.
-- @function handle
-- @tparam {table} msg The message to handle
-- @tparam {table} _ The environment to handle the message in
function process.handle(msg, _)
	local env = nil
	if _.Process then
		env = _
	else
		env = _.env
	end

	ao.init(env)
	-- relocate custom tags to root message
	msg = ao.normalize(msg)
	-- set process id
	ao.id = ao.env.Process.Id

	HANDLER_PRINT_LOGS = {}

	-- set os.time to return msg.Timestamp
	os.time = function()
		return msg.Timestamp
	end

	-- tagify msg
	msg.TagArray = msg.Tags
	msg.Tags = Tab(msg)
	-- tagify Process
	ao.env.Process.TagArray = ao.env.Process.Tags
	ao.env.Process.Tags = Tab(ao.env.Process)
	-- magic table - if Content-Type == application/json - decode msg.Data to a Table
	if msg.Tags["Content-Type"] and msg.Tags["Content-Type"] == "application/json" then
		msg.Data = json.decode(msg.Data or "{}")
	end
	-- init Errors
	Errors = Errors or {}
	-- clear Outbox
	ao.clearOutbox()

	-- Only trust messages from a signed owner or an Authority
	if msg.From ~= msg.Owner and not ao.isTrusted(msg) then
		if msg.From ~= ao.id then
			Send({ Target = msg.From, Data = "Message is not trusted by this process!" })
		end
		print("Message is not trusted! From: " .. msg.From .. " - Owner: " .. msg.Owner)
		return ao.result({})
	end

	if ao.isAssignment(msg) and not ao.isAssignable(msg) then
		if msg.From ~= ao.id then
			Send({ Target = msg.From, Data = "Assignment is not trusted by this process!" })
		end
		print("Assignment is not trusted! From: " .. msg.From .. " - Owner: " .. msg.Owner)
		return ao.result({})
	end
	--- Mount the ANT handlers
	ant.init()

	Handlers.append("_default", function()
		return true
	end, function(m)
		m.reply({
			Action = "Default-Notice",
			Data = "No Handler found",
			Version = process._version,
		})
	end)

	-- call evaluate from handlers passing env
	msg.reply = function(replyMsg)
		replyMsg.Target = msg["Reply-To"] or (replyMsg.Target or msg.From)
		replyMsg["X-Reference"] = msg["X-Reference"] or msg.Reference
		replyMsg["X-Origin"] = msg["X-Origin"] or nil

		return ao.send(replyMsg)
	end

	msg.forward = function(target, forwardMsg)
		-- Clone the message and add forwardMsg tags
		local newMsg = ao.sanitize(msg)
		forwardMsg = forwardMsg or {}

		for k, v in pairs(forwardMsg) do
			newMsg[k] = v
		end

		-- Set forward-specific tags
		newMsg.Target = target
		newMsg["Reply-To"] = msg["Reply-To"] or msg.From
		newMsg["X-Reference"] = msg["X-Reference"] or msg.Reference
		newMsg["X-Origin"] = msg["X-Origin"] or msg.From
		-- clear functions
		newMsg.reply = nil
		newMsg.forward = nil

		ao.send(newMsg)
	end

	local co = coroutine.create(function()
		return pcall(Handlers.evaluate, msg, env)
	end)
	local _, status, result = coroutine.resume(co)

	-- Make sure we have a reference to the coroutine if it will wake up.
	-- Simultaneously, prune any dead coroutines so that they can be
	-- freed by the garbage collector.
	table.insert(Handlers.coroutines, co)
	for i, x in ipairs(Handlers.coroutines) do
		if coroutine.status(x) == "dead" then
			table.remove(Handlers.coroutines, i)
		end
	end

	if not status then
		local printData = table.concat(HANDLER_PRINT_LOGS, "\n")
		return ao.result({
			Error = printData .. "\n" .. result,
			Messages = {},
			Spawns = {},
			Assignments = {},
		})
	end

	if msg.Tags.Type == "Process" and Owner == msg.From then
		local response = ao.result({
			Output = {
				data = table.concat(HANDLER_PRINT_LOGS, "\n"),
				prompt = Prompt(),
				print = true,
			},
		})
		HANDLER_PRINT_LOGS = {} -- clear logs
		return response
	else
		local response =
			ao.result({ Output = { data = table.concat(HANDLER_PRINT_LOGS, "\n"), prompt = Prompt(), print = true } })
		HANDLER_PRINT_LOGS = {} -- clear logs
		return response
	end
end

return process
