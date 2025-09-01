NOTE: This is originally from: https://lakai.sourceforge.net/docs/s1000_sysex.html

# S1000 MIDI Exclusive Communication

## General information about the S1000

The S1000 sampler is the successor to the S900 and bears some similarity
to it. Program, keygroup and sample header data is stored in blocks all
of the same size (about 150 bytes). There are about 480 blocks
available.

A program consists of one block containing common data and then one
block per keygroup, containing data unique to its key-span. Unlike the
S900, each keygroup has four velocity zones which behave rather like
four adjacent keygroups but in the velocity domain, each containing data
unique to its velocity range. Each velocity zone names one sample.

A sample consists of a header which uses one block and the sample data
itself which is stored in separate memory of minimum size 1 MB words and
max 4 MB words (other samplers in the family may have 16 MB words max).
Unlike the S900 the sample header contains information about several
loops and the looping point (of each loop) is independant of the end of
the sample. Sample data is presented in 16-bit straight binary form
(peak levels are 0 and FFFFh).

The S1000 has two sample inputs and can sample in stereo. At this stage
it appears that this has few consequences for an external editor as the
stereo concept ceases to exist once the sampling process has finished;
the stereo pair of sample can be treated as two separate samples.
However, there may be some internal stereo pair editing functions which
operate if the sample names have the last two characters of their names
as \"-L\" and \"-R\".

The S1000 is capable of running several programs simultaneously and this
operates on the basis of allowing more than one program to share the
same (MIDI) program number. MIDI play commands (note on/off, bend etc.)
operate on all resident programs which have the same program number as
the S1000\'s selected program number. The S1000 has 16
realtime-allocated internal voices which are assigned by program data to
one of 8 physical mono outputs and/or stereo outputs with left/right pan
control and a mono echo send.

The S1000 uses custom LSI devices to perform sample playback, envelope
control, channel routing etc. Only forward sample playback and looping
is possible. Resident samples can be \"resampled\" at a new equivalent
rate for retuning, the appropriate interpolation or decimation being
carried out at high speed by special hardware.

The user interface consists of a 240x64 graphic screen, two S900-like
rotary encoders and a similar set of function and numeric keys. In
addition, there are 8 \"soft\" function keys under the screen. Where
possible program and sample parameters are presented in logical groups
on the same page and graphic images are used to aid programming (e.g.
sample plots and ADSR graphs). There are about 35 screen \"pages\" in
all which could perhaps be reduced to about 8 pages on a full CRT.
Functions such as sample amplitude normalize, time reverse, cross-fade
looping, visual loop point matching and real-time parameter editing are
provided.

## The following MIDI Exclusive functions will be provided:

### 1) Standard MIDI Sample Dump

This conforms to the MIDI 1.0 Addendum Revision 3.3 and includes
retransmission of data packets with checksum errors. Any legal number of
sample data bits can be received (bit will be truncated or padded to 16
bits). The sample NUMBER is treated as follows:

On transmit, the number is simply that of the order in which the sample
is stored in the S1000 at the time.

On received, the sample is stored as the next in memory. It is given a
default name of \"MIDI nnnnn\" where nnnnn is the received number in
decimal form. If the named formed this way is the name of an existing
sample, that sample will be replaced by the new sample. Note that the
S1000 has only two possible sampling rates: 44100 and 22050 Hz. The
S1000 sample header created on receipt of a standard sample dump has a
tuning offset parameter which is adjusted to compensate for sampling
rates other than these. Note also that up to 63 (dummy) sample words may
be inserted at the beginning of the sample to conform with S1000
internal requirements.

### 2) Akai S1000/S1100 Exclusive messages

The first 5 bytes of all S1000 messages have the form:\
F0h Exclusive\
47h Akai\
cc Exclusive Channel (0-127)\
ff Function Code\
48h S1000\
Unless stated, groups of bytes in messages represent concatenated 7-bit
sections of a data word, LSB first.\

**The functions provided are:**

\> denotes from S1000, \< denotes to S1000\
ff mnem. direction\

 <table border=1>
<tr>
<td>ID</td> <td>Mnemonic</td> <td>Direction</td> <td>Description</td>
</tr>

<tr>
<td>00h</td> <td>RSTAT</td><td>&lt;</td><td>request S1000 status</td>
</tr>

<tr>
<td>01h</td> <td>STAT</td><td>&gt;</td><td>S1000 status report</td>
</tr>

<tr>
<td>02h</td><td>RPLIST</td><td>&gt;</td><td>request list of resident program names</td>
</tr>

<tr>
<td>03h</td><td>PLIST</td><td>&gt;</td><td>list of resident program names</td>
</tr>

<tr>
<td>04h</td><td>RSLIST</td><td>&lt;</td><td>request list of resident sample names</td>
</tr>

<tr>
<td>05h</td> <td>SLIST</td> <td>&gt;</td> <td>list of resident sample names</td>
</tr>

<tr>
<td>06h</td> <td>RPDATA</td> <td>&lt;</td> <td>request program common data</td>
</tr>

<tr>
<td>07h</td> <td>PDATA</td> <td>&lt;&gt;</td> <td>program common data</td>
</tr>

<tr>
<td>08h</td> <td>RKDATA</td> <td>&lt;</td> <td>request keygroup data</td>
</tr>

<tr>
<td>09h</td> <td>KDATA</td> <td>&lt;&gt;</td> <td>keygroup data</td>
</tr>

<tr>
<td>0Ah</td> <td>RSDATA</td> <td>&lt;</td> <td>request sample header data</td>
</tr>

<tr>
<td>0Bh</td> <td>SDATA</td> <td>&lt;&gt;</td> <td>sample header data</td>
</tr>

<tr>
<td>0Ch</td> <td>RSPACK</td> <td>&lt;</td> <td>request sample data packet(s)</td>
</tr>

<tr>
<td>0Dh</td> <td>ASPACK</td> <td>&lt;</td> <td>accept sample data packet(s)</td>
</tr>

<tr>
<td>0Eh</td> <td>RDDATA</td> <td>&lt;</td> <td>request drum settings</td>
</tr>

<tr>
<td>0Fh</td> <td>DDATA</td> <td>&lt;&gt;</td> <td>drum input settings</td>
</tr>

<tr>
<td>10h</td> <td>RMDATA</td> <td>&lt;</td> <td>request miscellaneous data</td>
</tr>

<tr>
<td>11h</td> <td>MDATA</td> <td>&lt;&gt;</td> <td>miscellaneous data</td>
</tr>

<tr>
<td>12h</td> <td>DELP</td> <td>&lt;</td> <td>delete program and its keygroup</td>
</tr>

<tr>
<td>13h</td> <td>DELK</td> <td>&lt;</td> <td>delete keygroup</td>
</tr>

<tr>
<td>14h</td> <td>DELS</td> <td>&lt;</td> <td>delete sample header and data</td>
</tr>

<tr>
<td>15h</td> <td>SETEX</td> <td>&lt;</td> <td>set S1000 exclusive channel</td>
</tr>

<tr>
<td>16h</td> <td>REPLY</td> <td>&gt;</td> <td>S1000 command reply (error or ok)</td>
</tr>

<tr>
<td>1Dh</td> <td>CASPACK</td> <td>&lt;</td> <td>corrected ASPACK</td>
</tr>
</table>

**Request S1000 Status**\
```
  F0,47,cc,RSTAT,48,F7\
```

**S1000 Status Report**\
```
  F0,47,cc,STAT,48,\
  vv,VV S1000 software version VV.vv\
  bb,bb maximum number of program, keygroup, sample header blocks\
  fb,fb number of blocks free\
  ww,ww,ww,ww maximum number of sample words\
  fw,fw,fw,fw number of words free\
  ec current exclusive channel setting\
  F7 eox\
```

**Request List of Resident Program Names**\
```
  F0,47,cc,RPLIST,48,F7\
```

**List of Resident Program Names**

```
  F0,47,cc,PLIST,48,\
  pp,pp number of resident programs\
  12 bytes program 1 name (in non-ascii form - see below)\
  12 bytes program 2 name\
  \... etc.\
  F7 eox\
```
**Request List of Resident Sample Names**
```
  F0,47,cc,RSLIST,48,F7
```

**List of Resident Sample Names**\
```
  F0,47,cc,SLIST,48,\
  ss,ss number of resident samples\
  12 bytes sample 1 name\
  12 bytes sample 2 name\
  \... etc.\
  F7 eox\
```

**Request Program Common Data**\
```
  F0,47,cc,RPDATA,48,\
  pp,pp program number\
  F7 eox\
```

If the program number is higher than the highest program in the S1000,
an error message will be given instead of data.\

**Program Common Data**\
```
  F0,47,cc,PDATA,48,\
  pp,pp program number\
  ln,hn first byte of data in low/high nibble form (see below)\
  ln,hn second byte\
  \... etc.\
  F7 eox\
```

This is a bidirectional message. In the case of transmitting to the
S1000, if the program number is above the highest existing program
number, a new program will be created (if sufficient blocks are free -
one for the program common block and one for each keygroup as specified
by the parameter GROUPS). The created program will have dummy keygroups
with unspecified data; the appropriate number of keygroup data messages
should be given immediately. If the program name in data is the same as
that of any existing program, that program will be deleted first. If the
program number is of an existing program, the existing data will be
replaced but the parameter GROUPS must be correct. This allows complete
freedom to change parameters - the use of a duplicate program name
should be avoided. If either error situation occurs, an error message
will be given, otherwise an OK message will be given.

**Request Keygroup Data**\
```
  F0,47,cc,RKDATA,48,\
  pp,pp program number\
  kk keygroup number\
  F7 eox\
```
If the keygroup number is higher than the highest keygroup in the
program, an error message will be given instead of data.

**Keygroup Data**\
```
F0,47,cc,KDATA,48,\
pp,pp program number\
kk keygroup number\
ln,hn first byte of data in low/high nibble form (see below)\
ln,hn second byte\
\... etc.\
F7 eox\
```

This is a bidirectional message. In the case of transmitting to the
S1000, if the keygroup number is above the highest existing keygroup
number, a new keygroup will be created if a block is free, otherwise the
existing keygroup will be replaced. The use of program number 255 is a
special case where the keygroup data will be installed in the program
previously created. This avoids the need to read the program list to
find out what number was allocated to that program. If there are no free
blocks for a new keygroup, an error message will be given.

**Request Sample Data Header**\
```
  F0,47,cc,RSDATA,48,
  ss,ss sample number\
  F7 eox\
```
If the sample number is higher than the highest sample in the S1000, an
error message will be given instead of data.

**Sample Header Data**\
```
  F0,47,SDATA,48,\
  ss,ss sample number\
  ln,hn first byte of data in low/high nibble form (see below)\
  ln,hn second byte\
  \... etc. F7 eox\
```

This is a bidirectional message. In the case of transmitting to the
S1000, if the sample number is above the highest existing sample number,
a new sample will be created (if a block is free and the sample length
specified in the header is not too great) and this should be followed by
the appropriate sample data packets. If the name in the data is the same
as that of an existing sample, it will be deleted first (preceeded by a
standard dump WAIT message). If the sample number is of an existing
sample, the existing data will be replaced but the sample length
parameter SLNGTH must be correct. This allows complete freedom to change
parameters - the use of a duplicate name should be avoided. If a new
sample cannot be created, an error message will be given, otherwise an
OK message will be given. On receipt of a sample header which creates a
new sample, the S1000 will behave as if it has received a standard MIDI
dump header and if standard MIDI dump is to be used, the data packets
should follow immediately. Alternatively, the data can be delivered
after an ACCEPT PACKETS command which gives greater flexibility.

**Request Sample Data Packet(s)**\
```
F0,47,cc,RSPACK,48,\
ss,ss sample number\
oo,oo,oo,oo address offset from start of sample\
nn,nn,nn,nn number of samples required\
ii interval between samples\
if interval function:\
0 = single sample\
1 = average\
2 = peak\
F7 eox\
```
If the sample number is higher than the highest sample in the S1000, an
error message will be given instead of data. Otherwise data packet
transmission will commence and continue as per standard MIDI dump. If
the interval number is greater than 1, the samples will be the function
of groups of that number of samples, according to the interval function.
The number of samples transmitted will be nn/ii.\

**Accept Sample Data Packet(s)**\
```
F0,47,cc,ASPACK,48,\
ss,ss sample number\
oo,oo,oo,oo address offset from start of sample\
nn,nn,nn,nn number of samples to be delivered\
F7 eox\
```
If the sample number is higher than the highest sample in the S1000, an
error message will be given. Otherwise a standard MIDI dump ACK message
will be given and data packet transmission can commence and continue as
per standard MIDI dump.

**Request Drum Input Data**\
```
F0,47,cc,RDDATA,48,F7
```

**Drum Input Data**\
```
F0,47,cc,DDATA,48,\
ln,hn first byte of data in low/high nibble form (see below)\
ln,hn second byte\
\... etc. F7 eox\
```
This is a bidirectional message.

**Request Miscellaneous Data**\
F0,47,cc,RMDATA,48,F7\

**Miscellaneous Data**\
F0,47,vv,MDATA,48,\
ln,hn first byte of data in low/high nibble form (see below)\
ln,hn second byte\
\... etc.\
F7 eox\
This is a bidirectional message.

**Delete Program and its Keygroups**\
F0,47,cc,DELP,48,\
pp,pp program number\
F7 eox\

**Delete Keygroup**\
F0,47,cc,DELK,48\
pp,pp program number\
kk keygroup number\
F7 eox\

**Delete Sample Header and Data**\
F0,47,cc,DELS,48,\
ss,ss sample number\
F7 eox\
If the argument in any of the delete commands exceeds the maximum, an
error message will be given.

**Set S1000 Exclusive Channel**\
F0,47,cc,SETX,48,F7\
The S1000 exclusive channel will be set to cc.\

**S1000 Command Reply**\
F0,47,cc,REPLY,48,\
mm reply message:\
0=ok\
1=error\
F7 eox\

The following are extracts from assembler files showing the data block
structures of program, keygroup, sample header, drum and miscellaneous
files.All bytes are transmitted in LOW-NIBBLE/HIGH-NIBBLE form. Note
that names (always 12 characters) in the S1000, including PLIST and
SLIST are **not** in ASCII form; they are coded thus:

  ------- -------------
  byte    ASCII equiv
  0-9     \"0\"-\"9\"
  10      \" \"
  11-36   \"A\"-\"Z\"
  37      \"#\"
  38      \"+\"
  39      \"-\"
  40      \".\"
  ------- -------------

Byte in name fields must be limited to this range.

**Program Common Header Block (PDATA)**\

    PRIDENT  DB 1         ;1=Program header block identifier
    KGRP1@   DW ?         ;1st keygroup block address (internal use)
    PRNAME   DB 12 DUP(?) ;Name
    PRGNUM   DB ?         ;MIDI program number (0-127)
    PMCHAN   DB ?         ;MIDI channel (0-15, FFh=OMNI)
    POLYPH   DB ?         ;Polyphony (1-16)
    PRIORT   DB ?         ;Priority (0=low 1=normal 2=high 3=hold)
    PLAYLO   DB ?         ;Play-range low (24-127 = C0-G8)
    PLAYHI   DB ?         ;Play-range high (24-127 = C0-G8)
    OSHIFT   DB ?         ;Play octave (keyboard) shift(+/-2)
    OUTPUT   DB ?         ;Output number (0-7,FFh=off)
    STEREO   DB ?         ;Left and right level (0-99)
    PANPOS   DB ?         ;Left/right balance (+/-50)
    PRLOUD   DB ?         ;Basic loudness (0-99)
    V_LOUD   DB ?         ;Velocity>Loudness (+/-50)
    K_LOUD   DB ?         ;Key>Loudness (+/-50)
    P_LOUD   DB ?         ;Pressure>Loudness (+/-50)
    PANRAT   DB ?         ;Pan LFO rate (0-99)
    PANDEP   DB ?         ;Pan depth (0-99)
    PANDEL   DB ?         ;Pan LFO delay (0-99)
    K_PANP   DB ?         ;Key>Pan position (+/-50)
    LFORAT   DB ?         ;LFO speed (0-99)
    LFODEP   DB ?         ;LFO fixed depth (0-99)
    LFODEL   DB ?         ;LFO delay (0-99)
    MWLDEP   DB ?         ;Modwheel>LFO depth (0-99)
    PRSDEP   DB ?         ;Pressure>LFO depth (0-99)
    VELDEP   DB ?         ;Velocity>LFO depth (0-99)
    B_PTCH   DB ?         ;Bendwheel>Pitch (0-12 semitones)
    P_PTCH   DB ?         ;Pressure>Pitch (+/-12 semitones)
    KXFADE   DB ?         ;Keygroup crossfade (0=off 1=on)
    GROUPS   DB ?         ;number of keygroups (1-99)
    TPNUM    DB ?         ;temporary program number (internal use)
    TEMPER   DB 12 DUP(?) ;Key temperament (+/25 cents) C,C#,D,D# etc
    ECHOUT   DB ?         ;Echo output level (0=off 1=on)
    MW_PAN   DB ?         ;Modwheel pan amount (+/-50)
    COHERE   DB ?         ;Sample start coherence (0=off 1=on)
    DESYNC   DB ?         ;LFO De-Sync (0=off 1=on)
    PLAW     DB ?         ;Pitch Law (0=linear)
    VASSOQ   DB ?         ;Voice assign algorithm (0=oldest 1=quietest)
    SPLOUD   DB ?         ;Soft pedal loudness reduction (0-99)
    SPATT    DB ?         ;Soft pedal attack stretch (0-99)
    SPFILT   DB ?         ;Soft pedal filter close (0-99)
    PTUNO    DW ?         ;Tune offset cent:semi (+/-50.00 fraction is binary)
    K_LRAT   DB ?         ;Key>LFO rate (+/-50)
    K_LDEP   DB ?         ;Key>LFO depth (+/-50)
    K_LDEL   DB ?         ;Key>LFO delay (+/-50)
    VOSCL    DB ?         ;Voice output scale (0=-6dB, 1=0dB, 2=+12dB)
    VSSCL    DB ?         ;Stereo output scale (0=0dB, 1=+6dB)

**Keygroup Block (KDATA)**\

    ;Keygroup common
    KGIDENT  DB 2         ;2=Keygroup block identifier
    NXTKG@   DW ?         ;Next keygroup block address (internal use)
    LONOTE   DB ?         ;Keyrange low (24-127 = C0-G8)
    HINOTE   DB ?         ;Keyrange high (24-127 = C0-G8)
    KGTUNO   DW ?         ;Tune offset cent:semi (+/-50.00 fraction is binary)
    FILFRQ   DB ?         ;Basic filter frequency (0-99)
    K_FREQ   DB ?         ;Key>Filter freq (+/-24 semitones/octave)
    V_FREQ   DB ?         ;Velocity>Filter freq (+/-50)
    P_FREQ   DB ?         ;Pressure>Filter freq (+/-50)
    E_FREQ   DB ?         ;Envelope>Filter freq (+/-50)
    ATTAK1   DB ?         ;Amplitude attack (0-99)
    DECAY1   DB ?         ;Amplitude decay (0-99)
    SUSTN1   DB ?         ;Amplitude sustain level (0-99)
    RELSE1   DB ?         ;Amplitude release (0-99)
    V_ATT1   DB ?         ;Velocity>Amp attack (+/-50)
    V_REL1   DB ?         ;Velocity>Amp release (+/-50)
    O_REL1   DB ?         ;Off Vel.>Amp release (+/-50)
    K_DAR1   DB ?         ;Key>Decay&Release (+/-50)
    ATTAK2   DB ?         ;Filter attack (0-99)
    DECAY2   DB ?         ;Filter decay (0-99)
    SUSTN2   DB ?         ;Filter sustain level (0-99)
    RELSE2   DB ?         ;Filter release (0-99)
    V_ATT2   DB ?         ;Velocity>Filter attack (+/-50)
    V_REL2   DB ?         ;Velocity>Filter release (+/-50)
    O_REL2   DB ?         ;Off Vel.>Filter relase (+/-50)
    K_DAR2   DB ?         ;Key>Decay&Release (+/-50)
    V_ENV2   DB ?         ;Velocity>Filter envelope output (+/-50)
    E_PTCH   DB ?         ;Envelope>Pitch (+/-50)
    VXFADE   DB ?         ;Velocity zone crossfade (0=off 1=on)
    VZONES   DB ?         ;Number of velocity zones in use (not used)
    LKXF     DB ?         ;Calculated left key crossfade factor (internal)
    RKXF     DB ?         ;Calculated right key crossfade factor (internal)

    ;Velocity zone 1
    SNAME    DB 12 DUP(@) ;Sample name
    LOVEL    DB ?         ;Velocity range low (0-127)
    HIVEL    DB ?         ;Velocity range high (0-127)
    VTUNO    DW ?         ;Tune offset (+/-50.00 fraction is in binary form)
    VLOUD    DB ?         ;Loudness offset (+/-50)
    VFREQ    DB ?         ;Filter frequency offset (+/-50)
    VPANO    DB ?         ;Pan offset (+/-50)
    ZPLAY    DB ?         ;Loop in release (0=as sample, 1-4 see below)
    LVXF     DB ?         ;Low velocity crossfade factor (internal use)
    HVXF     DB ?         ;High velocity crossfade factor (internal use)
    SBADD    DW ?         ;Calculated sample header block address (internal)

    ZBYTES   EQU $-SNAME  ;bytes per zone
    ;Velocity zones 2-4
    SNAME2   DB ZBYTES*3 DUP(?) ;identical to zone 1

    ;more keygroup common
    KBEAT    DB ?         ;Fixed rate detune (byte)
    AHOLD    DB ?         ;Attack hold until loop

    ;more velocity zone items
    CP1      DB ?
    CP2      DB ?
    CP3      DB ?
    CP4      DB ?         ;Constant pitch for each velocity zone (0=track 1=const)
    VZOUT1   DB ?
    VZOUT2   DB ?
    VZOUT3   DB ?
    VZOUT4   DB ?         ;Output number offset for each velocity zone (0-7)
    VSS1     DW ?
    VSS2     DW ?
    VSS3     DW ?
    VSS4     DW ?         ;Velocity>Sample start (+/-9999)

    ;more keygroup common
    KV_LO    DB ?         ;Velocity>Loudness offset (+/-50)

    ;ZPLAY:- type of sample playback, values:
    ;0 = as defined by sample header
    ;1 = normal looping
    ;2 = loop until release
    ;3 = no looping
    ;4 = play to sample end

**Sample Header Block (SDATA)**\

    SHIDENT  DB 3         ;3=sample header block identifier
    SBANDW   DB ?         ;Bandwidth (0=10kHz 1=20kHz)
    SPITCH   DB ?         ;Original pitch (24-127 = C0-G8)
    SHNAME   DB 12 DUP(?) ;Name (same position as program)
    SSRVLD   DB ?         ;Sample rate ssrate valid (80H=yes)
    SLOOPS   DB ?         ;Number of loops (internal use)
    SALOOP   DB ?         ;First active loop (internal use)
             DB ?         ;Spare byte
    SPTYPE   DB ?         ;Playback type (see below)
    STUNO    DW ?         ;Tune offset cent:semi (+/-50.00)
    SLOCAT   DW ?,?       ;Data absolute start address
    SLNGTH   DW ?,?       ;Data length (number of samples)
    SSTART   DW ?,?       ;Play relative start address
    SMPEND   DW ?,?       ;Play relative end address

    ;First loop
    LOOPAT   DW ?,?       ;Relative loop point (bits 0-5 are treated as 1)
    LLNGTH   DW ?,?,?     ;Loop length (binary) fraction:INT.LOW:INT.HIGH
    LDWELL   DW ?         ;Dwell time (0=no loop 1-9998=mSec 9999=hold)

    LBYTES   EQU $-LOOPAT ;Bytes per loop

    ;Loops 2-8
    LOOP2    DW LBYTES*7 DUP(0) ;same as Loop1

    ;more sample common
    SSPARE   DB ?,?       ;Spare bytes used internally
    SSPAIR   DW ?         ;Address of stereo partner (internal use)
    SSRATE   DW ?         ;Sample rate in Hz
    SHLTO    DB ?         ;Hold loop tune offset (+/-50 cents)

    ;Type of playback values:-
    ;0 = normal looping
    ;1 = Loop until release
    ;2 = No looping
    ;3 = Play to sample end

    ;Drum trigger unit block (data is for 2 units) (DDATA)
    ;Unit 1

    D1OPER   DB ?         ;Unit 1 in operation (0=off 1=on)
    D1EXCH   DB ?         ;Unit 1 exclusive channel (0-15)
    D1THRU   DB ?         ;Unit 1 MIDI thru enable (0=off 1=on)
    DRNAME   DB 12 DUP(?) ;Name in same place as programs/samples

    ;Input 1 of unit 1
    ; DU1TAB(?)
    DCHAN    DB ?         ;Drum MIDI channel (0-15)
    DNOTE    DB ?         ;Drum MIDI note (24-127 = C0-G8)
    DSENS    DB ?         ;Drum sensitivity (0-127)
    DTRIG    DB ?         ;Drum trigger threshold (0-127)
    DVCRV    DB ?         ;Drum velocity curve (0-7)
    DCATP    DB ?         ;Drum capture time (0-20mS)
    DRCVR    DB ?         ;Drum recovery time (0-20mS)
    DONTM    DW ?         ;Drum on-time (0-999mS)

    DRBYTES  EQU $-DU1TAB ;Bytes per input

    ;Input 2-8
             DB DRBYTES*7 DUP (?) ;same as input 1

    DUBYTES  EQU $-D1OPER ;bytes per unit

    ;Unit 2
             DB DUBYTES DUP(?)  ;same as unit 1

**Miscellaneous Data block (MDATA)**\

    BMCHAN   DB ?         ;Basic MIDI channel (0-15) for MIDI program select
    BMOMNI   DB ?         ;Basic channel Omni (0=off 1=on)
    PSELEN   DB ?         ;MIDI program select enable (0=off 1=on)
    SELPNM   DB ?         ;Selected program number (0-127)
    OMNOVR   DB ?         ;MIDI play commands Omni override (0=off 1=on)
    EXCHAN   DB ?         ;MIDI exclusive channel (0-127)

Frank Neumann, January 25th, 2002
