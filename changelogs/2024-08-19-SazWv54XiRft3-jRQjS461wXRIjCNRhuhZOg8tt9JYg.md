# Changelog

### Added

- Undername leasing
  - Added purchasing module
  - configurability for token settings (adding custom tokens and price variables)
- Added pubsub module
  - Allows for people to subscribe to state changes in an event-driven reactive manner.

### Changed

- Records cannot be set if they have been sold buy the purchasing module
- Handlers now "continue" to the next handler to allow the pubsub handler to always run to send state change notices to subscriber
- Info handler now responds with handler names as a property
