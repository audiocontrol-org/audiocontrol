# Getting Started (for Claude Code)

This project is scaffolded with all source files in place. Your job
is to verify it builds, runs, and behaves correctly — not to write
it from scratch.

## Order of operations

1. **Read `CLAUDE.md` first.** It has the full project brief,
   including what NOT to build and why.

2. **Read `README.md`** for user-facing context.

3. **Verify the state machine first.**
   ```sh
   cargo test --package midi-macro-bridge --lib state
   ```
   All state machine tests must pass. If they don't, something is
   wrong with the core logic — fix before proceeding.

4. **Run the full test suite.**
   ```sh
   cargo test
   ```
   State, config, and MIDI parser tests should all pass. There are
   no integration tests — keystroke emission and MIDI I/O require
   hardware.

5. **Verify it builds.**
   ```sh
   cargo build --release
   ```

6. **Verify --list-ports works.**
   ```sh
   ./target/release/midi-macro-bridge --list-ports
   ```
   Should print available MIDI input port names (or nothing if no
   MIDI hardware is connected, which is fine).

7. **Set up config.**
   ```sh
   cp config.example.toml config.toml
   ```

8. **Hand off to the user** for hardware testing. They'll run
   `--self-test` with LUNA focused to validate the keystroke path,
   then connect the MC-500 and do real integration testing.

## Expected friction points

- **Accessibility permission.** First run on macOS will require the
  user to grant Accessibility permission to the binary. This cannot
  be automated. Surface the error clearly if enigo init fails.

- **Enigo version skew.** If `enigo = "0.2"` doesn't resolve to an
  API matching `src/keys.rs`, check crates.io for the actual current
  version and adjust. The API we use: `Enigo::new(&Settings::default())`,
  `enigo.key(Key::Space, Direction::Click)`.

- **midir version skew.** If midir 0.10's API doesn't match, similar
  story. The API we use: `MidiInput::new`, `.ports()`, `.port_name()`,
  `.connect(port, client_name, callback, data)`.

## Things to check if the user reports problems

- `RUST_LOG=debug ./target/release/midi-macro-bridge` — shows every
  received MIDI byte and every keystroke decision.
- `RUST_LOG=trace ...` — also shows individual keystroke emissions.
- Frontmost-app check failing: `osascript -e 'tell application "System Events" to return name of first application process whose frontmost is true'`
  should return "LUNA" when LUNA is focused.

## What not to change without asking

- The state machine logic in `state.rs`. It's been thought through
  carefully with echo-resilience in mind. Adding new transitions or
  removing no-ops will break the feedback-loop defense.
- The mpsc channel between midir callback and main loop. Moving
  keystroke emission onto midir's thread will work in testing and
  fail intermittently in production.
- The decision to discard SPP. There's no path to making it work.

## What's fine to change

- Minor dependency version bumps for compatibility.
- Log message wording.
- Additional config options that the user explicitly asks for.
- Platform-specific extensions (e.g., if user wants Windows support,
  add a cfg branch to `keys.rs`).
