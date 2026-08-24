---
name: gate
description: Turn a task into a gated implementation prompt with explicit PASS/FAIL checks, verified numbers, and stop conditions. Use before starting any non-trivial change to Trim.
argument-hint: [what you want built]
---

Turn the following task into a gated implementation prompt for this repo.

**Task:** $ARGUMENTS

Produce a prompt with this structure, and nothing else:

## 1. Hard constraints
- Never print `MONGODB_URI`, JWT secrets, or API key values — names and character counts only
- Never commit `.env` — every gate with `git status` must confirm it is absent
- Never add `expires` or a TTL index — this repo lost 18 user accounts to one
- List exactly which files may be touched. Nothing else may be modified.

## 2. GATE 0 — baseline, before any change
Capture, with output saved to a file for later comparison:
- test pass count
- test fail count
- **the name of every failing test**
- **the failure message of every failing test** (strip ANSI codes first)

State plainly: the criterion at the end is *identical* counts, *identical* names, and
*identical* reasons. "All green" is never the criterion — a test failing for a new reason
is a regression hiding behind a matching name.

## 3. Read-first phase
List the specific files that must be read and the specific questions to answer about each,
before any code is written. End with: **report the answers and STOP for approval.**

Never let the implementer assume a field name, a route mount path, or how the user is read
from the request. Those have been wrong before in this repo.

## 4. Implementation, split into commits
Split so that a pure refactor is always its own commit, separate from behaviour changes.
After a pure refactor, the test numbers must be unchanged — that is what makes it verifiable.
State which commit is which.

## 5. Tests
For each test, state what it asserts and **what would have to break for it to fail**.
A test whose failure condition you cannot name is not a test.

If the behaviour has more than one layer of protection (application check plus a database
constraint, for example), require one mutation per layer with a predicted outcome for each —
disabling only the top layer should still pass, and that passing result is the proof the
lower layer is real.

## 6. Final gate
A checklist of tick-boxes. At least one must be a **concrete number you computed yourself**
and can state in advance — not "it should be higher." End with: any unticked box means
STOP, report, do not commit.

## 7. Commit message
Conventional-commits format, body listing what changed and why.

---

Write the prompt in Vietnamese. Be specific enough that it can be followed without asking
follow-up questions, but do not pad it.
