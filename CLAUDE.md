# Rubic Cube 2x2

This is an experimental project where we implement an application with AI assistance but instead of prompts, the
specification and the implementation hints are kept in version tracked files.

The idea is that we have a hierarchical set of specification files. The root of the hierarchy is the
main specification file `./main.spec.md`. The set of files can be read as a series of instructions on how
to write the source code of the entire application.

The hierarchy of the specification files describe a tree of nodes where each node describes an area of the
the application at a certain level of detail and it might refer to additional child specs which elaborate it
further. For the simple components a high-level description is sufficient for the AI to implement the component.
Other components might contain even a detailed, line-by-line pseudocode.

## Workflow

- The human writes or extends .spec.md files
- The human puts [TODO:AI] marks into the .spec.md file, where they need the AI to do some research, answer questions,
  write specification or plans.
- The human puts [IMPLEMENT:<dir>] or [IMPLEMENT:<file>] marks into the .spec.md file.
- The human asks the AI to complete the request described at an [TODO:AI] mark. If needed, the AI can clarify any open
  questions in the command line, then replace the [TODO:AI] mark with the answer (result of research, plan,
  specification).
- The human asks the AI to implement code for the [IMPLEMENT:...] marks. The [IMPLEMENT:..] marks will remain in place.
  Text after the [IMPLEMENT:] mark might contain details of the implementation, its progress, gotchas, bugs.

