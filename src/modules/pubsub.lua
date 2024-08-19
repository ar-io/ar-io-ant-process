--[[
    Module: pubsub
    Description: Publish/Subscribe module

    This module is responsible for handling the publish/subscribe pattern. It
    allows processes to publish messages to subscribers of a topic, and other processes to
    subscribe to a topic. When a message is published to a topic, all
    subscribers of that topic will receive the message.

]]

local utils = require(".common.utils")
local createActionHandler = utils.createActionHandler
local json = require(".common.json")

local pubsub = {}

pubsub.ActionMap = {
	-- write: this process publishes a message subscribers of a topic
	Publish = "Publish",
	-- Public access-controlled api - can add self or another process as a subscriber (eg ant registry)
	AddSubscriber = "Add-Subscriber",
	RemoveSubscriber = "Remove-Subscriber",
	-- read
	GetTopics = "Get-Topics", -- list of available topics and their JSON schemas
	GetSubscribers = "Get-Subscribers",
	GetSubscriberTopics = "Get-Subscriber-Topics",
}

function pubsub.init()
	-- internal use
	SubscriberMap = SubscriberMap
		or {
			jaybobthesonofgod = {
				["State"] = true,
				["Records"] = true,
				["Controllers"] = true,
				["Name"] = true,
				["Purchasing"] = true,
				["Token"] = true,
			},
		}
	-- index by global state var (Records, Controllers, Name, etc), and notify if state changes
	-- for example the Ant Registry needs Owner and Controllers to be notified
	-- Subscribing to "TopicMap" will notify of all changes to the topic map
	TopicMap = {}

	createActionHandler(pubsub.ActionMap.AddSubscriber, function(msg)
		local subscriber = msg.Tags.Subscriber
		assert(subscriber, "Subscriber is required")
		local topics = json.decode(msg.Data)
		assert(type(topics) == "table", "Topics are required and must be an array")

		local availableTopics = {}
		for _, topic in ipairs(utils.keys(_G)) do
			availableTopics[topic] = true
			local hashStatus, hash = pcall(utils.hashGlobalProperty, topic)
			if hashStatus then
				TopicMap[topic] = TopicMap[topic] or { hash = hash, subscribers = {} }
			end
		end

		for _, topic in ipairs(topics) do
			if availableTopics[topic] then
				TopicMap[topic].subscribers[subscriber] = true
			end
		end

		SubscriberMap[subscriber] = SubscriberMap[subscriber] or {}
		for topic, _ in pairs(TopicMap) do
			if TopicMap[topic].subscribers[subscriber] then
				SubscriberMap[subscriber][topic] = true
			end
		end
		ao.send({ Target = msg.From, Action = "Add-Subscriber-Notice", Data = "Success" })
		-- Send notices for state of the topics the new subscriber subscribed to
		for _, topic in ipairs(topics) do
			-- TODO: add ability to send function data
			if not type(_G[topic]) == "function" then
				ao.send({
					Target = subscriber,
					Action = "Publish",
					Data = json.encode(_G[topic]),
				})
			end
		end
	end)

	createActionHandler(pubsub.ActionMap.RemoveSubscriber, function(msg)
		local subscriber = msg.Tags.Subscriber
		assert(subscriber, "Subscriber is required")
		local topicsStatus, topics = pcall(json.decode, msg.Data)
		-- if no topics are provided, remove the subscriber from all topics
		if not topicsStatus then
			topics = utils.keys(SubscriberMap[subscriber])
		end

		for _, topic in ipairs(topics) do
			if TopicMap[topic] then
				TopicMap[topic].subscribers[subscriber] = nil
				SubscriberMap[subscriber][topic] = nil
			end
		end
		-- if the subscriber has no more topics, remove them from the subscriber map
		if not next(SubscriberMap[subscriber]) then
			SubscriberMap[subscriber] = nil
		end
		ao.send({ Target = msg.From, Action = "Remove-Subscriber-Notice", Data = "Success" })
	end)

	createActionHandler(pubsub.ActionMap.GetTopics, function(msg)
		local topics = utils.keys(_G)
		-- update topic map with new global state variables
		for _, topic in ipairs(topics) do
			local hashStatus, hash = pcall(utils.hashGlobalProperty, topic)
			if hashStatus then
				TopicMap[topic] = TopicMap[topic] or { hash = hash, subscribers = {} }
			end
		end
		ao.send(utils.notices.addForwardedTags(msg, {
			Target = msg.From,
			Action = "Topics-Notice",
			Note = "List of available topics. Each topic is a global state variable in this process which you will be notified of if it changes.",
			Data = json.encode(topics),
		}))
	end)

	createActionHandler(pubsub.ActionMap.GetSubscribers, function(msg)
		ao.send(utils.notices.addForwardedTags(msg, {
			Target = msg.From,
			Action = "Subscribers-Notice",
			Data = json.encode(SubscriberMap),
		}))
	end)

	createActionHandler(pubsub.ActionMap.GetSubscriberTopics, function(msg)
		local subscriber = msg.Tags.Subscriber
		assert(subscriber, "Subscriber is required")
		assert(SubscriberMap[subscriber], "Subscriber not found")
		ao.send(utils.notices.addForwardedTags(msg, {
			Target = msg.From,
			Action = "Subscriber-Topics-Notice",
			Data = json.encode(utils.keys(SubscriberMap[subscriber])),
		}))
	end)

	Handlers.append(pubsub.ActionMap.Publish, function(msg)
		-- always run the publish handler
		-- -1 to break after this handler is called
		return -1
	end, function(msg)
		local globalStateHashes = utils.generateGlobalStateHashes()
		-- add new global state variables to the topic map
		for topic, topicHash in pairs(globalStateHashes) do
			TopicMap[topic] = TopicMap[topic] or { hash = topicHash, subscribers = {} }
		end
		-- notify subscribers of any changes in global state that they are subscribed to
		for topic, topicData in pairs(TopicMap) do
			if globalStateHashes[topic] ~= topicData.hash then
				for subscriber, _ in pairs(topicData.subscribers) do
					ao.send(utils.notices.addForwardedTags(msg, {
						Target = subscriber,
						Action = pubsub.ActionMap.Publish,
						Topic = topic,
						["Topic-Hash"] = globalStateHashes[topic],
						Data = json.encode(_G[topic]),
					}))
				end
			end
		end

		-- remove any topics not now in the global state
		for topic, _ in pairs(TopicMap) do
			if not globalStateHashes[topic] then
				TopicMap[topic] = nil
			end
		end
	end)
end

return pubsub
