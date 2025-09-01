#!/usr/bin/env zsh
export HERE=$(pwd)
export AKAITOOLS=$(cd ~/.akai-sampler/akaitools-1.5 && pwd)
export PERL5LIB=${AKAITOOLS}
export PATH=${PATH}:${AKAITOOLS}
export AKAI_DISK=${HERE}/test/data/s3000xl/akai.img