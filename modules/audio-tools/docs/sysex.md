
Note: originally from: https://troywoodfield.tripod.com/sysex.html

Introduction to Sysex
---------------------

#### By: Troy Woodfield

Introduction
------------

This article provides a beginners guide to Sysex. It is
written those of you who want a little help getting started.
We will look at Sysex (What is it? How does it work?). We will
also walk through a few practical examples.

This article will focus on the AKAI S2000 sampler and Cubase
VST sequencer v3.553. I chose this combination as I own this
hardware / software. If you use other combinations of Sampler
and Sequencer, you may still find this article useful.

To understand the sysex commands for an AKAI S2000 sampler, you
must read the sysex documentation for the AKAI S2000, S3000 and
the S1000 samplers. This information is freely available on the
AKAI site.


When I first read the sysex information on the AKAI site, I
began to convulse. The information is quite confusing. The AKAI
documents do contain useful technical information on sysex, but
they do not explain how to use it. For this reason, I suggest
you read this article before checking out the AKAI documents.

DISCLAIMER:
-----------

I am new to this stuff and don't understand most of it myself.
Please don't  seek  or even trust my advice! If I have made any
mistakes in this article or you have something useful to contribute,
please get in contact: TroyWoodfield@USA.NET.

Credits
-------

I have compiled this article using information supplied by:
1. [ThE SaMpLisT](http://www.cylinders.demon.co.uk/ThE_SaMpLisT/)
2. [The Official AKAI Web-Site](http://www.AKAI.COM)

Example # 1 - Using Cubase Mixer-Maps
-------------------------------------

Lets jump right in with a practical example of Cubase mixer-maps.
A mixer-map is simply a screen in Cubase where you can create your
own buttons to tweak...kind of like your own custom-made mixing desk.
This example does not really involve sysex, however it will help
provide some background knowledge for later. In this example we will
create a sliding knob in Cubase VST which will change the volume of
MIDI channel 1 in a MULTI.

**Part 1 - Creating a new Mixer-Map in Cubase:**
1.  Turn on your sampler and computer!
2.  Load any MULTI into the sampler, so we have a few sounds loaded.
3.  Start Cubase VST.
4.  Find an unused track in Cubase.  
    _For example, perhaps: Track 12._
5.  In the column titled "C" (Class of Track) is a musical note.
    Right click on this.
6.  Select: "Mix Track"
    _The musical note should be replaced with an icon showing
    up and down arrows). This track is now your: "Mixer Track"._
7.  Right click in the "Output" column and select "Empty"
    _We are creating a new Mixer-Map_
8.  Right click in the background of the main window.
9.  Select the pencil icon.
10.  Use the pencil to draw a new (empty) track into Track 12
     _(or whatever track you chose)_
11.  Right click in the background again and select the arrow icon.
12.  Left click twice quickly on the track you just created.
     You should now see the mixer window. It will be empty as we haven't
     created any buttons yet.

**Part 2 - Creating a button in a MixerMap**
1. Right click in the background of the mixer-map window.
2. Select: "New" icon.
3. Hold down the left mouse button and drag a rectangle in
   the empty Mixer-map window.
   _The "Object Definition" window appears._
4. Specify the following parameters:
   Name:  Vol1
   Button Type: Vertical Slider (The button illustrated at the far left).
   Minimum value: 0
   Maximum Value: 127
   MIDI message: Control Change
   Status Main Volume
   In the long box (beneath the learn button), specify: B0,07,XX
   _ Incluce no spaces, include commas.
   Each of these values has a meaning:
   B0 = Control Change.
   07 = Main Volume.
   XX = Cubase variable (which changes when you move the slider button)._
   MIDI Channel: 1
   Output: MIDI Out.
5. Click OK
   _The Slider button will be created in the Mixer-Map window._
6. Right click in the background of the Mixer-Map window.
7. Select the arrow (edit / move mode)
8. Left click once on the new slider button to select it.
9. Position the cursor above the bottom right corner of the slider
   (on the small black square).
10. Hold down the left mouse button and drag the slider so it is tall and thin.
    Now we have our own button all ready to use!

**Part 3 - Testing**
1.  Record some sounds using the instrument setup as PART 1
    of your MULTI (set to MIDI Channel 1).
2.  Once you have recorded a few notes, start this playing.
3.  If the cursor is not an arrow, right click in the background
    and make it so.
4.  Left click twice quickly on the mixer track (which was drawn
    earlier by pencil). The Mixer-Map Window will open.
5.  If the "Hand" cursor is not showing, right click in the background
    and select it. The hand cursor represents "Tweak Mode".
6.  Use the hand to move the slider up and down.
    _The volume for Part 1 will change accordingly. You can even watch
    the values change on your sampler as you move the slider._

**Part 4 - Recording the button tweaks.**
1.  In the main arrange window, right click in the background and
    select the pencil icon.
2.  Use the pencil to draw a new track in the Mixer track we created
    earlier.
    _Ensure that it is long enough to cover the duration you want to
    record for. Ie: If it's a long song, make it an equally long mixer
    track. Perhaps I'm missing something here, but I seemed to have to
    do this._
3.  Right click in the background and select the arrow.
4.  Left quick twice quickly on the mixer track we just drew with a
    pencil, to open the Mixer-Map window.  
    _You should see the sliderwe created earlier._
5.  If the Hand cursor is not selected, right click in background
    and select it.
6.  Where it says "Local" change it to: "Write".
    Local = Don't record any changes.
    Write = Do record any changes.
7.  Start the track playing by clicking on the Play button on the
    floating cubase tool-bar.
8.  As the song plays, move the slider up and down using the hand.
    _You should be able to hear the volume of the sound in MULTI PART 1
    changing, but this time it is also being recorded into your mixer
    track._
9.  When you've had enough, click stop to stop the track playing.
10. Change the "Write" setting back to "Local"
    _To stop recording button tweaks_

**Part 5 - Checking to see if the Tweaks were recorded**
1.  Go to the main Cubase arrange window.
2.  Right click in the background and select the magnifying glass.
3.  Hold down the left button while over the Mixer Track.
    _You should see white marks which represent your recorded
    volume changes._
4.  Play back the track to hear the recorded changes.

**Part 6 - To see Something Fun...**
1.  Start the song playing.
2.  Go back to the Mixer-map window, where your button is.
3.  Select: "Write" mode (not local).
    _This creates a connection between the mixer-map and the song._
4.  Watch as the slider change by itself, based on the changes
    you recorded earlier.
5.  Laugh at this for a few hours.
6.  Select: "Local" mode (not write) to stop recording changes.

**Part 7 - Removing your recorded Mix Track.**
1.  Go to the main Cubase arrange window.
2.  Delete the entire Mix Track.
3.  Play the song.
    The song will play without any volume changes to Part 1.
    _Ie: Your Tweaks are gone!_

To remove your mixer track temporally, simply mute that track by
clicking in the (M)ute column.

**Part 8 - Applying volume changes to another MIDI Channel**
To do the same thing for a different MIDI channel, repeat
the steps above, but when you create the Slider button specify
MIDI Channel 2 (or whatever).

_If I understand correctly, the AKAI S2000 sampler takes this to
mean Part 2 (even though the setting is labeled "MIDI channel")
...but I won't get into that._


### Phew!!!

If you didn't manage to get through the example above,
then....grit your teeth and try again! It's important that
you get the above process working before you continue.
Future examples will refer back to this one.

But if it all worked...

Congratulations!  You have just created a Cubase Mixer-Map,
with a sliding button which sends messages to your AKAI
sampler.  We used a predefined "Control Message" (Main Volume)
rather then a sysex command in this example. Control Messages
are smaller in size then sysex messages and are therefore
(apparently) faster to transfer via MIDI.

If you've got this far then things are looking good. You can
pat yourself on the back, but not for too long as we are about
to start the next example.

Example # 2 - Changing Part assignments.
----------------------------------------

This example involves setting PART 1 of a MULTI to a particular
instrument (AKAI Program). For example, setting PART 1 to be a
piano, a trumpet or a vocal. We will be using another "Control Message",
last time the control message was "Main Volume", this time it is
"Program Change".

**Steps:**
1.  Repeat the procedure used for Example 1, BUT...
2.  When you create the button, use the following settings:
    Name: Prg 1
    Button Type: Box with a number in it _(Second button from right)_
    MIDI Message Program Change.
    MIDI Channel: 1
    Output: MIDI out.
    Minimum value: 0
    Maximum value: 127

**To test the button works:**
On the AKAI S2000 sampler:
1.  Click MULTI.
2.  Page down to "Assign Prog" screen.
3.  When you click on the new button in your mixer-map, the
    sampler should change programs before your eyes. Notice that
    left clicking he button increases the number by one, right
    clicking increases by one.

If you made it this far, then you are indeed a warrior. So
lets dig our teeth into some sysex...

What is Sysex?
--------------

"Sysex"  is sometimes referred to as "Syx". This is an
abbreviation. The full name is "System Exclusive" Message.

Sysex is a way of sending a message from your sequencing
software (eg: Cubase, logic  or cakewalk) to your sampler,
to change sampler settings. For example, you can use a sysex
message to:
1.  Change the volume of a sample.
2.  Change Panning parameters.
3.  Switch to Multi Mode.
4.  Change which effect is applied on your (optional) EB-16 effects board.
5.  Change how strongly an effect is applied.
    These are just a few examples of sysex functionality.

Structure of Sysex
------------------

Each sysex message looks like an alien transmission from space,
as you can see below:

**F0 47 00 34 48 XX 00 01 00 00 01 00 YY ZZ F7.**

I have no idea what this particular sysex message does!
But notice that the general structure of a sysex command
involves 15 parts, and uses numbers in Hexadecimal (Base-16)
format. The Hex numbering system is different from decimal
in that it involves letters as well as numbers. For example
lets start counting in Hex:

**1,2,3,4,5,6,7,8,9,A,B,C,D,E,F,10,11,12...**

In case you find the Hex numbering system confusing, I have
included a conversion table and brief instructions later in
this article.

Don't be worried if you find the sysex information below a
little vague...it is. Just read through it and smile.
Hopefully the next example will make things more clear. The
key point I am trying to make is that each of the 15 parts
in a sysex message has a specific meaning.

The structure of a sysex message is shown below:

**AA BB CC DD EE FF GG HH II JJ KK LL MM NN OO**

Key:
AA	MIDI Sysex identifier
_F0 means: This is the start of a Sysex message_

BB	Manufacturer ID
_AKAI = 47_

CC	MIDI exclusive channel
_Typically set to "00" (Channel 1)_

DD	Operation Code
_What do we want to do? Eg: 42 = Access Multi. 41 = Request Data._

EE	Model Type
_For AKAI S1000 through to AKAI S3200XL samplers, specify: 48_

FF,GG	Multi Part Number.
_Part 1 = 00,00. Part 2 = 01,00. Part 3 = 02,00, etc._

HH	Selector
_1 = Access Multi Parts
0 = Access Multi file header._

II, JJ Reserved.
_Used to specify the offset for the desired function as specified
in the AKAI sysex documentation. This includes the number of bytes.
Convert this to Hex. If the hex value is less than 7F (127 decimal),
which is usually the case, then JJ will be set to 00. (Thanks Paul~)._

KK,LL	Number of bytes of data.

MM,NN	Mixermap Variables.
_Used by Cubase to mark the spot where data values are changed._

OO	Sysex End Marker
_F7 means: This is the end of a Sysex message_

Note: All sysex values listed after Manufacturer ID are
determined by the manufacturer. Therefore the sysex
commands for AKAI samplers do differ from samplers made
by other manufacturers.

Example 3 - Sysex
-----------------

I mentioned earlier that the official AKAI web-site has got
sysex information available. I stated that it is hard to
understand at first, however you will need to get a copy.
In fact, I understand that you must get all three of the
S-Series sysex documents in order to get the full picture
for the S2000.

I got the following TRANSPOSE information from one of the
AKAI documents: HTTP://WWW.AKAI.COM/Akaipro/S2000sysex.html

		TRANSPOSE FUNCTION
		Offset:		75 bytes.
		Field Size:		1 byte. 
		Range:		-50 to 50 semitones.
		Description:	Shift pitch of incoming MULTI.

We are going to look at how to turn this information into a
sysex command for Transposing the pitch of a part in a MULTI.
We'll build up the sysex message number-by-number.

**AA BB CC DD EE FF GG HH II JJ KK LL MM NN OO**

**Step 1 - AA**
As we are creating a sysex message, we know the first number must be: F0
Refer back to the section entitled: "Structure of sysex" to remind yourself.
Sysex message = F0,

**Step 2 - BB**
We are using an AKAI sampler, so the second number must be: 47.
Sysex message = FO,47,

**Step 3 - CC**
We know that most samplers use MIDI exclusive channel 1
_Which for some reason is specified as 00._
Sysex message = F0,47,00

**Step 4 - DD**
Because we are trying to access and change the parameters of a MULTI,
we will use the value: 42 (refer back to Structure of Sysex section).
If I was requesting data I would have specified: 41
Sysex message = F0,47,00,42

**Step 5 - EE**
I am using an AKAI S2000 sampler. So I specify the value: 48.
Sysex message = F0,47,00,42,48

**Step 6 - FF,GG**
We are trying to transpose the pitch on Part 1 so we specify 00,00.
If it had been part two we would have specified 01,00.
Sysex message = F0,47,00,42,48,00,00,

**Step 7 - HH**
Because the information was AKAI is under the heading: Access Multi
Parts(Not header), we know to specify 01.
Sysex message = F0,47,00,42,48,00,00,01

**Step 8 - II,JJ**
The off-set was included in the information listed above from AKAI
ie: 75 bytes. However we need to convert this to Hexadecimal, so it
becomes 4B. If you don't know how to do this, refer to the section
on Hex later in this document.
Sysex message = F0,47,00,42,48,00,00,01,4B,00

**Step 9 - KK,LL**
The number of bytes of data was also provided by AKAI (see above),
but they  referred to it as Field Size. The Field size is 1 byte,
so we enter the value 01,00. This is hex.
Sysex message = F0,47,00,42,48,00,00,01,4B,00,01,00

**Step 10 - MM,NN**
Now we need to include a variable for our cubase button.
Ie: when we change the position of the button, this is the number
which changes. We will specify this as: XX,00
Sysex message = F0,47,00,42,48,00,00,01,4B,00,01,00,XX,00

**Step 11 - OO**
We know, from the previous section on the structure of sysex,
that the end of a sysex message is always: F7.

**Final Sysex Message: F0,47,00,42,48,00,00,01,4B,00,01,00,XX,00,F7**

This sysex message can be used to change the pitch (transpose)
Part 1 of a MULTI. All we need to do is create a button in Cubase
which uses this sysex string to change settings on the sampler.
Let's go and set-up Cubase.

You need to create a slider button, as you did in the first example,
but this time when you create the button, specify the following parameters:
Name: Transpose
Minimum Value: 0
Maximum value: 50 (I don't know how to include values from -50 to 0 ?)
MIDI message: Sysex
Status: No Function (don't know why, but it works).
In the long box, specify our sysex message, without spaces and including the commas:
F0,47,00,42,48,00,00,01,4B,00,01,00,XX,00,F7
MIDI Channel: 1
OUTPUT: MIDI Out.

### To test:

On the AKAI S2000 sampler:
1.  Press MULTI button
2.  Page down until you see "Transpose" screen.
3.  Tweak the new transpose button in your mixer-Map.
4.  Watch the values change on your sampler.

The very first time I went through this process, it actually worked!
I nearly died on shock. Hopefully it worked first time for you too?

Below is the sysex information which we started the last example with:

	TRANSPOSE FUNCTION
	Offset:		75 bytes.
	Field Size:		1 Byte
   	Range:		-50 to 50 semitones.
	Description:	Shift pitch of incoming MULTI.

This information is from the AKAI sysex documents (mentioned earlier).
These documents describe "Transpose" plus various other sysex functions.

How to find sysex commands?
---------------------------

Here's a tip from Jan, author of the Millennium application.
To obtain the sysex command for a particular function,
he suggests:
1.  Hook up your sampler so you can record it's MIDI output in your sequencer.
2.  Play the song and change the sought parameter manually

Cubase will record the sysex message which was sent when
you did it manually. You can see the sysex command in the
LIST view, in Cubase.

The Hexadecimal Numbering system (Hex)
--------------------------------------

As you have seen, the values used in Sysex Messages are
in Hexadecimal format. Below is a conversion table which
you may find useful at some point.

Normal	Hex
0		0
1		1
2		2
3		3
4		4
5		5
6		6
7		7
8		8
9		9
10		A
11		B
12		C
13		D
14		E
15		F

16		10
17		11
18		12
19		13
20		14
21		15
22		16
23		17
24		18
25		19
26		1A
27		1B
28		1C
29		1D
30		1E
31		1F

32		20
33		21
34		22
35		23
36		24
37		25
38		26
39		27
40		28
41		29
42		2A
43		2B
44		2C
45		2D
46		2E
47		2F

48		30
49		31
50		32
51		33
52		34
53		35
54		36
55		37
56		38
57		39
58		3A
59		3B
60		3C
61		3D
62		3E
63		3F

**How to Convert Decimal - Hex**
If you want to convert your own numbers from standard decimal
to Hexadecimal, follow these steps:
1.  Start the Microsoft Windows Calculator.
2.  Select the pull down menu: View-Scientific.
3.  Click  "Dec"
4.  Type in a standard decimal number
5.  Click "Hex".
    The Hex value will be shown.

Cubase and Sysex
----------------

Cubase has got MIDI filters which can allow or disallow
you to record sysex commands. I don't fully understand
this stuff. In fact I know nothing about it at all
...however I went into the pull down menu: OPTIONS - MIDI FILTER
and put a tick next to: Record Sysex.

This may help if you're having problems?  Who knows?

Additional Information
----------------------

While I was writing this article, ThE SaMpLisT produced
his own introduction to sysex. I found this very useful
as it helped shape this article. He has created a Cubase
Mixer-map for changing parameters on the (Optional) AKAI
EB-16 Effects Board. Check out his site:
[ThE SaMpLisT](http://www.cylinders.demon.co.uk/ThE_SaMpLisT/)

The End.
--------

I have spent two weeks playing around with sysex after work,
learning the basics and writing this article.  I want to help
share the knowledge I've gained. If you have sampling skills or
tips, perhaps you can write an AKAI Article and share your
knowledge. It doesn't have to be long, it doesn't have to be
perfectly written, it just has to be useful or interesting.
Think about it and e-mail me: TroyWoodfield@USA.NET

_Peace to you all._

(c) 1999 Troy Woodfield.
New Zealand.

![](bluebar.jpg)

[Goto Top of Article](#Top_of_article)

[Article List](akai.html)

[Home Page](index.html)