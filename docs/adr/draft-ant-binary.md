# Immutable code + Reassign ArNS as a solution for versioning ANTs

- Status: draft
- Approvers:
- Date: [2024-12-10]
- Authors: Atticus

## Context and Problem Statement

For our ANT processes we current us AOS - an implementation of a lua repl in
lua - to manage the methods in user ANT processes thru the `eval` method to
update and modify code.

When it comes to version this mutable process, we run into the issue of not
being able to trust the version of things in the process - unknown code can be
run on the process, even accidentally, or deliberately with unknown side
effects.

This means for versioning we need to dryrun the API's to test what the API's
actually do when a non-breaking change happens - this is quite a lot of work
when it comes to understanding where in the versioning timeline an ANT stands
and it increases code complexity and maintenance for clients.

Ideally we have a version number to operate off of to decide on upgrades.

## Decision Drivers

We need a way to upgrade ANT's that not just updates the code but also is easy
to understand what the capabilities are - versioning is the best way to do that
since we can know what each version does. There are other benefits to compiling
a ANT module as well.

- Updates the ANT source code
- Accurately able to version the APIs

## Considered Options

- Continue using `eval` to update code and dry run each api to evaluate of the
  inputs were accepted and outputs are valid
- Add a handler that accepts messages to run (dry run only and owner-only) then
  validating each input/output
  - Similar to the above but would allow one call with results on each api -
    essentially this is a batch eval method that would reset ANT state on each
    message it runs.
- Compile Custom ANT WASM Binary and spawn a new ANT, port over the current
  ANT's state, then call Reassign-Name to transfer the connected arns name(s) to
  the new ANT.
  - note we can have a tag on the new ANT to indicate which ANT it was
    previously.

## Decision Outcome

<!-- TODO: fill out decision outcome after discussion -->

The proposed outcome here is to use a custom WASM module we compile specifically
for ANTs instead of using AOS and compiling lua code, with the following
workflow:

1. Spawn New ANT with an initial ANT state
   - This is only concerned with ANT, since no custom code would be run.
2. Reassign the ArNS Names(s) to the new ANT id.

### Positive Consequences

- Code is immutable and we do not need to worry about unknown code running on
  the ANT.
- Because the code is immutable we can accurately version it - the first version
  assigned will be its version forever.
- More control over dependencies (like aos) so we have a proper understanding of
  the version of code we do not control.
  - Context: AOS is our current binary we use and the code is COMPILED lua,
    rather than eval'd lua. Due to how AOS updates (also thru the use of eval)
    this further confused the abilities, since we not only have to worry about
    our ANT version, but AOS version as well.
- We can leverage the `boot` method to initialize state and have the ANT
  register itself on the ANT registry
- When buying names the workflow goes from a 4-5 step process (spawn, load lua,
  init state (optional), register the ant, register name) to a 2 step process
  (spawn ant, register name)
- Optimize the code further by compiling smaller memory footprints (since we
  have literal thousands of these processes, even small memory footprints add
  up)
  - Note we can already do this if we custom-compile AOS and not use existing
    versions, in fact most of these positive consequences could be achieved
    without custom ANT code and simple compiling custom AOS first. But if we
    were to do that we would need to have something like a git submodule, and
    manage both our module ID and Lua code id.

### Negative Consequences

- Puts the onus on us for understanding how the full build process and
  dependencies work (good and bad depending on perspective)
- Increases complexity of build time.
- Built code is opaque and requires more investigation to match versions with
  code (our code is on github and you would need to go look at the code instead
  there instead of in-place in the browser)

## Pros and Cons of the Options

[Compare the pros and cons of each considered option.]

### [option 1]

- `+` [pro 1]
- `+` [pro 2]
- `-` [con 1]
- `-` [con 2]

### [option 2]

- `+` [pro 1]
- `+` [pro 2]
- `-` [con 1]
- `-` [con 2]

### [option 3]

- `+` [pro 1]
- `+` [pro 2]
- `-` [con 1]
- `-` [con 2]

## Links

[Include any relevant links to documents, discussions, or other resources that
provide additional context or background information.]

- [link 1](url)
- [link 2](url)

## Related Decisions

[List any related ADRs or decisions that are connected to this one.]

- [ADR-1](1-example.md) - [Title of ADR-1]
- [ADR-2](2-example.md) - [Title of ADR-2]

## Notes

[Include any additional notes or comments that are relevant to the decision.]

---

[ADR Template]: https://adr.github.io/
