package.path = "./src/?.lua;./src/common/?.lua;" .. package.path

_G.ao = {
	send = function(_)
		return true
	end,
	id = "test",
}

_G.Handlers = {
	utils = {
		reply = function()
			return true
		end,
	},
}

print("Setup global ao mocks successfully...")
