local notices = {}

--- @param oldMsg AoMessage
--- @param newMsg AoMessage
--- @description Add forwarded tags to the new message
--- @return AoMessage
function notices.addForwardedTags(oldMsg, newMsg)
	for tagName, tagValue in pairs(oldMsg) do
		-- Tags beginning with "X-" are forwarded
		if string.sub(tagName, 1, 2) == "X-" then
			newMsg[tagName] = tagValue
		end
	end
	return newMsg
end

--- @param msg AoMessage
--- @description Create a credit notice message
--- @return AoMessage
function notices.credit(msg)
	return notices.addForwardedTags(msg, {
		Target = msg.Recipient,
		Action = "Credit-Notice",
		Sender = msg.From,
		Quantity = tostring(1),
	})
end

--- @param msg AoMessage
--- @description Create a debit notice message
--- @return AoMessage
function notices.debit(msg)
	return notices.addForwardedTags(msg, {
		Target = msg.From,
		Action = "Debit-Notice",
		Recipient = msg.Recipient,
		Quantity = tostring(1),
	})
end

--- @param notices table<AoMessage>
function notices.sendNotices(notices)
	for _, notice in ipairs(notices) do
		ao.send(notice)
	end
end

--- @param msg AoMessage
--- @param target string
--- @description Notify the target of the current state
--- @return nil
function notices.notifyState(msg, target)
	if not target then
		print("No target specified for state notice")
		return
	end

	ao.send(notices.addForwardedTags(msg, {
		Target = target,
		Action = "State-Notice",
		Data = json.encode(utils.getState()),
	}))
end

return notices
