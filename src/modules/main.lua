local main = {}

function main.init()
	for _, module in ipairs({
		-- token must be inited first due to globals required from other modules
		require(".modules.token"),
		-- ant must go before purchasing due to Records global init
		require(".modules.ant"),
		require(".modules.purchasing"),
	}) do
		module.init()
	end
end

return main
