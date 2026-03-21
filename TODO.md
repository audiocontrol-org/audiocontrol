# TODO

## Library

### Portable Library Module
The portable library module was supposed to be built as a portable
implementation of the library,qincluding for use in all of the web
editors for Roland, Akai, and other manufacturers' samplers. The
s550/s330 library was meant to serve as a model for how and what to
build in the portable library module. The portable library module
should be a superset of the functionality of the s550/s330 library
code--and, the s550/s330 library code should be replaceable with the
portable library module with no loss of functionality. The vendor- and
device-specific parts of the s550/s330 library should be configurable
plugins to the portable library module--that plugin mechanism should
allow for the modular addition of future vendor- and device-specific
library objects, terminology, and patterns.

### Consistent Edit Operations
There should be a well-understood and consistent set of edit
operations on library objects. Edit operations should follow a
well-defined pattern.

At the moment, the edit operations that require first-class workflows
that I know we should support are:
* Edit (trim, normalize, etc. See "Editing Samples" below)
* Loop
* Chop for generic samples
* Chop for drum kits
* Multi-sample, multi-layerl instruments (multiple samples mapped to discrete or
  cross-fading zones)
* 

Edit operations should not use modal dialogs. They are first-class
workflows that deserve a well-thought-out UX and supporting UI.

### Looping Samples

* Samples in the "common" area of the library should be loopable.
* Fix the loop editor--the splice-point detection and crossfade is pretty broken.


### Chopping Samples

* Samples in the "common" area of the library should be choppable
* The chopper needs to be general purpose by default, with the option to focus on 


### Editing Samples

For samples in the "common" area of the library, there should be a way
to edit those samples.

* Trim
* Normalize
* Apply effects chain (built-in effects to start, then AU/VST3/CLAP
  * Compressor
  * Limiter
  * Saturator
  * Filter
  
### Migration Between Devices
There should be a structured way to migrate library objects between
devices and between devices and common. This will require some
standards for library naming and object lifecycle as well as
device-to-device object transformations (e.g., conversion of Roland
Patch objects to Akai Program objects and vice-versa).

## Built-In Effects

Real-time and off-line effects chain processing (may require WASM for web-editor):
* Compressor
* Limiter
* Gate
* Expander
* Saturation
* Filters
* EQ
* ...



