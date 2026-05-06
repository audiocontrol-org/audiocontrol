# macOS quarantine workaround

Releases of `midi-macro-bridge` are not (yet) signed and notarized with an
Apple Developer ID. macOS Gatekeeper applies the `com.apple.quarantine`
attribute to anything downloaded via a browser, blocking unsigned binaries
with: "midi-macro-bridge cannot be opened because the developer cannot be
verified."

To run an unsigned release tarball:

    xattr -d com.apple.quarantine /usr/local/bin/midi-macro-bridge

Or right-click the binary in Finder → Open → Open anyway.

If you installed via Homebrew, the formula's bottle install path bypasses
quarantine on most setups; if you still hit Gatekeeper, run the same
`xattr -d` command against the Cellar binary path that `which midi-macro-bridge`
prints.

Notarization is on the roadmap but deferred until v1.x. Track via the
`midi-macro-bridge-packaging` workplan.
