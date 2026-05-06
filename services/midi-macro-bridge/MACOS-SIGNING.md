# macOS Signing & Notarization Credentials

For signing and notarizing a `.app` + `.dmg` for distribution outside the App Store.

## What you need

Four things:

1. **Developer ID Application certificate** — in your login keychain
2. **Apple ID** — the email for your developer account
3. **App-specific password** — generated at [account.apple.com](https://account.apple.com)
4. **Team ID** — 10-char string, appears in parens in the cert name

## Check the certificate

```bash
security find-identity -v -p codesigning
```

Look for: `Developer ID Application: Your Name (TEAMID)`

If missing or expired: developer.apple.com → Certificates → "+" → **Developer ID Application** (not "Apple Development" or "Apple Distribution"). Generate a CSR via Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority. Upload, download the `.cer`, double-click to install.

## Generate the app-specific password

[account.apple.com](https://account.apple.com) → Sign-In and Security → App-Specific Passwords → Generate.

Format: `xxxx-xxxx-xxxx-xxxx`. Apple shows it once. If lost, just revoke and regenerate.

## Verify all four work together

```bash
xcrun notarytool store-credentials "profile-name" \
  --apple-id "you@example.com" \
  --team-id "TEAMID" \
  --password "xxxx-xxxx-xxxx-xxxx"
```

Success means everything is consistent. The profile name is just a keychain label you can reference later as `--keychain-profile "profile-name"`.

Delete a profile:

```bash
xcrun notarytool delete-credentials "profile-name"
```

## Plug into release scripts

`release.config.sh` and `build-installer.sh` reference all four values directly. Drop them in and run the pipeline.

## Note for future-you

This uses the older Apple ID + app-specific password auth. The newer flow uses an App Store Connect API key (`.p8` file + Issuer ID + Key ID). Both work; password flow is simpler for local builds, API key flow is better for CI. Apple has been nudging toward API keys but hasn't deprecated passwords.
