# Interactive Prompt Example Output

This document shows what users will see when the interactive prompts are displayed.

## Device Type Prompt

```
? What type of storage device is this? (Use arrow keys)
❯ Floppy Disk - Standard 3.5" floppy disk
  Hard Drive - Internal or external hard drive
  CD-ROM - CD-ROM or optical disc
  Other - Other storage device
```

User can navigate with arrow keys and press Enter to select.

## Sampler Selection Prompt (Existing Samplers)

```
? Select sampler for this backup source: (Use arrow keys)
  s5000
  s3000xl
❯ s1000
  ➕ Add new sampler...
```

User sees all existing samplers from config, plus option to add new.

## Sampler Selection Prompt (Add New)

If user selects "➕ Add new sampler...", they get:

```
? Enter a name for the new sampler: s6000
```

User types the sampler name. Validation ensures:
- Not empty
- Max 50 characters
- Only alphanumeric, hyphens, and underscores

## Complete Flow Example

```bash
$ audiotools backup /Volumes/SDCARD

? What type of storage device is this? Floppy Disk
? Select sampler for this backup source: s5000

✓ Backup source configured successfully!
  Source: /Volumes/SDCARD
  Device Type: floppy
  Sampler: s5000

Starting backup...
```

## Error Example (Invalid Input)

```
? Enter a name for the new sampler: my sampler!
✗ Sampler name can only contain letters, numbers, hyphens, and underscores

? Enter a name for the new sampler: my-sampler
✓ Created new sampler: my-sampler
```

## Cancellation Example (Ctrl+C)

```
? What type of storage device is this? ^C

✗ User cancelled the operation
```
