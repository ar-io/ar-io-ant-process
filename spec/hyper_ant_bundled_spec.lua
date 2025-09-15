-- spec/hyper_ant_bundled_spec.lua

describe("Hyper ANT Bundled", function()
	it("should execute the hyper-ant-bundled.lua file without errors", function()
		-- Mock required globals that the hyper-ant bundle expects
		_G.id = "test-process-id"
		_G.owner = "test-owner-address"
		_G.send = function()
			return true
		end
		_G.process = { ["ant-registry-id"] = "test-registry-id" }

		-- Execute the bundled file
		local success, result = pcall(dofile, "dist/hyper-ant-bundled.lua")

		assert.is_true(success, "hyper-ant-bundled.lua should execute without errors: " .. tostring(result))
	end)
end)
