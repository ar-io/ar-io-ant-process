---@alias AoMessage {
--- Id: string,
--- From: string,
--- Target: string,
--- Tags: table<string, string | number>,
--- Owner: string,
--- Data: string | number | nil,
--- [string]: string | number,
---}

---@alias Handler {
--- name: string,
--- pattern: function|table<string, string|nil>,
--- handle: function,
---}
---@alias HandlersList table<string, Handler>

---@alias Handlers {
--- list: HandlersList,
--- add: function,
--- before: function,
--- after: function,
--- remove: function,
--- prepend: function,
--- append: function,
--- evaluate: function,
---}

---@alias Record {
--- transactionId: string,
--- ttlSeconds: integer,
---}

---@alias AntState {
--- Name: string,
--- Ticker: string,
--- Description: string,
--- Keywords: string,
--- Logo: string,
--- Balances: table<string, integer>,
--- Owner: string,
--- Controllers: table<string>,
--- Denomination: integer,
--- TotalSupply: integer,
--- Initialized: boolean,
--- ["Source-Code-TX-ID"|SourceCodeTxId]: string,
--- Records: table<string, Record>,
---}