NOTE: This is originally from: https://lakai.sourceforge.net/docs/s2000_sysex.html

S2000/S3000XL/S3200XL MIDI System Exclusive Extensions
======================================================

This family of samplers comprises three models:

*   S2000
*   S3000XL
*   S3200XL

The modes (as represented by the Mode buttons) have been redefined and there are now eleven modes available from the eight mode keys.

The disk pages have been separated into two separate LOAD and SAVE modes. A new GLOBAL mode contains MIDI and other system parameters (such as SCSI assignments, tuning/level, format utilities etc).

An EDIT key can operate in association with the remaining four modes (SINGLE, MULTI, SAMPLE and EFFECTS), to provide EDIT SINGLE, EDIT MULTI, EDIT SAMPLE and EDIT EFFECTS modes.

Much of the S3000 SysEx system will be valid for the S2000. Additional commands will be provided to reflect the new functions.

* * *

Multi Mode
----------

This is a major change over the S3000 family, intended to help with multi-timbral operation. Sixteen multi parts are provided. Each part contains a parameter to point to a convention "program" and another parameter to associate this part with a MIDI channel. By default, multi part 1 is associated with MIDI channel 1, part 2 with channel 2 etc., but this need not be the case. A multi part contains a number of other parameters (PRIORT, PLAYLO, PLAYHI, OUTPUT, STEREO, PANPOS, VOSCL, TRANSPOSE) similar to those found in programs which override their corresponding parameters in the associated programs.

Multi parts numbers would be arbitrary if it were not for one point. Incoming MIDI program change commands can be used to assign programs to multi parts. In this case, the MIDI channel number specified by the MIDI program change command is used to specify a multi part number, irrespective of the MIDI channel associated with that part. To avoid confusion, it is advisable that programs in memory be assigned unique program numbers.

The previous operation of MIDI program change commands (as on S3000) is no longer valid.

0x41 REQUEST MULTI DATA  
0x42 MULTI DATA

**Request for Multi Bytes**  
0xF0 MIDI System Exclusive identifier  
0x47 Akai Manufacturer code  
cc MIDI Exclusive channel  
0x41 Operation code  
0x48 S1000 Model identity  
mm,mm Multi part number  
ss Selector (0=header, 1=multi part)  
oo,oo Byte offset into structure  
nn,nn Number of bytes of data  
0xF7 End of Exclusive message

**Receive Multi Bytes**  
0xF0 MIDI System Exclusive identifier  
0x47 Akai Manufacturer code  
cc MIDI Exclusive channel  
0x42 Operation code  
0x48 S1000 Model identity  
mm,mm Multi part number  
ss Selector (0=header, 1=multi part)  
oo,oo Byte offset into header  
nn,nn Number of bytes of data  
ln,hn First byte (nibbled)  
..,.. further data  
0xF7 End of Exclusive message

Structure of the Multi File
---------------------------

The MULTI file comprises two sections, the header and the multi parts. The type of data accessed by this command is determined by byte 7 of the message (the Selector). A value of 0 will access the header of the multi file. This header currently holds little useful information. A value of 1 will access data in individual multi parts. In this case bytes 5 and 6 indicate the multi part being referenced.  
Unlike some S3000 structures, it is not possible to obtain the whole multi file in one access. However, the whole header can be obtained in one operation, and all the data regarding the multi parts can be obtained in another.

**Accessing Multi File Header**  
0xF0 MIDI System Exclusive identifier  
0x47 Akai Manufacturer code  
cc MIDI Exclusive channel  
?? Operation code (request=0x41, data=0x42)  
0x48 S1000 Model identity  
0,0 Reserved  
0 Selector (0=header)  
oo,oo Byte offset into header  
nn,nn Number of bytes of data  
0xF7 End of Exclusive message

**Structure of Multi File Header**  
Parameter: Multiname  
Offset: 3 bytes  
Field size: 12 bytes  
Description: The filename of the multifile

Parameter: fx1  
Offset: 16 bytes  
Field size: 1 byte  
Description: The fx setup assigned to fx channel 1

Parameter: fx2  
Offset: 17 bytes  
Field size: 1 byte  
Description: The fx setup assigned to fx channel 2

Parameter: fx3  
Offset: 18 bytes  
Field size: 1 byte  
Description: The fx setup assigned to fx channel 3

Parameter: fx4  
Offset: 19 bytes  
Field size: 1 byte  
Description: The fx setup assigned to fx channel 4

Parameter: fxfilename  
Offset: 20 bytes  
Field size: 12 bytes  
Description: The filename of the associated fx file

**Accessing Multi Parts Data**  
0xF0 MIDI System Exclusive identifier  
0x47 Akai Manufacturer code  
cc MIDI Exclusive channel  
?? Operation code (request=0x41, data=0x42)  
0x48 S1000 Model identity  
mm,mm Multi part number  
1 Selector (1=multi part)  
0,0 Reserved  
nn,nn Number of bytes of data  
0xF7 End of Exclusive message

**Structure of Multi Parts**  
Parameter: PRNAME  
Offset: 3 bytes  
Field size: 12 bytes  
Range: String of characters (read-only)  
Description: Name of program used for this multi part. To assign programs to multi parts it is better to use MIDI program change commands, specifying the program number of the desired program.

Parameter: PMCHAN  
Offset: 16 bytes  
Field size: 1 byte  
Range: 255 signifies OMNI, 0 to 15 indicate MIDI channel  
Description: MIDI channel. MIDI messages arriving on this specified channel will be responded to by this part, irrespective of the part number.

Parameter: PRIORT  
Offset: 18 bytes  
Field size: 1 byte  
Range: 0=low 1=norm 2=high 3=hold  
Description: Priority of voices playing this part.

Parameter: PLAYLO  
Offset: 19 bytes  
Field size: 1 byte  
Range: 21 to 127 represents A1 to G8.  
Description: Lower limit of play range.

Parameter: PLAYHI  
Offset: 20 bytes  
Field size: 1 byte  
Range: 21 to 127 represents A1 to G8  
Description: Upper limit of play range.

Parameter: OUTPUT  
Offset: 22 bytes  
Field size: 1 byte  
Range:  
Description: Individual output routing.

Parameter: STEREO  
Offset: 23 bytes  
Field size: 1 byte  
Range: 0 to 99  
Description: Left and right output levels.

Parameter: PANPOS  
Offset: 24 bytes  
Field size: 1 byte  
Range: -50 to +50  
Description: Balance between left and right outputs.

Parameter: VOSCL  
Offset: 70 bytes  
Field size: 1 byte  
Range: 0 to 99  
Description: Level sent to individual outputs.

Parameter: TRANSPOSE  
Offset: 75 bytes  
Field size: 1 byte  
Range: -50 to +50 semitones  
Description: Shift pitch of incoming MIDI.

Parameter: PFXCHAN  
Offset: 113 bytes  
Field size: 1 byte  
Range: 0 to 4  
Description: Effects Bus Select:  
0 = off  
1 = FX1  
2 = FX2  
3 = RV3  
4 = RV4

Parameter: PFXSLEV  
Offset: 114 bytes  
Field size: 1 byte  
Range: 0 to 99  
Description: Effects Send level

Parameter: PTUNOCM  
Offset: 115 bytes  
Field size: 1 byte  
Range: -50 to +50  
Description: Tune Offset Cents used in MULTI-mode only

Frank Neumann, January 26th, 2002