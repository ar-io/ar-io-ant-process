# Reassign ANT to Evolve Implementation Kickoff on the ArNS Portal

- Status: Proposed
- Approvers: [Ariel], [Dylan], [Atticus], [Phil], [David]
- Date: [2025-01-30]
- Authors: [Atticus]

## Context and Problem Statement

Currently to evolve the ANT we use AOS `Eval` - this introduces the problem of
evaluating what the current version of the code is. If we maintain a variable in
the state of the process containing a version number, that tells us only what
that version number is. At any point the user - owner - of the ANT may `Eval`
new code into the process resulting in changes to the process that may not
reflect what we expect the version number we assigned to reflect. To overcome
this we dryrun interactions on APIs and analyze the results to see if the APIs
perform as expected - this is very inefficient as dry run calls to CU's are
expensive in networking client side, as well as for the CU.

With the ARIO process now supporting
[`Reassign-Name`](https://github.com/ar-io/ar-io-ant-process/pull/26) and recent
additions to add [`_boot`](https://github.com/ar-io/ar-io-ant-process/pull/57)
to fork the process state to a whole new ANT, we can assign that new ANT as the
registered ANT to the specified ArNS name in the registry, and using the module
ID of the process to identify process version and capabilities, and solely the
module ID.

## Decision Drivers

- Improve the performance of ANT loading client side.
- Ensure the upgrade process is more robust by using immutable module IDs.
- Reduce computational load on CU infra.
- Mitigate risks associated with reassigning ANT state and ARNS records.

## Considered Options

1. **Current Approach (Baseline)**
   - Multiple dry runs per ANT.
   - ETH compatibility checked via handler analysis.
   - Upgrade involves loading Lua code.
2. **Optimized Approach (Proposed Change)**
   - Use the module ID to evaluate process version.
   - Upgrade via spawning a new ANT and reassigning ARNS records.

## Decision Outcome

### Chosen Option: Optimized Approach

The optimized approach reduces computational overhead and improves caching for
better performance. It also shifts to a more robust upgrade mechanism using
immutable module IDs rather than version detection heuristics. We can do this
now that we compile and publish our own WASM binaries, rather than using an AOS
binary and loading our code into it.

### Positive Consequences

- **Performance Improvement:** Reducing dry runs significantly speeds up ANT
  loading.
- **Immutable Module Versioning:** Eliminates issues with heuristic version
  analysis.
- **Reduced CU Load:** Fewer computations per ANT.

### Negative Consequences

- **Complicates Memory Usage on ANT Registry:** More ANTs means more state in
  the ANT registry, which currently doesn't have a cleanup process.
- **Potential Integration Issues:** Existing integrations relying on fixed ANT
  IDs may break.
- **State Limitations:** Large ANT states (e.g., >2000 undernames) may fail to
  bootstrap on spawn, meaning we need to understand the limitations there and
  decide what amounts we wish to support.

## Pros and Cons of the Options

### Current Approach

- `+` Already implemented and functional.
- `+` Ensures ETH compatibility via handler checks.
- `-` Multiple dry runs increase computational cost.
- `-` Upgrade process relies on mutable version checks.

### Optimized Approach (Chosen)

- `+` 3x faster ANT loading.
- `+` Reduces CU consumption.
- `+` Enables robust versioning.
- `-` Introduces new risks related to state migration and memory management.

## Links

- [Ariel]: https://github.com/arielmelendez
- [David]: https://github.com/djwhitt
- [Dylan]: https://github.com/dtfiedler
- [Atticus]: https://github.com/atticusofsparta
- [Phil]: https://github.com/vilenarios

## Notes

- Further analysis is required for large ANT states.
  - Records
  - Controllers
- Consider preemptive PRs for integration updates.
  - for example permaweb deploy
- Implement observation tools to track stale ANTs in the ANT registry
  - Fastest solution is probably adding a `prune` handler to the ANT registry
    that consumes process IDs and removes them, then use a cron job in gh
    actions to pull the ArNS records and decide which ANT ids to prune
