local constants = {}

constants.MAX_UNDERNAME_LENGTH = 61
constants.UNDERNAME_DOES_NOT_EXIST_MESSAGE = "Name does not exist in the ANT!"
constants.INVALID_ARWEAVE_ID_MESSAGE = "Invalid Arweave ID"
constants.MIN_TTL_SECONDS = 60
constants.DEFAULT_TTL_SECONDS = 900
constants.MAX_TTL_SECONDS = 86400 -- 1 day in seconds
constants.DEFAULT_ANT_LOGO = "AnYvLJTWcG9lr2Ll5MwYWZR2o5uTE39WbpYB0zCxwKM"
constants.INVALID_TTL_MESSAGE = "Invalid TTL. TLL must be an integer between "
	.. constants.MIN_TTL_SECONDS
	.. " and "
	.. constants.MAX_TTL_SECONDS
	.. " seconds"

-- Shared metadata constants (used for both ANT and undername metadata)
constants.MAX_NAME_LENGTH = 61
constants.MAX_DESCRIPTION_LENGTH = 512
constants.MAX_KEYWORDS = 16
constants.MAX_KEYWORD_LENGTH = 32

return constants
