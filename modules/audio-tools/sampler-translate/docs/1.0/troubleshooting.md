## Troubleshooting

### FFmpeg Not Found

**Problem**: `Error: Cannot find ffmpeg`

**Solution**: Install FFmpeg on your system:
- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt-get install ffmpeg` or `sudo yum install ffmpeg`
- **Windows**: Download from https://ffmpeg.org/download.html

### Audio Format Conversion Fails

**Problem**: `Error translating audio format`

**Solution**:
- Ensure FFmpeg is installed and in PATH
- Check that input file is a valid audio format
- Verify sufficient disk space for conversion
- Check file permissions

### S3K Program Generation Fails

**Problem**: `Error: akaitools not available`

**Solution**:
- Ensure `@oletizi/sampler-devices` is properly installed
- Verify akaitools configuration
- Check that default program templates exist

### Filename Pattern Not Recognized

**Problem**: Samples not mapped correctly with `mapLogicAutoSampler`

**Solution**:
- Ensure filenames contain note pattern: `-[NOTE]-`
- Valid note formats: `C3`, `F#4`, `Bb2`, `G#5`
- Example: `Piano-C3-Soft.wav` ✅
- Invalid: `Piano_C3.wav` ❌ (underscore instead of hyphen)

### Sample Rate/Bit Depth Issues

**Problem**: Samples won't load on hardware

**Solution**:
- S3K/S5K/S6K require 44.1kHz or 48kHz sample rate
- Bit depth must be 16-bit or 24-bit
- Use sample conversion methods:
  ```typescript
  sample.to441().to16Bit()
  ```

### Memory Issues with Large Files

**Problem**: Out of memory error when processing large samples

**Solution**:
- Process samples in batches
- Use streaming where possible
- Increase Node.js heap size: `NODE_OPTIONS=--max-old-space-size=4096`

### Partition Number Invalid

**Problem**: `Error: Invalid partition number`

**Solution**:
- S3000: Partitions 1-8 (default: 1)
- S5000/S6000: Partitions 1-16 (typical: 1)
- Use partition 1 for most cases

## Contributing
