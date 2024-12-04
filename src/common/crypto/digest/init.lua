local SHA3 = require(".crypto.digest.sha3")

local digest = {
	_version = "0.0.1",
	keccak256 = SHA3.keccak256,
}

return digest
