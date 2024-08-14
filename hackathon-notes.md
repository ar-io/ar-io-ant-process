- split specs into modules for easier maintenance
- implemented createActionHandler
- created the `purchasing` module
- defined defaults and data structure for purchasing settings
- added appended eval handler to notify ANT registry on eval finish in case global vars were manually updated
- added buy record handler
- added utils to refund tokens, distribute shares, tax purchases, parse buy record

TODO:

- Add settings for under_ants to update on setRecord and removeRecord
  - this should allow setting of multiple subscribed ANTs... maybe good chance to implement the pub/sub spec
- Add bidding for dutch and english auctions
- Add price for action handler
- Update permissions on setting records that have been registered with tokens
- Add a `tick` handler
