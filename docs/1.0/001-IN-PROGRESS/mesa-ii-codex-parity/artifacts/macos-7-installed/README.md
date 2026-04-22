# macos-7-installed

Extracted MESA I binaries from the user-supplied Mac OS 7 HFS image:

- original image: `/Users/orion/Downloads/macos-7-disk.hfv`
- workspace copy: `docs/1.0/001-IN-PROGRESS/mesa-ii-codex-parity/artifacts/macos-7-disk.hfv`

## Source Paths

These files were extracted with `hfsutils` from the installed MESA I tree under
`Applications:M.E.S.A ...`.

| Local File | HFS Source Path | Type/Creator |
|---|---|---|
| `mesa1-app` | `Applications:M.E.S.A ...:MESA` | `APPL/AK09` |
| `mesa1-sampler-editor.modu` | `Applications:M.E.S.A ...:MESA Pouch:Sampler Editor` | `MODU/AK09` |
| `mesa1-shared.shar` | `Applications:M.E.S.A ...:MESA Pouch:Shared` | `SHAR/AK09` |
| `mesa1-s3-hd-provider.modu` | `Applications:M.E.S.A ...:MESA Pouch:S3 HD Provider` | `MODU/AK09` |
| `mesa1-s2000.modu` | `Applications:M.E.S.A ...:MESA Pouch:S2000` | `MODU/AK09` |
| `mesa1-s3000-fx.modu` | `Applications:M.E.S.A ...:MESA Pouch:S3000 FX` | `MODU/AK09` |
| `mesa1-file-manager.modu` | `Applications:M.E.S.A ...:MESA Pouch:File Manager` | `MODU/AK09` |

## SHA-256

See [SHA256SUMS.txt](./SHA256SUMS.txt).

## Notes

This corpus is committed because the extracted binaries are small enough to live in the
repo and provide a stable historical comparison point for MESA II lineage analysis.
The raw disk image is intentionally not committed.
