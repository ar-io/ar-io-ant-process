- split specs into modules for easier maintenance
- implemented createActionHandler
- created the `purchasing` module
- defined defaults and data structure for purchasing settings
- added appended eval handler to notify ANT registry on eval finish in case global vars were manually updated
- added buy record handler
- added utils to refund tokens, distribute shares, tax purchases, parse buy record
- added `pubsub` module to listen to under_ants `Records` changes
  - this actually extends the ANT capabilities quite a bit since now
    anyone can subscribe to ANT state changes
- updated setRecord and removeRecord to respect purchased undernames
- Added price for action handler

  TODO:
  <!-- if there is time... -->

- Add bidding for dutch and english auctions
- Add a `tick` handler
