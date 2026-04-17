
/Users/orion/work/audiocontrol-work/audiocontrol-mesa-ii-reverse-engineering/docs/1.0/001-IN-PROGRESS/mesa-ii-reverse-engineering/mesa-ii-analysis/binaries/scsi-plug-rsrc.bin:     file format binary


Disassembly of section .data:

00000000 <.data>:
       0:	0000 0100      	orib #0,%d0
       4:	0000 2e51      	orib #81,%d0
       8:	0000 2d51      	orib #81,%d0
       c:	0000 00c4      	orib #-60,%d0
	...
     100:	0000 0039      	orib #57,%d0
     104:	0212 2000      	andib #0,%a2@
     108:	0002 0676      	orib #118,%d2
     10c:	322e 312e      	movew %fp@(12590),%d1
     110:	322b 5343      	movew %a3@(21315),%d1
     114:	5349           	subqw #1,%a1
     116:	2050           	moveal %a0@,%a0
     118:	6c75           	bges 0x18f
     11a:	6720           	beqs 0x13c
     11c:	7632           	moveq #50,%d3
     11e:	2e31 2e32      	movel %a1@(32,%d2:l:8),%d7
     122:	0da9 414b      	bclr %d6,%a1@(16715)
     126:	4149           	.short 0x4149
     128:	2026           	movel %fp@-,%d0
     12a:	204c           	moveal %a4,%a0
     12c:	6976           	bvss 0x1a4
     12e:	696e           	bvss 0x19e
     130:	6720           	beqs 0x152
     132:	4d65           	.short 0x4d65
     134:	6d6f           	blts 0x1a5
     136:	7279           	moveq #121,%d1
     138:	2031 3939 3500 	movel %a1@(35000000,%d3:l)@(0),%d0
     13e:	0000 
     140:	1100           	moveb %d0,%a0@-
     142:	010e 4d45      	movepw %fp@(19781),%d0
     146:	5341           	subqw #1,%d1
     148:	2053           	moveal %a3@,%a0
     14a:	4353           	.short 0x4353
     14c:	4920           	chkl %a0@-,%d4
     14e:	506c 7567      	addqw #8,%a4@(30055)
     152:	0000 000e      	orib #14,%d0
     156:	0028 0028 00a2 	orib #40,%a0@(162)
     15c:	011a           	btst %d0,%a2@+
     15e:	01f4 5555      	bset %d0,%a4@(0)@(0)
     162:	280a           	movel %a2,%d4
     164:	0000 0392      	orib #-110,%d0
     168:	0000 0000      	orib #0,%d0
     16c:	8010           	orb %a0@,%d0
     16e:	0000 0000      	orib #0,%d0
     172:	0020 0020      	orib #32,%a0@-
	...
     17e:	0048           	.short 0x0048
     180:	0000 0048      	orib #72,%d0
     184:	0000 0000      	orib #0,%d0
     188:	0004 0001      	orib #1,%d4
     18c:	0004 0000      	orib #0,%d4
	...
     19c:	0000 0004      	orib #4,%d0
     1a0:	0000 0000      	orib #0,%d0
     1a4:	0020 0020      	orib #32,%a0@-
     1a8:	0000 0000      	orib #0,%d0
     1ac:	0004 0000      	orib #0,%d4
     1b0:	0000 0020      	orib #32,%d0
     1b4:	0020 0000      	orib #0,%a0@-
     1b8:	0000 0001      	orib #1,%d0
     1bc:	8000           	orb %d0,%d0
     1be:	0003 c000      	orib #0,%d3
     1c2:	0007 e000      	orib #0,%d7
     1c6:	0007 e000      	orib #0,%d7
     1ca:	000f           	.short 0x000f
     1cc:	f000           	.short 0xf000
     1ce:	000f           	.short 0x000f
     1d0:	f000           	.short 0xf000
     1d2:	001f f800      	orib #0,%sp@+
     1d6:	001f f800      	orib #0,%sp@+
     1da:	003f           	.short 0x003f
     1dc:	fc00           	.short 0xfc00
     1de:	003f           	.short 0x003f
     1e0:	fc00           	.short 0xfc00
     1e2:	007f           	.short 0x007f
     1e4:	fe00           	.short 0xfe00
     1e6:	007f           	.short 0x007f
     1e8:	fe00           	.short 0xfe00
     1ea:	00ff           	.short 0x00ff
     1ec:	ff00           	.short 0xff00
     1ee:	00ff           	.short 0x00ff
     1f0:	ff00           	.short 0xff00
     1f2:	01ff           	.short 0x01ff
     1f4:	ff80           	.short 0xff80
     1f6:	01ff           	.short 0x01ff
     1f8:	ff80           	.short 0xff80
     1fa:	03ff           	.short 0x03ff
     1fc:	ffc0           	.short 0xffc0
     1fe:	03ff           	.short 0x03ff
     200:	ffc0           	.short 0xffc0
     202:	07ff           	.short 0x07ff
     204:	ffe0           	.short 0xffe0
     206:	07ff           	.short 0x07ff
     208:	ffe0           	.short 0xffe0
     20a:	0fff           	.short 0x0fff
     20c:	fff0           	.short 0xfff0
     20e:	0fff           	.short 0x0fff
     210:	fff0           	.short 0xfff0
     212:	1fff           	.short 0x1fff
     214:	fff8           	.short 0xfff8
     216:	1fff           	.short 0x1fff
     218:	fff8           	.short 0xfff8
     21a:	3fff           	.short 0x3fff
     21c:	fffc           	.short 0xfffc
     21e:	3fff           	.short 0x3fff
     220:	fffc           	.short 0xfffc
     222:	7fff           	.short 0x7fff
     224:	fffe           	.short 0xfffe
     226:	7fff           	.short 0x7fff
     228:	fffe           	.short 0xfffe
     22a:	ffff           	.short 0xffff
     22c:	ffff           	.short 0xffff
     22e:	ffff           	.short 0xffff
     230:	ffff           	.short 0xffff
     232:	ffff           	.short 0xffff
     234:	ffff           	.short 0xffff
     236:	ffff           	.short 0xffff
     238:	ffff           	.short 0xffff
     23a:	0001 8000      	orib #0,%d1
     23e:	0003 c000      	orib #0,%d3
     242:	0003 c000      	orib #0,%d3
     246:	0006 6000      	orib #0,%d6
     24a:	0006 6000      	orib #0,%d6
     24e:	000c           	.short 0x000c
     250:	3000           	movew %d0,%d0
     252:	000c           	.short 0x000c
     254:	3000           	movew %d0,%d0
     256:	0018 1800      	orib #0,%a0@+
     25a:	0019 9800      	orib #0,%a1@+
     25e:	0033 cc00 0033 	orib #0,%a3@(33,%d0:w)
     264:	cc00           	andb %d0,%d6
     266:	0063 c600      	oriw #-14848,%a3@-
     26a:	0063 c600      	oriw #-14848,%a3@-
     26e:	00c3           	.short 0x00c3
     270:	c300           	abcd %d0,%d1
     272:	00c3           	.short 0x00c3
     274:	c300           	abcd %d0,%d1
     276:	0183           	bclr %d0,%d3
     278:	c180           	.short 0xc180
     27a:	0183           	bclr %d0,%d3
     27c:	c180           	.short 0xc180
     27e:	0303           	btst %d1,%d3
     280:	c0c0           	muluw %d0,%d0
     282:	0303           	btst %d1,%d3
     284:	c0c0           	muluw %d0,%d0
     286:	0603 c060      	addib #96,%d3
     28a:	0601 8060      	addib #96,%d1
     28e:	0c01 8030      	cmpib #48,%d1
     292:	0c00 0030      	cmpib #48,%d0
     296:	1800           	moveb %d0,%d4
     298:	0018 1801      	orib #1,%a0@+
     29c:	8018           	orb %a0@+,%d0
     29e:	3003           	movew %d3,%d0
     2a0:	c00c           	.short 0xc00c
     2a2:	3003           	movew %d3,%d0
     2a4:	c00c           	.short 0xc00c
     2a6:	6001           	bras 0x2a9
     2a8:	8006           	orb %d6,%d0
     2aa:	6000 0006      	braw 0x2b2
     2ae:	c000           	andb %d0,%d0
     2b0:	0003 ffff      	orib #-1,%d3
     2b4:	ffff           	.short 0xffff
     2b6:	7fff           	.short 0x7fff
     2b8:	fffe           	.short 0xfffe
     2ba:	0000 0000      	orib #0,%d0
     2be:	0000 0006      	orib #6,%d0
     2c2:	0000 ffff      	orib #-1,%d0
     2c6:	ffff           	.short 0xffff
     2c8:	ffff           	.short 0xffff
     2ca:	0001 ffff      	orib #-1,%d1
     2ce:	cccc           	.short 0xcccc
     2d0:	3333 0002      	movew %a3@(2,%d0:w),%a1@-
     2d4:	cccc           	.short 0xcccc
     2d6:	9999           	subl %d4,%a1@+
     2d8:	0000 0003      	orib #3,%d0
     2dc:	9999           	subl %d4,%a1@+
     2de:	6666           	bnes 0x346
     2e0:	0000 0004      	orib #4,%d0
     2e4:	3333 3333 3333 	movew %a3@(33330005,%d3:w:2)@(ffffffffbbbbbbbb),%a1@-
     2ea:	0005 bbbb bbbb 
     2f0:	bbbb           	.short 0xbbbb
     2f2:	000f           	.short 0x000f
	...
     300:	000f           	.short 0x000f
     302:	f000           	.short 0xf000
	...
     310:	004f           	.short 0x004f
     312:	f400           	.short 0xf400
	...
     320:	05ff           	.short 0x05ff
     322:	ff50           	.short 0xff50
	...
     330:	04f3           	.short 0x04f3
     332:	3f40 0000      	movew %d0,%sp@(0)
	...
     33e:	0000 5ff1      	orib #-15,%d0
     342:	1ff5           	.short 0x1ff5
	...
     350:	4f31 13f4 0000 	chkl @(0)@(0),%d7
     356:	0000 
     358:	0000 0000      	orib #0,%d0
     35c:	0000 0005      	orib #5,%d0
     360:	ff11           	.short 0xff11
     362:	11ff           	.short 0x11ff
     364:	5000           	addqb #8,%d0
	...
     36e:	0004 f311      	orib #17,%d4
     372:	113f           	.short 0x113f
     374:	4000           	negxb %d0
	...
     37e:	005f f12f      	oriw #-3793,%sp@+
     382:	f21f           	.short 0xf21f
     384:	f500           	.short 0xf500
	...
     38e:	004f           	.short 0x004f
     390:	314f f413      	movew %sp,%a0@(-3053)
     394:	f400           	.short 0xf400
	...
     39e:	05ff           	.short 0x05ff
     3a0:	11ff           	.short 0x11ff
     3a2:	ff11           	.short 0xff11
     3a4:	ff50           	.short 0xff50
	...
     3ae:	04f3           	.short 0x04f3
     3b0:	11ff           	.short 0x11ff
     3b2:	ff11           	.short 0xff11
     3b4:	3f40 0000      	movew %d0,%sp@(0)
     3b8:	0000 0000      	orib #0,%d0
     3bc:	0000 5ff1      	orib #-15,%d0
     3c0:	11ff           	.short 0x11ff
     3c2:	ff11           	.short 0xff11
     3c4:	1ff5           	.short 0x1ff5
	...
     3ce:	4f31 11ff ff11 	chkl @(ffffffffff1113f4)@(0),%d7
     3d4:	13f4 0000 0000 
     3da:	0000 0005      	orib #5,%d0
     3de:	ff11           	.short 0xff11
     3e0:	11ff           	.short 0x11ff
     3e2:	ff11           	.short 0xff11
     3e4:	11ff           	.short 0x11ff
     3e6:	5000           	addqb #8,%d0
     3e8:	0000 0000      	orib #0,%d0
     3ec:	0004 f311      	orib #17,%d4
     3f0:	11ff           	.short 0x11ff
     3f2:	ff11           	.short 0xff11
     3f4:	113f           	.short 0x113f
     3f6:	4000           	negxb %d0
     3f8:	0000 0000      	orib #0,%d0
     3fc:	005f f111      	oriw #-3823,%sp@+
     400:	11ff           	.short 0x11ff
     402:	ff11           	.short 0xff11
     404:	111f           	moveb %sp@+,%a0@-
     406:	f500           	.short 0xf500
     408:	0000 0000      	orib #0,%d0
     40c:	004f           	.short 0x004f
     40e:	3111           	movew %a1@,%a0@-
     410:	11ff           	.short 0x11ff
     412:	ff11           	.short 0xff11
     414:	1113           	moveb %a3@,%a0@-
     416:	f400           	.short 0xf400
     418:	0000 0000      	orib #0,%d0
     41c:	05ff           	.short 0x05ff
     41e:	1111           	moveb %a1@,%a0@-
     420:	11ff           	.short 0x11ff
     422:	ff11           	.short 0xff11
     424:	1111           	moveb %a1@,%a0@-
     426:	ff50           	.short 0xff50
     428:	0000 0000      	orib #0,%d0
     42c:	04f3           	.short 0x04f3
     42e:	1111           	moveb %a1@,%a0@-
     430:	114f           	.short 0x114f
     432:	f411           	.short 0xf411
     434:	1111           	moveb %a1@,%a0@-
     436:	3f40 0000      	movew %d0,%sp@(0)
     43a:	0000 5ff1      	orib #-15,%d0
     43e:	1111           	moveb %a1@,%a0@-
     440:	112f f211      	moveb %sp@(-3567),%a0@-
     444:	1111           	moveb %a1@,%a0@-
     446:	1ff5           	.short 0x1ff5
     448:	0000 0000      	orib #0,%d0
     44c:	4f31 1111      	chkl %a1@(0,%d1:w)@(0),%d7
     450:	111f           	moveb %sp@+,%a0@-
     452:	f111           	psave %a1@
     454:	1111           	moveb %a1@,%a0@-
     456:	13f4 0000 0005 	moveb %a4@(0,%d0:w),0x5ff11
     45c:	ff11 
     45e:	1111           	moveb %a1@,%a0@-
     460:	1112           	moveb %a2@,%a0@-
     462:	2111           	movel %a1@,%a0@-
     464:	1111           	moveb %a1@,%a0@-
     466:	11ff           	.short 0x11ff
     468:	5000           	addqb #8,%d0
     46a:	0004 f311      	orib #17,%d4
     46e:	1111           	moveb %a1@,%a0@-
     470:	1111           	moveb %a1@,%a0@-
     472:	1111           	moveb %a1@,%a0@-
     474:	1111           	moveb %a1@,%a0@-
     476:	113f           	.short 0x113f
     478:	4000           	negxb %d0
     47a:	005f f111      	oriw #-3823,%sp@+
     47e:	1111           	moveb %a1@,%a0@-
     480:	112f f211      	moveb %sp@(-3567),%a0@-
     484:	1111           	moveb %a1@,%a0@-
     486:	111f           	moveb %sp@+,%a0@-
     488:	f500           	.short 0xf500
     48a:	004f           	.short 0x004f
     48c:	3111           	movew %a1@,%a0@-
     48e:	1111           	moveb %a1@,%a0@-
     490:	11ff           	.short 0x11ff
     492:	ff11           	.short 0xff11
     494:	1111           	moveb %a1@,%a0@-
     496:	1113           	moveb %a3@,%a0@-
     498:	f400           	.short 0xf400
     49a:	05ff           	.short 0x05ff
     49c:	1111           	moveb %a1@,%a0@-
     49e:	1111           	moveb %a1@,%a0@-
     4a0:	11ff           	.short 0x11ff
     4a2:	ff11           	.short 0xff11
     4a4:	1111           	moveb %a1@,%a0@-
     4a6:	1111           	moveb %a1@,%a0@-
     4a8:	ff50           	.short 0xff50
     4aa:	04f3           	.short 0x04f3
     4ac:	1111           	moveb %a1@,%a0@-
     4ae:	1111           	moveb %a1@,%a0@-
     4b0:	112f f211      	moveb %sp@(-3567),%a0@-
     4b4:	1111           	moveb %a1@,%a0@-
     4b6:	1111           	moveb %a1@,%a0@-
     4b8:	3f40 5ff1      	movew %d0,%sp@(24561)
     4bc:	1111           	moveb %a1@,%a0@-
     4be:	1111           	moveb %a1@,%a0@-
     4c0:	1111           	moveb %a1@,%a0@-
     4c2:	1111           	moveb %a1@,%a0@-
     4c4:	1111           	moveb %a1@,%a0@-
     4c6:	1111           	moveb %a1@,%a0@-
     4c8:	1ff5           	.short 0x1ff5
     4ca:	ff31           	.short 0xff31
     4cc:	1111           	moveb %a1@,%a0@-
     4ce:	1111           	moveb %a1@,%a0@-
     4d0:	1111           	moveb %a1@,%a0@-
     4d2:	1111           	moveb %a1@,%a0@-
     4d4:	1111           	moveb %a1@,%a0@-
     4d6:	1111           	moveb %a1@,%a0@-
     4d8:	13ff           	.short 0x13ff
     4da:	ffff           	.short 0xffff
     4dc:	ffff           	.short 0xffff
     4de:	ffff           	.short 0xffff
     4e0:	ffff           	.short 0xffff
     4e2:	ffff           	.short 0xffff
     4e4:	ffff           	.short 0xffff
     4e6:	ffff           	.short 0xffff
     4e8:	ffff           	.short 0xffff
     4ea:	5fff           	.short 0x5fff
     4ec:	ffff           	.short 0xffff
     4ee:	ffff           	.short 0xffff
     4f0:	ffff           	.short 0xffff
     4f2:	ffff           	.short 0xffff
     4f4:	ffff           	.short 0xffff
     4f6:	ffff           	.short 0xffff
     4f8:	fff5           	.short 0xfff5
     4fa:	0000 0048      	orib #72,%d0
     4fe:	0002 0000      	orib #0,%d2
     502:	0000 005c      	orib #92,%d0
     506:	005b 0070      	oriw #112,%a3@+
     50a:	0095 0402 4f68 	oril #67260264,%a5@
     510:	0000 0000      	orib #0,%d0
     514:	0007 000b      	orib #11,%d7
     518:	0027 002b      	orib #43,%sp@-
     51c:	a002           	.short 0xa002
     51e:	0002 0000      	orib #0,%d2
     522:	0000 0007      	orib #7,%d0
     526:	002d 0050 00ec 	orib #80,%a5@(236)
     52c:	8817           	orb %sp@,%d4
     52e:	5343           	subqw #1,%d3
     530:	5349           	subqw #1,%a1
     532:	2050           	moveal %a0@,%a0
     534:	6c75           	bges 0x5ab
     536:	673a           	beqs 0x572
     538:	200d           	movel %a5,%d0
     53a:	0d45           	bchg %d6,%d5
     53c:	7272           	moveq #114,%d1
     53e:	6f72           	bles 0x5b2
     540:	203d           	.short 0x203d
     542:	205e           	moveal %fp@+,%a0
     544:	3000           	movew %d0,%d0
     546:	0000 0034      	orib #52,%d0
     54a:	0002 0000      	orib #0,%d2
     54e:	0000 0074      	orib #116,%d0
     552:	00c4           	.short 0x00c4
     554:	0088           	.short 0x0088
     556:	00fe           	.short 0x00fe
     558:	0402 4f6b      	subib #107,%d2
     55c:	0000 0000      	orib #0,%d0
     560:	0074 001d 0088 	oriw #29,%a4@(ffffffffffffff88,%d0:w)
     566:	0057 0406      	oriw #1030,%sp@
     56a:	4361           	.short 0x4361
     56c:	6e63           	bgts 0x5d1
     56e:	656c           	bcss 0x5dc
     570:	0000 0000      	orib #0,%d0
     574:	0007 0012      	orib #18,%d7
     578:	0067 010c      	oriw #268,%sp@-
     57c:	8000           	orb %d0,%d0
     57e:	0000 0018      	orib #24,%d0
     582:	0041 0058      	oriw #88,%d1
     586:	00d7           	.short 0x00d7
     588:	0177 0001      	bchg %d0,%sp@(1,%d0:w)
	...
     594:	03e8 006e      	bset %d1,%a0@(110)
     598:	280a           	movel %a2,%d4
     59a:	0000 28b3      	orib #-77,%d0
     59e:	600a           	bras 0x5aa
     5a0:	0000 504c      	orib #76,%d0
     5a4:	5547           	subqw #2,%d7
     5a6:	0000 0000      	orib #0,%d0
     5aa:	48e7 e0c8      	moveml %d0-%d2/%a0-%a1/%a4,%sp@-
     5ae:	4eba 00f2      	jsr %pc@(0x6a2)
     5b2:	41fa ffea      	lea %pc@(0x59e),%a0
     5b6:	2008           	movel %a0,%d0
     5b8:	a055           	.short 0xa055
     5ba:	4eba 0090      	jsr %pc@(0x64c)
     5be:	4cdf 1307      	moveml %sp@+,%d0-%d2/%a0-%a1/%a4
     5c2:	4efa 0148      	jmp %pc@(0x70c)
     5c6:	41fa ffd6      	lea %pc@(0x59e),%a0
     5ca:	d1fc 0000 281f 	addal #10271,%a0
     5d0:	2008           	movel %a0,%d0
     5d2:	a055           	.short 0xa055
     5d4:	4e75           	rts
     5d6:	48e7 0600      	moveml %d5-%d6,%sp@-
     5da:	594f           	subqw #4,%sp
     5dc:	206f 0010      	moveal %sp@(16),%a0
     5e0:	226f 0014      	moveal %sp@(20),%a1
     5e4:	2c2f 0018      	movel %sp@(24),%d6
     5e8:	1e98           	moveb %a0@+,%sp@
     5ea:	1f58 0001      	moveb %a0@+,%sp@(1)
     5ee:	1f58 0002      	moveb %a0@+,%sp@(2)
     5f2:	1f58 0003      	moveb %a0@+,%sp@(3)
     5f6:	2a17           	movel %sp@,%d5
     5f8:	7400           	moveq #0,%d2
     5fa:	6044           	bras 0x640
     5fc:	1218           	moveb %a0@+,%d1
     5fe:	1001           	moveb %d1,%d0
     600:	0240 0080      	andiw #128,%d0
     604:	670c           	beqs 0x612
     606:	d201           	addb %d1,%d1
     608:	1001           	moveb %d1,%d0
     60a:	4880           	extw %d0
     60c:	48c0           	extl %d0
     60e:	d480           	addl %d0,%d2
     610:	6028           	bras 0x63a
     612:	1e81           	moveb %d1,%sp@
     614:	1f58 0001      	moveb %a0@+,%sp@(1)
     618:	1001           	moveb %d1,%d0
     61a:	0240 0040      	andiw #64,%d0
     61e:	670c           	beqs 0x62c
     620:	3017           	movew %sp@,%d0
     622:	e548           	lslw #2,%d0
     624:	e240           	asrw #1,%d0
     626:	48c0           	extl %d0
     628:	d480           	addl %d0,%d2
     62a:	600e           	bras 0x63a
     62c:	1f58 0002      	moveb %a0@+,%sp@(2)
     630:	1f58 0003      	moveb %a0@+,%sp@(3)
     634:	2417           	movel %sp@,%d2
     636:	e58a           	lsll #2,%d2
     638:	e282           	asrl #1,%d2
     63a:	ddb1 2800      	addl %d6,%a1@(0,%d2:l)
     63e:	5385           	subql #1,%d5
     640:	4a85           	tstl %d5
     642:	6eb8           	bgts 0x5fc
     644:	584f           	addqw #4,%sp
     646:	4cdf 0060      	moveml %sp@+,%d5-%d6
     64a:	4e75           	rts
     64c:	48e7 1020      	moveml %d3/%a2,%sp@-
     650:	2440           	moveal %d0,%a2
     652:	202c 0266      	movel %a4@(614),%d0
     656:	260a           	movel %a2,%d3
     658:	9680           	subl %d0,%d3
     65a:	6740           	beqs 0x69c
     65c:	4a80           	tstl %d0
     65e:	661c           	bnes 0x67c
     660:	422c 026a      	clrb %a4@(618)
     664:	303c a89f      	movew #-22369,%d0
     668:	a746           	.short 0xa746
     66a:	2f08           	movel %a0,%sp@-
     66c:	303c a198      	movew #-24168,%d0
     670:	a346           	.short 0xa346
     672:	b1df           	cmpal %sp@+,%a0
     674:	56c0           	sne %d0
     676:	4400           	negb %d0
     678:	1940 026a      	moveb %d0,%a4@(618)
     67c:	2f03           	movel %d3,%sp@-
     67e:	2f0a           	movel %a2,%sp@-
     680:	4eba ff44      	jsr %pc@(0x5c6)
     684:	2f00           	movel %d0,%sp@-
     686:	4eba ff4e      	jsr %pc@(0x5d6)
     68a:	4fef 000c      	lea %sp@(12),%sp
     68e:	294a 0266      	movel %a2,%a4@(614)
     692:	4a2c 026a      	tstb %a4@(618)
     696:	6704           	beqs 0x69c
     698:	7001           	moveq #1,%d0
     69a:	a198           	.short 0xa198
     69c:	4cdf 0408      	moveml %sp@+,%d3/%a2
     6a0:	4e75           	rts
     6a2:	41fa fefa      	lea %pc@(0x59e),%a0
     6a6:	d1fc 0000 25b4 	addal #9652,%a0
     6ac:	2008           	movel %a0,%d0
     6ae:	a055           	.short 0xa055
     6b0:	c18c           	exg %d0,%a4
     6b2:	4e75           	rts
     6b4:	48e7 3000      	moveml %d2-%d3,%sp@-
     6b8:	7402           	moveq #2,%d2
     6ba:	4efb 2200      	jmp %pc@(0x6bc,%d2:w:2)
     6be:	600a           	bras 0x6ca
     6c0:	4c01 0000      	mulul %d1,%d0
     6c4:	4cdf 000c      	moveml %sp@+,%d2-%d3
     6c8:	4e75           	rts
     6ca:	2400           	movel %d0,%d2
     6cc:	4842           	swap %d2
     6ce:	c4c1           	muluw %d1,%d2
     6d0:	2601           	movel %d1,%d3
     6d2:	4843           	swap %d3
     6d4:	c6c0           	muluw %d0,%d3
     6d6:	d443           	addw %d3,%d2
     6d8:	4842           	swap %d2
     6da:	4242           	clrw %d2
     6dc:	c0c1           	muluw %d1,%d0
     6de:	d082           	addl %d2,%d0
     6e0:	4cdf 000c      	moveml %sp@+,%d2-%d3
     6e4:	4e75           	rts
     6e6:	205f           	moveal %sp@+,%a0
     6e8:	2248           	moveal %a0,%a1
     6ea:	d2d8           	addaw %a0@+,%a1
     6ec:	b098           	cmpl %a0@+,%d0
     6ee:	6c02           	bges 0x6f2
     6f0:	4ed1           	jmp %a1@
     6f2:	b098           	cmpl %a0@+,%d0
     6f4:	6f02           	bles 0x6f8
     6f6:	4ed1           	jmp %a1@
     6f8:	3218           	movew %a0@+,%d1
     6fa:	b098           	cmpl %a0@+,%d0
     6fc:	6604           	bnes 0x702
     6fe:	d0d0           	addaw %a0@,%a0
     700:	4ed0           	jmp %a0@
     702:	5448           	addqw #2,%a0
     704:	51c9 fff4      	dbf %d1,0x6fa
     708:	4ed1           	jmp %a1@
     70a:	4e75           	rts
     70c:	4e56 0000      	linkw %fp,#0
     710:	48e7 1c30      	moveml %d3-%d5/%a2-%a3,%sp@-
     714:	246e 0008      	moveal %fp@(8),%a2
     718:	4eb9 0000 0104 	jsr 0x104
     71e:	2800           	movel %d0,%d4
     720:	2012           	movel %a2@,%d0
     722:	0480 494e 4954 	subil #1229867348,%d0
     728:	6702           	beqs 0x72c
     72a:	603c           	bras 0x768
     72c:	4878 0e48      	pea 0xe48
     730:	4eb9 0000 1a30 	jsr 0x1a30
     736:	2648           	moveal %a0,%a3
     738:	2008           	movel %a0,%d0
     73a:	584f           	addqw #4,%sp
     73c:	670a           	beqs 0x748
     73e:	2f0b           	movel %a3,%sp@-
     740:	4eb9 0000 0628 	jsr 0x628
     746:	584f           	addqw #4,%sp
     748:	294b 0262      	movel %a3,%a4@(610)
     74c:	4aac 0262      	tstl %a4@(610)
     750:	6746           	beqs 0x798
     752:	2f2a 0006      	movel %a2@(6),%sp@-
     756:	2f2c 0262      	movel %a4@(610),%sp@-
     75a:	2057           	moveal %sp@,%a0
     75c:	2250           	moveal %a0@,%a1
     75e:	2269 000c      	moveal %a1@(12),%a1
     762:	4e91           	jsr %a1@
     764:	504f           	addqw #8,%sp
     766:	6030           	bras 0x798
     768:	4aac 0262      	tstl %a4@(610)
     76c:	672a           	beqs 0x798
     76e:	554f           	subqw #2,%sp
     770:	a994           	.short 0xa994
     772:	301f           	movew %sp@+,%d0
     774:	3a00           	movew %d0,%d5
     776:	262c 0262      	movel %a4@(610),%d3
     77a:	2043           	moveal %d3,%a0
     77c:	3f28 0938      	movew %a0@(2360),%sp@-
     780:	a998           	.short 0xa998
     782:	2f0a           	movel %a2,%sp@-
     784:	2f2c 0262      	movel %a4@(610),%sp@-
     788:	2057           	moveal %sp@,%a0
     78a:	2250           	moveal %a0@,%a1
     78c:	2269 0010      	moveal %a1@(16),%a1
     790:	4e91           	jsr %a1@
     792:	3f05           	movew %d5,%sp@-
     794:	a998           	.short 0xa998
     796:	504f           	addqw #8,%sp
     798:	2004           	movel %d4,%d0
     79a:	c18c           	exg %d0,%a4
     79c:	4cdf 0c38      	moveml %sp@+,%d3-%d5/%a2-%a3
     7a0:	4e5e           	unlk %fp
     7a2:	4e75           	rts
     7a4:	846d 6169      	orw %a5@(24937),%d2
     7a8:	6e00 0000      	bgtw 0x7aa
     7ac:	4e56 0000      	linkw %fp,#0
     7b0:	2f0a           	movel %a2,%sp@-
     7b2:	246e 0008      	moveal %fp@(8),%a2
     7b6:	41ec 019a      	lea %a4@(410),%a0
     7ba:	2488           	movel %a0,%a2@
     7bc:	42aa 0004      	clrl %a2@(4)
     7c0:	42aa 0038      	clrl %a2@(56)
     7c4:	257c 4e55 4c4c 	movel #1314212940,%a2@(8)
     7ca:	0008 
     7cc:	42aa 000c      	clrl %a2@(12)
     7d0:	41f9 0000 016e 	lea 0x16e,%a0
     7d6:	2548 0010      	movel %a0,%a2@(16)
     7da:	422a 0014      	clrb %a2@(20)
     7de:	204a           	moveal %a2,%a0
     7e0:	41e8 0038      	lea %a0@(56),%a0
     7e4:	2548 0034      	movel %a0,%a2@(52)
     7e8:	554f           	subqw #2,%sp
     7ea:	a994           	.short 0xa994
     7ec:	301f           	movew %sp@+,%d0
     7ee:	3540 0938      	movew %d0,%a2@(2360)
     7f2:	204a           	moveal %a2,%a0
     7f4:	245f           	moveal %sp@+,%a2
     7f6:	4e5e           	unlk %fp
     7f8:	4e75           	rts
     7fa:	955f           	subw %d2,%sp@+
     7fc:	5f63           	subqw #7,%a3@-
     7fe:	745f           	moveq #95,%d2
     800:	5f31 3143 4d45 	subqb #7,%a1@(0)@(4d455341)
     806:	5341 
     808:	506c 7567      	addqw #8,%a4@(30055)
     80c:	496e           	.short 0x496e
     80e:	4676 0000      	notw %fp@(0,%d0:w)
     812:	4e56 0000      	linkw %fp,#0
     816:	2f0a           	movel %a2,%sp@-
     818:	246e 0008      	moveal %fp@(8),%a2
     81c:	200a           	movel %a2,%d0
     81e:	6716           	beqs 0x836
     820:	41ec 019a      	lea %a4@(410),%a0
     824:	2488           	movel %a0,%a2@
     826:	4a6e 000c      	tstw %fp@(12)
     82a:	6f0a           	bles 0x836
     82c:	2f0a           	movel %a2,%sp@-
     82e:	4eb9 0000 1b56 	jsr 0x1b56
     834:	584f           	addqw #4,%sp
     836:	204a           	moveal %a2,%a0
     838:	245f           	moveal %sp@+,%a2
     83a:	4e5e           	unlk %fp
     83c:	4e75           	rts
     83e:	955f           	subw %d2,%sp@+
     840:	5f64           	subqw #7,%a4@-
     842:	745f           	moveq #95,%d2
     844:	5f31 3143 4d45 	subqb #7,%a1@(0)@(4d455341)
     84a:	5341 
     84c:	506c 7567      	addqw #8,%a4@(30055)
     850:	496e           	.short 0x496e
     852:	4676 0000      	notw %fp@(0,%d0:w)
     856:	4e56 0000      	linkw %fp,#0
     85a:	206e 0008      	moveal %fp@(8),%a0
     85e:	216e 000c 0004 	movel %fp@(12),%a0@(4)
     864:	4e5e           	unlk %fp
     866:	4e75           	rts
     868:	802d 5365      	orb %a5@(21349),%d0
     86c:	744d           	moveq #77,%d2
     86e:	4553           	.short 0x4553
     870:	4150           	.short 0x4150
     872:	726f           	moveq #111,%d1
     874:	635f           	blss 0x8d5
     876:	5f31 3143 4d45 	subqb #7,%a1@(0)@(4d455341)
     87c:	5341 
     87e:	506c 7567      	addqw #8,%a4@(30055)
     882:	496e           	.short 0x496e
     884:	4650           	notw %a0@
     886:	4650           	notw %a0@
     888:	3131 4d45      	movew %a1@(0)@(0),%a0@-
     88c:	5341           	subqw #1,%d1
     88e:	436f           	.short 0x436f
     890:	6d6d           	blts 0x8ff
     892:	616e           	bsrs 0x902
     894:	645f           	bccs 0x8f5
     896:	7600           	moveq #0,%d3
     898:	0000 4e56      	orib #86,%d0
     89c:	0000 48e7      	orib #-25,%d0
     8a0:	1030 266e      	moveb %a0@(6e,%d2:w:8),%d0
     8a4:	0008           	.short 0x0008
     8a6:	246e 000c      	moveal %fp@(12),%a2
     8aa:	4aab 0004      	tstl %a3@(4)
     8ae:	6700 00e8      	beqw 0x998
     8b2:	7601           	moveq #1,%d3
     8b4:	2012           	movel %a2@,%d0
     8b6:	4eb9 0000 0148 	jsr 0x148
     8bc:	00d6           	.short 0x00d6
     8be:	4151           	.short 0x4151
     8c0:	5554           	subqw #2,%a4@
     8c2:	5345           	subqw #1,%d5
     8c4:	4e44           	trap #4
     8c6:	0006 4151      	orib #81,%d6
     8ca:	5554           	subqw #2,%a4@
     8cc:	00b2 4153 4f4b 	oril #1095978827,%a2@(52,%d0:w)
     8d2:	0052 
     8d4:	434c           	.short 0x434c
     8d6:	534d           	subqw #1,%a5
     8d8:	0096 434f 4e53 	oril #1129270867,%fp@
     8de:	002e 4944 454e 	orib #68,%fp@(17742)
     8e4:	0068 4f50 4e4d 	oriw #20304,%a0@(20045)
     8ea:	0052 5345      	oriw #21317,%a2@
     8ee:	4e44           	trap #4
     8f0:	0002 2f2a      	orib #42,%d2
     8f4:	0006 2f0b      	orib #11,%d6
     8f8:	2057           	moveal %sp@,%a0
     8fa:	2250           	moveal %a0@,%a1
     8fc:	2269 0014      	moveal %a1@(20),%a1
     900:	4e91           	jsr %a1@
     902:	3540 0004      	movew %d0,%a2@(4)
     906:	504f           	addqw #8,%sp
     908:	6000 008a      	braw 0x994
     90c:	2f2a 0006      	movel %a2@(6),%sp@-
     910:	2f0b           	movel %a3,%sp@-
     912:	2057           	moveal %sp@,%a0
     914:	2250           	moveal %a0@,%a1
     916:	2269 0030      	moveal %a1@(48),%a1
     91a:	4e91           	jsr %a1@
     91c:	3540 0004      	movew %d0,%a2@(4)
     920:	504f           	addqw #8,%sp
     922:	6070           	bras 0x994
     924:	2f2a 0006      	movel %a2@(6),%sp@-
     928:	2f0b           	movel %a3,%sp@-
     92a:	2057           	moveal %sp@,%a0
     92c:	2250           	moveal %a0@,%a1
     92e:	2269 0034      	moveal %a1@(52),%a1
     932:	4e91           	jsr %a1@
     934:	3540 0004      	movew %d0,%a2@(4)
     938:	504f           	addqw #8,%sp
     93a:	6058           	bras 0x994
     93c:	2f0b           	movel %a3,%sp@-
     93e:	2057           	moveal %sp@,%a0
     940:	2250           	moveal %a0@,%a1
     942:	2269 0024      	moveal %a1@(36),%a1
     946:	4e91           	jsr %a1@
     948:	584f           	addqw #4,%sp
     94a:	6048           	bras 0x994
     94c:	204b           	moveal %a3,%a0
     94e:	5088           	addql #8,%a0
     950:	226a 0006      	moveal %a2@(6),%a1
     954:	22d8           	movel %a0@+,%a1@+
     956:	22d8           	movel %a0@+,%a1@+
     958:	22d8           	movel %a0@+,%a1@+
     95a:	22d8           	movel %a0@+,%a1@+
     95c:	22d8           	movel %a0@+,%a1@+
     95e:	22d8           	movel %a0@+,%a1@+
     960:	22d8           	movel %a0@+,%a1@+
     962:	22d8           	movel %a0@+,%a1@+
     964:	22d8           	movel %a0@+,%a1@+
     966:	22d8           	movel %a0@+,%a1@+
     968:	22d8           	movel %a0@+,%a1@+
     96a:	22d8           	movel %a0@+,%a1@+
     96c:	6026           	bras 0x994
     96e:	2f0b           	movel %a3,%sp@-
     970:	2057           	moveal %sp@,%a0
     972:	2250           	moveal %a0@,%a1
     974:	2269 0028      	moveal %a1@(40),%a1
     978:	4e91           	jsr %a1@
     97a:	584f           	addqw #4,%sp
     97c:	6016           	bras 0x994
     97e:	2f2a 0006      	movel %a2@(6),%sp@-
     982:	2f0b           	movel %a3,%sp@-
     984:	2057           	moveal %sp@,%a0
     986:	2250           	moveal %a0@,%a1
     988:	2269 002c      	moveal %a1@(44),%a1
     98c:	4e91           	jsr %a1@
     98e:	504f           	addqw #8,%sp
     990:	6002           	bras 0x994
     992:	7600           	moveq #0,%d3
     994:	1003           	moveb %d3,%d0
     996:	6002           	bras 0x99a
     998:	7000           	moveq #0,%d0
     99a:	4cdf 0c08      	moveml %sp@+,%d3/%a2-%a3
     99e:	4e5e           	unlk %fp
     9a0:	4e75           	rts
     9a2:	802b 446f      	orb %a3@(17519),%d0
     9a6:	4d45           	.short 0x4d45
     9a8:	5341           	subqw #1,%d1
     9aa:	436f           	.short 0x436f
     9ac:	6d6d           	blts 0xa1b
     9ae:	616e           	bsrs 0xa1e
     9b0:	645f           	bccs 0xa11
     9b2:	5f31 3143 4d45 	subqb #7,%a1@(0)@(4d455341)
     9b8:	5341 
     9ba:	506c 7567      	addqw #8,%a4@(30055)
     9be:	496e           	.short 0x496e
     9c0:	4650           	notw %a0@
     9c2:	3131 4d45      	movew %a1@(0)@(0),%a0@-
     9c6:	5341           	subqw #1,%d1
     9c8:	436f           	.short 0x436f
     9ca:	6d6d           	blts 0xa39
     9cc:	616e           	bsrs 0xa3c
     9ce:	6400 0000      	bccw 0x9d0
     9d2:	4e56 0000      	linkw %fp,#0
     9d6:	48e7 1030      	moveml %d3/%a2-%a3,%sp@-
     9da:	246e 0008      	moveal %fp@(8),%a2
     9de:	266e 000c      	moveal %fp@(12),%a3
     9e2:	7600           	moveq #0,%d3
     9e4:	7032           	moveq #50,%d0
     9e6:	b0aa 0038      	cmpl %a2@(56),%d0
     9ea:	6f34           	bles 0xa20
     9ec:	202a 0038      	movel %a2@(56),%d0
     9f0:	52aa 0038      	addql #1,%a2@(56)
     9f4:	722e           	moveq #46,%d1
     9f6:	4eb9 0000 0116 	jsr 0x116
     9fc:	204a           	moveal %a2,%a0
     9fe:	d1c0           	addal %d0,%a0
     a00:	41e8 003c      	lea %a0@(60),%a0
     a04:	43d3           	lea %a3@,%a1
     a06:	20d9           	movel %a1@+,%a0@+
     a08:	20d9           	movel %a1@+,%a0@+
     a0a:	20d9           	movel %a1@+,%a0@+
     a0c:	20d9           	movel %a1@+,%a0@+
     a0e:	20d9           	movel %a1@+,%a0@+
     a10:	20d9           	movel %a1@+,%a0@+
     a12:	20d9           	movel %a1@+,%a0@+
     a14:	20d9           	movel %a1@+,%a0@+
     a16:	20d9           	movel %a1@+,%a0@+
     a18:	20d9           	movel %a1@+,%a0@+
     a1a:	20d9           	movel %a1@+,%a0@+
     a1c:	30d9           	movew %a1@+,%a0@+
     a1e:	6004           	bras 0xa24
     a20:	363c d507      	movew #-11001,%d3
     a24:	3003           	movew %d3,%d0
     a26:	4cdf 0c08      	moveml %sp@+,%d3/%a2-%a3
     a2a:	4e5e           	unlk %fp
     a2c:	4e75           	rts
     a2e:	802c 436f      	orb %a4@(17263),%d0
     a32:	6e6e           	bgts 0xaa2
     a34:	6563           	bcss 0xa99
     a36:	7454           	moveq #84,%d2
     a38:	6f53           	bles 0xa8d
     a3a:	6f63           	bles 0xa9f
     a3c:	6b65           	bmis 0xaa3
     a3e:	745f           	moveq #95,%d2
     a40:	5f31 3143 4d45 	subqb #7,%a1@(0)@(4d455341)
     a46:	5341 
     a48:	506c 7567      	addqw #8,%a4@(30055)
     a4c:	496e           	.short 0x496e
     a4e:	4650           	notw %a0@
     a50:	3130 536f 636b 	movew %a0@(636b)@(6574496e),%a0@-
     a56:	6574 496e 
     a5a:	666f           	bnes 0xacb
     a5c:	0000 4e56      	orib #86,%d0
     a60:	0000 2f0b      	orib #11,%d0
     a64:	226e 0008      	moveal %fp@(8),%a1
     a68:	266e 000c      	moveal %fp@(12),%a3
     a6c:	7200           	moveq #0,%d1
     a6e:	6034           	bras 0xaa4
     a70:	702e           	moveq #46,%d0
     a72:	c1c1           	mulsw %d1,%d0
     a74:	2031 0862      	movel %a1@(62,%d0:l),%d0
     a78:	b0ab 0026      	cmpl %a3@(38),%d0
     a7c:	6624           	bnes 0xaa2
     a7e:	702e           	moveq #46,%d0
     a80:	c1c1           	mulsw %d1,%d0
     a82:	33ab 0024 0860 	movew %a3@(36),%a1@(60,%d0:l)
     a88:	702e           	moveq #46,%d0
     a8a:	c1c1           	mulsw %d1,%d0
     a8c:	23ab 002a 0866 	movel %a3@(42),%a1@(66,%d0:l)
     a92:	702e           	moveq #46,%d0
     a94:	c1c1           	mulsw %d1,%d0
     a96:	2071 0866      	moveal %a1@(66,%d0:l),%a0
     a9a:	42a8 0010      	clrl %a0@(16)
     a9e:	7000           	moveq #0,%d0
     aa0:	600e           	bras 0xab0
     aa2:	5241           	addqw #1,%d1
     aa4:	3041           	moveaw %d1,%a0
     aa6:	b1e9 0038      	cmpal %a1@(56),%a0
     aaa:	6dc4           	blts 0xa70
     aac:	303c d504      	movew #-11004,%d0
     ab0:	265f           	moveal %sp@+,%a3
     ab2:	4e5e           	unlk %fp
     ab4:	4e75           	rts
     ab6:	802b 4163      	orb %a3@(16739),%d0
     aba:	7469           	moveq #105,%d2
     abc:	7661           	moveq #97,%d3
     abe:	7465           	moveq #101,%d2
     ac0:	536f 636b      	subqw #1,%sp@(25451)
     ac4:	6574           	bcss 0xb3a
     ac6:	5f5f           	subqw #7,%sp@+
     ac8:	3131 434d      	movew %a1@(0)@(0),%a0@-
     acc:	4553           	.short 0x4553
     ace:	4150           	.short 0x4150
     ad0:	6c75           	bges 0xb47
     ad2:	6749           	beqs 0xb1d
     ad4:	6e46           	bgts 0xb1c
     ad6:	5031 3053      	addqb #8,%a1@(53,%d3:w)
     ada:	6f63           	bles 0xb3f
     adc:	6b65           	bmis 0xb43
     ade:	7449           	moveq #73,%d2
     ae0:	6e66           	bgts 0xb48
     ae2:	6f00 0000      	blew 0xae4
     ae6:	4e56 fff6      	linkw %fp,#-10
     aea:	2f0a           	movel %a2,%sp@-
     aec:	246e 0008      	moveal %fp@(8),%a2
     af0:	4aaa 0004      	tstl %a2@(4)
     af4:	6724           	beqs 0xb1a
     af6:	41ec 01d2      	lea %a4@(466),%a0
     afa:	43ee fff6      	lea %fp@(-10),%a1
     afe:	22d8           	movel %a0@+,%a1@+
     b00:	22d8           	movel %a0@+,%a1@+
     b02:	32d8           	movew %a0@+,%a1@+
     b04:	7000           	moveq #0,%d0
     b06:	102e 000c      	moveb %fp@(12),%d0
     b0a:	2d40 fffc      	movel %d0,%fp@(-4)
     b0e:	486e fff6      	pea %fp@(-10)
     b12:	206a 0004      	moveal %a2@(4),%a0
     b16:	4e90           	jsr %a0@
     b18:	584f           	addqw #4,%sp
     b1a:	245f           	moveal %sp@+,%a2
     b1c:	4e5e           	unlk %fp
     b1e:	4e75           	rts
     b20:	9c42           	subw %d2,%d6
     b22:	7573           	.short 0x7573
     b24:	7943           	.short 0x7943
     b26:	7572           	.short 0x7572
     b28:	736f           	.short 0x736f
     b2a:	725f           	moveq #95,%d1
     b2c:	5f31 3143 4d45 	subqb #7,%a1@(0)@(4d455341)
     b32:	5341 
     b34:	506c 7567      	addqw #8,%a4@(30055)
     b38:	496e           	.short 0x496e
     b3a:	4655           	notw %a5@
     b3c:	6300 0000      	blsw 0xb3e
     b40:	4e56 fff0      	linkw %fp,#-16
     b44:	2f03           	movel %d3,%sp@-
     b46:	362e 000c      	movew %fp@(12),%d3
     b4a:	486e fff0      	pea %fp@(-16)
     b4e:	a976           	.short 0xa976
     b50:	3003           	movew %d3,%d0
     b52:	0240 0007      	andiw #7,%d0
     b56:	3203           	movew %d3,%d1
     b58:	e649           	lsrw #3,%d1
     b5a:	7400           	moveq #0,%d2
     b5c:	3401           	movew %d1,%d2
     b5e:	41ee fff0      	lea %fp@(-16),%a0
     b62:	7200           	moveq #0,%d1
     b64:	1230 2800      	moveb %a0@(0,%d2:l),%d1
     b68:	e061           	asrw %d0,%d1
     b6a:	0241 0001      	andiw #1,%d1
     b6e:	3001           	movew %d1,%d0
     b70:	261f           	movel %sp@+,%d3
     b72:	4e5e           	unlk %fp
     b74:	4e75           	rts
     b76:	9e4b           	subw %a3,%d7
     b78:	6579           	bcss 0xbf3
     b7a:	4973           	.short 0x4973
     b7c:	5072 6573 7365 	addqw #8,%a2@(7365645f)@(5f313143)
     b82:	645f 5f31 3143 
     b88:	4d45           	.short 0x4d45
     b8a:	5341           	subqw #1,%d1
     b8c:	506c 7567      	addqw #8,%a4@(30055)
     b90:	496e           	.short 0x496e
     b92:	4655           	notw %a5@
     b94:	7300           	.short 0x7300
     b96:	0000 4e56      	orib #86,%d0
     b9a:	0000 206e      	orib #110,%d0
     b9e:	0008           	.short 0x0008
     ba0:	41e8 0038      	lea %a0@(56),%a0
     ba4:	4e5e           	unlk %fp
     ba6:	4e75           	rts
     ba8:	9b47           	subxw %d7,%d5
     baa:	6574           	bcss 0xc20
     bac:	536f 636b      	subqw #1,%sp@(25451)
     bb0:	6574           	bcss 0xc26
     bb2:	735f           	.short 0x735f
     bb4:	5f31 3143 4d45 	subqb #7,%a1@(0)@(4d455341)
     bba:	5341 
     bbc:	506c 7567      	addqw #8,%a4@(30055)
     bc0:	496e           	.short 0x496e
     bc2:	4676 0000      	notw %fp@(0,%d0:w)
     bc6:	4e56 0000      	linkw %fp,#0
     bca:	2f0a           	movel %a2,%sp@-
     bcc:	2f03           	movel %d3,%sp@-
     bce:	246e 0008      	moveal %fp@(8),%a2
     bd2:	2f0a           	movel %a2,%sp@-
     bd4:	4eb9 0000 020e 	jsr 0x20e
     bda:	204a           	moveal %a2,%a0
     bdc:	4868 093a      	pea %a0@(2362)
     be0:	4eb9 0000 157e 	jsr 0x157e
     be6:	41ec 013c      	lea %a4@(316),%a0
     bea:	2488           	movel %a0,%a2@
     bec:	257c 5343 5349 	movel #1396921161,%a2@(8)
     bf2:	0008 
     bf4:	257c 5041 5343 	movel #1346458435,%a2@(12)
     bfa:	000c 
     bfc:	42aa 0d66      	clrl %a2@(3430)
     c00:	7000           	moveq #0,%d0
     c02:	3540 0d6c      	movew %d0,%a2@(3436)
     c06:	3540 0d6a      	movew %d0,%a2@(3434)
     c0a:	426a 0d6e      	clrw %a2@(3438)
     c0e:	203c 0000 8000 	movel #32768,%d0
     c14:	a322           	.short 0xa322
     c16:	2548 0e38      	movel %a0,%a2@(3640)
     c1a:	4aaa 0e38      	tstl %a2@(3640)
     c1e:	504f           	addqw #8,%sp
     c20:	6716           	beqs 0xc38
     c22:	206a 0e38      	moveal %a2@(3640),%a0
     c26:	a064           	.short 0xa064
     c28:	206a 0e38      	moveal %a2@(3640),%a0
     c2c:	a029           	.short 0xa029
     c2e:	206a 0e38      	moveal %a2@(3640),%a0
     c32:	2550 0e3c      	movel %a0@,%a2@(3644)
     c36:	6004           	bras 0xc3c
     c38:	42aa 0e3c      	clrl %a2@(3644)
     c3c:	7600           	moveq #0,%d3
     c3e:	6010           	bras 0xc50
     c40:	3043           	moveaw %d3,%a0
     c42:	2008           	movel %a0,%d0
     c44:	e588           	lsll #2,%d0
     c46:	204a           	moveal %a2,%a0
     c48:	d1c0           	addal %d0,%a0
     c4a:	42a8 0d70      	clrl %a0@(3440)
     c4e:	5243           	addqw #1,%d3
     c50:	0c43 0032      	cmpiw #50,%d3
     c54:	6dea           	blts 0xc40
     c56:	422a 0e40      	clrb %a2@(3648)
     c5a:	422a 0e46      	clrb %a2@(3654)
     c5e:	422a 0e47      	clrb %a2@(3655)
     c62:	257c 0000 0708 	movel #1800,%a2@(3650)
     c68:	0e42 
     c6a:	204a           	moveal %a2,%a0
     c6c:	261f           	movel %sp@+,%d3
     c6e:	245f           	moveal %sp@+,%a2
     c70:	4e5e           	unlk %fp
     c72:	4e75           	rts
     c74:	925f           	subw %sp@+,%d1
     c76:	5f63           	subqw #7,%a3@-
     c78:	745f           	moveq #95,%d2
     c7a:	5f39 4353 4353 	subqb #7,0x43534353
     c80:	4950           	.short 0x4950
     c82:	6c75           	bges 0xcf9
     c84:	6746           	beqs 0xccc
     c86:	7600           	moveq #0,%d3
     c88:	0000 4e56      	orib #86,%d0
     c8c:	0000 2f0a      	orib #10,%d0
     c90:	246e 0008      	moveal %fp@(8),%a2
     c94:	200a           	movel %a2,%d0
     c96:	672e           	beqs 0xcc6
     c98:	41ec 013c      	lea %a4@(316),%a0
     c9c:	2488           	movel %a0,%a2@
     c9e:	206a 0e38      	moveal %a2@(3640),%a0
     ca2:	a02a           	.short 0xa02a
     ca4:	206a 0e38      	moveal %a2@(3640),%a0
     ca8:	a023           	.short 0xa023
     caa:	4267           	clrw %sp@-
     cac:	2f0a           	movel %a2,%sp@-
     cae:	4eb9 0000 0274 	jsr 0x274
     cb4:	4a6e 000c      	tstw %fp@(12)
     cb8:	5c4f           	addqw #6,%sp
     cba:	6f0a           	bles 0xcc6
     cbc:	2f0a           	movel %a2,%sp@-
     cbe:	4eb9 0000 1b56 	jsr 0x1b56
     cc4:	584f           	addqw #4,%sp
     cc6:	204a           	moveal %a2,%a0
     cc8:	245f           	moveal %sp@+,%a2
     cca:	4e5e           	unlk %fp
     ccc:	4e75           	rts
     cce:	925f           	subw %sp@+,%d1
     cd0:	5f64           	subqw #7,%a4@-
     cd2:	745f           	moveq #95,%d2
     cd4:	5f39 4353 4353 	subqb #7,0x43534353
     cda:	4950           	.short 0x4950
     cdc:	6c75           	bges 0xd53
     cde:	6746           	beqs 0xd26
     ce0:	7600           	moveq #0,%d3
     ce2:	0000 4e56      	orib #86,%d0
     ce6:	0000 48e7      	orib #-25,%d0
     cea:	1030 266e      	moveb %a0@(6e,%d2:w:8),%d0
     cee:	0008           	.short 0x0008
     cf0:	246e 000c      	moveal %fp@(12),%a2
     cf4:	7601           	moveq #1,%d3
     cf6:	4aab 0004      	tstl %a3@(4)
     cfa:	675c           	beqs 0xd58
     cfc:	2012           	movel %a2@,%d0
     cfe:	0480 5348 4f57 	subil #1397247831,%d0
     d04:	6722           	beqs 0xd28
     d06:	0480 0100 fdf8 	subil #16842232,%d0
     d0c:	672e           	beqs 0xd3c
     d0e:	0480 000c 04f5 	subil #787701,%d0
     d14:	672e           	beqs 0xd44
     d16:	0480 00f8 f710 	subil #16316176,%d0
     d1c:	6702           	beqs 0xd20
     d1e:	602a           	bras 0xd4a
     d20:	376a 0008 0d6e 	movew %a2@(8),%a3@(3438)
     d26:	6030           	bras 0xd58
     d28:	2f2a 0006      	movel %a2@(6),%sp@-
     d2c:	2f0b           	movel %a3,%sp@-
     d2e:	4eb9 0000 1162 	jsr 0x1162
     d34:	3540 0004      	movew %d0,%a2@(4)
     d38:	504f           	addqw #8,%sp
     d3a:	601c           	bras 0xd58
     d3c:	276a 0006 0e42 	movel %a2@(6),%a3@(3650)
     d42:	6014           	bras 0xd58
     d44:	426a 0004      	clrw %a2@(4)
     d48:	600e           	bras 0xd58
     d4a:	2f0a           	movel %a2,%sp@-
     d4c:	2f0b           	movel %a3,%sp@-
     d4e:	4eb9 0000 02fc 	jsr 0x2fc
     d54:	1600           	moveb %d0,%d3
     d56:	504f           	addqw #8,%sp
     d58:	1003           	moveb %d3,%d0
     d5a:	4cdf 0c08      	moveml %sp@+,%d3/%a2-%a3
     d5e:	4e5e           	unlk %fp
     d60:	4e75           	rts
     d62:	8028 446f      	orb %a0@(17519),%d0
     d66:	4d45           	.short 0x4d45
     d68:	5341           	subqw #1,%d1
     d6a:	436f           	.short 0x436f
     d6c:	6d6d           	blts 0xddb
     d6e:	616e           	bsrs 0xdde
     d70:	645f           	bccs 0xdd1
     d72:	5f39 4353 4353 	subqb #7,0x43534353
     d78:	4950           	.short 0x4950
     d7a:	6c75           	bges 0xdf1
     d7c:	6746           	beqs 0xdc4
     d7e:	5031 314d      	addqb #8,%a1@(0)@(0)
     d82:	4553           	.short 0x4553
     d84:	4143           	.short 0x4143
     d86:	6f6d           	bles 0xdf5
     d88:	6d61           	blts 0xdeb
     d8a:	6e64           	bgts 0xdf0
     d8c:	0000 4e56      	orib #86,%d0
     d90:	0000 4e5e      	orib #94,%d0
     d94:	4e75           	rts
     d96:	924f           	subw %sp,%d1
     d98:	7065           	moveq #101,%d0
     d9a:	6e5f           	bgts 0xdfb
     d9c:	5f39 4353 4353 	subqb #7,0x43534353
     da2:	4950           	.short 0x4950
     da4:	6c75           	bges 0xe1b
     da6:	6746           	beqs 0xdee
     da8:	7600           	moveq #0,%d3
     daa:	0000 4e56      	orib #86,%d0
     dae:	0000 4e5e      	orib #94,%d0
     db2:	4e75           	rts
     db4:	9343           	subxw %d3,%d1
     db6:	6c6f           	bges 0xe27
     db8:	7365           	.short 0x7365
     dba:	5f5f           	subqw #7,%sp@+
     dbc:	3943 5343      	movew %d3,%a4@(21315)
     dc0:	5349           	subqw #1,%a1
     dc2:	506c 7567      	addqw #8,%a4@(30055)
     dc6:	4676 0000      	notw %fp@(0,%d0:w)
     dca:	4e56 0000      	linkw %fp,#0
     dce:	4e5e           	unlk %fp
     dd0:	4e75           	rts
     dd2:	9c44           	subw %d4,%d6
     dd4:	6f41           	bles 0xe17
     dd6:	626f           	bhis 0xe47
     dd8:	7574           	.short 0x7574
     dda:	546f 5175      	addqw #2,%sp@(20853)
     dde:	6974           	bvss 0xe54
     de0:	5f5f           	subqw #7,%sp@+
     de2:	3943 5343      	movew %d3,%a4@(21315)
     de6:	5349           	subqw #1,%a1
     de8:	506c 7567      	addqw #8,%a4@(30055)
     dec:	4650           	notw %a0@
     dee:	6c00 0000      	bgew 0xdf0
     df2:	4e56 ffd0      	linkw %fp,#-48
     df6:	48e7 1f30      	moveml %d3-%d7/%a2-%a3,%sp@-
     dfa:	246e 0008      	moveal %fp@(8),%a2
     dfe:	266e 000c      	moveal %fp@(12),%a3
     e02:	7600           	moveq #0,%d3
     e04:	426a 0d6e      	clrw %a2@(3438)
     e08:	7800           	moveq #0,%d4
     e0a:	6022           	bras 0xe2e
     e0c:	702e           	moveq #46,%d0
     e0e:	c1c4           	mulsw %d4,%d0
     e10:	2032 0862      	movel %a2@(62,%d0:l),%d0
     e14:	b0ab 000c      	cmpl %a3@(12),%d0
     e18:	6612           	bnes 0xe2c
     e1a:	3044           	moveaw %d4,%a0
     e1c:	2008           	movel %a0,%d0
     e1e:	e588           	lsll #2,%d0
     e20:	204a           	moveal %a2,%a0
     e22:	d1c0           	addal %d0,%a0
     e24:	3568 0d72 0d6e 	movew %a0@(3442),%a2@(3438)
     e2a:	600a           	bras 0xe36
     e2c:	5244           	addqw #1,%d4
     e2e:	3044           	moveaw %d4,%a0
     e30:	b1ea 0038      	cmpal %a2@(56),%a0
     e34:	6dd6           	blts 0xe0c
     e36:	4a6a 0d6e      	tstw %a2@(3438)
     e3a:	6608           	bnes 0xe44
     e3c:	303c c950      	movew #-14000,%d0
     e40:	6000 03d4      	braw 0x1216
     e44:	4a43           	tstw %d3
     e46:	6600 03cc      	bnew 0x1214
     e4a:	42ae ffe2      	clrl %fp@(-30)
     e4e:	202b 0008      	movel %a3@(8),%d0
     e52:	4eb9 0000 0148 	jsr 0x148
     e58:	0308 424f      	movepw %a0@(16975),%d1
     e5c:	4646           	notw %d6
     e5e:	5359           	subqw #1,%a1@+
     e60:	5358           	subqw #1,%a0@+
     e62:	0004 424f      	orib #79,%d4
     e66:	4646           	notw %d6
     e68:	001a 4255      	orib #85,%a2@+
     e6c:	4c4b           	.short 0x4c4b
     e6e:	0030 4d49 4449 	orib #73,%a0@(49,%d4:w:4)
     e74:	02a2 5352 4157 	andil #1397899607,%a2@-
     e7a:	0046 5359      	oriw #21337,%d6
     e7e:	5358           	subqw #1,%a0@+
     e80:	0246 4227      	andiw #16935,%d6
     e84:	4227           	clrb %sp@-
     e86:	3f2a 0d6e      	movew %a2@(3438),%sp@-
     e8a:	2f0a           	movel %a2,%sp@-
     e8c:	4eb9 0000 0ca2 	jsr 0xca2
     e92:	422a 0e40      	clrb %a2@(3648)
     e96:	4fef 000a      	lea %sp@(10),%sp
     e9a:	6000 02c4      	braw 0x1160
     e9e:	4a2a 0e40      	tstb %a2@(3648)
     ea2:	661c           	bnes 0xec0
     ea4:	1f3c 0001      	moveb #1,%sp@-
     ea8:	1f3c 0001      	moveb #1,%sp@-
     eac:	3f2a 0d6e      	movew %a2@(3438),%sp@-
     eb0:	2f0a           	movel %a2,%sp@-
     eb2:	4eb9 0000 0ca2 	jsr 0xca2
     eb8:	1540 0e40      	moveb %d0,%a2@(3648)
     ebc:	4fef 000a      	lea %sp@(10),%sp
     ec0:	4a2a 0e40      	tstb %a2@(3648)
     ec4:	6700 01ac      	beqw 0x1072
     ec8:	363c d505      	movew #-11003,%d3
     ecc:	2c2b 0004      	movel %a3@(4),%d6
     ed0:	666e           	bnes 0xf40
     ed2:	4a93           	tstl %a3@
     ed4:	666a           	bnes 0xf40
     ed6:	4227           	clrb %sp@-
     ed8:	3f2a 0d6e      	movew %a2@(3438),%sp@-
     edc:	2f0a           	movel %a2,%sp@-
     ede:	4eb9 0000 0d54 	jsr 0xd54
     ee4:	4a80           	tstl %d0
     ee6:	504f           	addqw #8,%sp
     ee8:	6750           	beqs 0xf3a
     eea:	486e ffe2      	pea %fp@(-30)
     eee:	4227           	clrb %sp@-
     ef0:	2f2a 0e3c      	movel %a2@(3644),%sp@-
     ef4:	3f2a 0d6e      	movew %a2@(3438),%sp@-
     ef8:	2f0a           	movel %a2,%sp@-
     efa:	4eb9 0000 0dfc 	jsr 0xdfc
     f00:	3600           	movew %d0,%d3
     f02:	4fef 0010      	lea %sp@(16),%sp
     f06:	662c           	bnes 0xf34
     f08:	206a 0e3c      	moveal %a2@(3644),%a0
     f0c:	0c10 00f0      	cmpib #-16,%a0@
     f10:	661a           	bnes 0xf2c
     f12:	206a 0e3c      	moveal %a2@(3644),%a0
     f16:	0c28 007e 0001 	cmpib #126,%a0@(1)
     f1c:	660e           	bnes 0xf2c
     f1e:	206a 0e3c      	moveal %a2@(3644),%a0
     f22:	7000           	moveq #0,%d0
     f24:	1028 0003      	moveb %a0@(3),%d0
     f28:	6000 02ec      	braw 0x1216
     f2c:	303c d505      	movew #-11003,%d0
     f30:	6000 02e4      	braw 0x1216
     f34:	3003           	movew %d3,%d0
     f36:	6000 02de      	braw 0x1216
     f3a:	707c           	moveq #124,%d0
     f3c:	6000 02d8      	braw 0x1216
     f40:	0cab 5352 4157 	cmpil #1397899607,%a3@(8)
     f46:	0008 
     f48:	6626           	bnes 0xf70
     f4a:	486e ffe2      	pea %fp@(-30)
     f4e:	2f13           	movel %a3@,%sp@-
     f50:	2f2a 0e3c      	movel %a2@(3644),%sp@-
     f54:	2f06           	movel %d6,%sp@-
     f56:	1f3c 0001      	moveb #1,%sp@-
     f5a:	3f2a 0d6e      	movew %a2@(3438),%sp@-
     f5e:	2f0a           	movel %a2,%sp@-
     f60:	4eb9 0000 106e 	jsr 0x106e
     f66:	3600           	movew %d0,%d3
     f68:	4fef 0018      	lea %sp@(24),%sp
     f6c:	6000 01f2      	braw 0x1160
     f70:	2046           	moveal %d6,%a0
     f72:	0c10 00f0      	cmpib #-16,%a0@
     f76:	6600 00f2      	bnew 0x106a
     f7a:	2046           	moveal %d6,%a0
     f7c:	0c28 0047 0001 	cmpib #71,%a0@(1)
     f82:	6600 00e6      	bnew 0x106a
     f86:	2046           	moveal %d6,%a0
     f88:	0c28 0048 0004 	cmpib #72,%a0@(4)
     f8e:	6600 00da      	bnew 0x106a
     f92:	2046           	moveal %d6,%a0
     f94:	7000           	moveq #0,%d0
     f96:	1028 0003      	moveb %a0@(3),%d0
     f9a:	0440 000b      	subiw #11,%d0
     f9e:	6708           	beqs 0xfa8
     fa0:	5340           	subqw #1,%d0
     fa2:	6728           	beqs 0xfcc
     fa4:	6000 01ba      	braw 0x1160
     fa8:	486e ffe2      	pea %fp@(-30)
     fac:	2f13           	movel %a3@,%sp@-
     fae:	2f2a 0e3c      	movel %a2@(3644),%sp@-
     fb2:	2f06           	movel %d6,%sp@-
     fb4:	4227           	clrb %sp@-
     fb6:	3f2a 0d6e      	movew %a2@(3438),%sp@-
     fba:	2f0a           	movel %a2,%sp@-
     fbc:	4eb9 0000 106e 	jsr 0x106e
     fc2:	3600           	movew %d0,%d3
     fc4:	4fef 0018      	lea %sp@(24),%sp
     fc8:	6000 0196      	braw 0x1160
     fcc:	2046           	moveal %d6,%a0
     fce:	7000           	moveq #0,%d0
     fd0:	1028 000e      	moveb %a0@(14),%d0
     fd4:	2d40 ffda      	movel %d0,%fp@(-38)
     fd8:	202e ffda      	movel %fp@(-38),%d0
     fdc:	ef88           	lsll #7,%d0
     fde:	2d40 ffda      	movel %d0,%fp@(-38)
     fe2:	2046           	moveal %d6,%a0
     fe4:	7000           	moveq #0,%d0
     fe6:	1028 000d      	moveb %a0@(13),%d0
     fea:	d1ae ffda      	addl %d0,%fp@(-38)
     fee:	202e ffda      	movel %fp@(-38),%d0
     ff2:	ef88           	lsll #7,%d0
     ff4:	2d40 ffda      	movel %d0,%fp@(-38)
     ff8:	2046           	moveal %d6,%a0
     ffa:	7000           	moveq #0,%d0
     ffc:	1028 000c      	moveb %a0@(12),%d0
    1000:	d1ae ffda      	addl %d0,%fp@(-38)
    1004:	202e ffda      	movel %fp@(-38),%d0
    1008:	ef88           	lsll #7,%d0
    100a:	2d40 ffda      	movel %d0,%fp@(-38)
    100e:	2046           	moveal %d6,%a0
    1010:	7000           	moveq #0,%d0
    1012:	1028 000b      	moveb %a0@(11),%d0
    1016:	d1ae ffda      	addl %d0,%fp@(-38)
    101a:	486e ffe2      	pea %fp@(-30)
    101e:	2f13           	movel %a3@,%sp@-
    1020:	42a7           	clrl %sp@-
    1022:	2f06           	movel %d6,%sp@-
    1024:	4227           	clrb %sp@-
    1026:	3f2a 0d6e      	movew %a2@(3438),%sp@-
    102a:	2f0a           	movel %a2,%sp@-
    102c:	4eb9 0000 106e 	jsr 0x106e
    1032:	3600           	movew %d0,%d3
    1034:	202e ffda      	movel %fp@(-38),%d0
    1038:	d080           	addl %d0,%d0
    103a:	2d40 ffe2      	movel %d0,%fp@(-30)
    103e:	4a43           	tstw %d3
    1040:	4fef 0018      	lea %sp@(24),%sp
    1044:	6600 011a      	bnew 0x1160
    1048:	486e ffe2      	pea %fp@(-30)
    104c:	1f3c 0001      	moveb #1,%sp@-
    1050:	2f2a 0e3c      	movel %a2@(3644),%sp@-
    1054:	3f2a 0d6e      	movew %a2@(3438),%sp@-
    1058:	2f0a           	movel %a2,%sp@-
    105a:	4eb9 0000 0dfc 	jsr 0xdfc
    1060:	3600           	movew %d0,%d3
    1062:	4fef 0010      	lea %sp@(16),%sp
    1066:	6000 00f8      	braw 0x1160
    106a:	363c d505      	movew #-11003,%d3
    106e:	6000 00f0      	braw 0x1160
    1072:	2d6b 0004 ffd2 	movel %a3@(4),%fp@(-46)
    1078:	157c 0001 0e46 	moveb #1,%a2@(3654)
    107e:	206e ffd2      	moveal %fp@(-46),%a0
    1082:	0810 0007      	btst #7,%a0@
    1086:	6708           	beqs 0x1090
    1088:	1d7c 0001 ffd1 	moveb #1,%fp@(-47)
    108e:	6004           	bras 0x1094
    1090:	422e ffd1      	clrb %fp@(-47)
    1094:	156e ffd1 0e47 	moveb %fp@(-47),%a2@(3655)
    109a:	486e ffe2      	pea %fp@(-30)
    109e:	2f13           	movel %a3@,%sp@-
    10a0:	2f2a 0e3c      	movel %a2@(3644),%sp@-
    10a4:	2f2e ffd2      	movel %fp@(-46),%sp@-
    10a8:	1f3c 0001      	moveb #1,%sp@-
    10ac:	3f2a 0d6e      	movew %a2@(3438),%sp@-
    10b0:	2f0a           	movel %a2,%sp@-
    10b2:	4eb9 0000 106e 	jsr 0x106e
    10b8:	3600           	movew %d0,%d3
    10ba:	422a 0e46      	clrb %a2@(3654)
    10be:	4fef 0018      	lea %sp@(24),%sp
    10c2:	6000 009c      	braw 0x1160
    10c6:	4227           	clrb %sp@-
    10c8:	1f3c 0001      	moveb #1,%sp@-
    10cc:	3f2a 0d6e      	movew %a2@(3438),%sp@-
    10d0:	2f0a           	movel %a2,%sp@-
    10d2:	4eb9 0000 0ca2 	jsr 0xca2
    10d8:	4a00           	tstb %d0
    10da:	4fef 000a      	lea %sp@(10),%sp
    10de:	6700 0080      	beqw 0x1160
    10e2:	486e ffe2      	pea %fp@(-30)
    10e6:	2f13           	movel %a3@,%sp@-
    10e8:	2f2a 0e3c      	movel %a2@(3644),%sp@-
    10ec:	2f2b 0004      	movel %a3@(4),%sp@-
    10f0:	4227           	clrb %sp@-
    10f2:	3f2a 0d6e      	movew %a2@(3438),%sp@-
    10f6:	2f0a           	movel %a2,%sp@-
    10f8:	4eb9 0000 106e 	jsr 0x106e
    10fe:	3600           	movew %d0,%d3
    1100:	4227           	clrb %sp@-
    1102:	4227           	clrb %sp@-
    1104:	3f2a 0d6e      	movew %a2@(3438),%sp@-
    1108:	2f0a           	movel %a2,%sp@-
    110a:	4eb9 0000 0ca2 	jsr 0xca2
    1110:	4fef 0022      	lea %sp@(34),%sp
    1114:	604a           	bras 0x1160
    1116:	4227           	clrb %sp@-
    1118:	1f3c 0001      	moveb #1,%sp@-
    111c:	3f2a 0d6e      	movew %a2@(3438),%sp@-
    1120:	2f0a           	movel %a2,%sp@-
    1122:	4eb9 0000 0ca2 	jsr 0xca2
    1128:	4a00           	tstb %d0
    112a:	4fef 000a      	lea %sp@(10),%sp
    112e:	6730           	beqs 0x1160
    1130:	486e ffe2      	pea %fp@(-30)
    1134:	2f13           	movel %a3@,%sp@-
    1136:	42a7           	clrl %sp@-
    1138:	2f2b 0004      	movel %a3@(4),%sp@-
    113c:	4227           	clrb %sp@-
    113e:	3f2a 0d6e      	movew %a2@(3438),%sp@-
    1142:	2f0a           	movel %a2,%sp@-
    1144:	4eb9 0000 106e 	jsr 0x106e
    114a:	3600           	movew %d0,%d3
    114c:	4227           	clrb %sp@-
    114e:	4227           	clrb %sp@-
    1150:	3f2a 0d6e      	movew %a2@(3438),%sp@-
    1154:	2f0a           	movel %a2,%sp@-
    1156:	4eb9 0000 0ca2 	jsr 0xca2
    115c:	4fef 0022      	lea %sp@(34),%sp
    1160:	4a43           	tstw %d3
    1162:	6600 00b0      	bnew 0x1214
    1166:	4aae ffe2      	tstl %fp@(-30)
    116a:	6700 00a8      	beqw 0x1214
    116e:	2f0a           	movel %a2,%sp@-
    1170:	2057           	moveal %sp@,%a0
    1172:	2250           	moveal %a0@,%a1
    1174:	2269 0018      	moveal %a1@(24),%a1
    1178:	4e91           	jsr %a1@
    117a:	2d48 ffd6      	movel %a0,%fp@(-42)
    117e:	7e00           	moveq #0,%d7
    1180:	584f           	addqw #4,%sp
    1182:	6000 0084      	braw 0x1208
    1186:	702e           	moveq #46,%d0
    1188:	c1c7           	mulsw %d7,%d0
    118a:	206e ffd6      	moveal %fp@(-42),%a0
    118e:	d1c0           	addal %d0,%a0
    1190:	5888           	addql #4,%a0
    1192:	2a08           	movel %a0,%d5
    1194:	2045           	moveal %d5,%a0
    1196:	4a68 0024      	tstw %a0@(36)
    119a:	676a           	beqs 0x1206
    119c:	41ec 018a      	lea %a4@(394),%a0
    11a0:	43ee fff0      	lea %fp@(-16),%a1
    11a4:	22d8           	movel %a0@+,%a1@+
    11a6:	22d8           	movel %a0@+,%a1@+
    11a8:	22d8           	movel %a0@+,%a1@+
    11aa:	22d8           	movel %a0@+,%a1@+
    11ac:	2d6e ffe2 fff0 	movel %fp@(-30),%fp@(-16)
    11b2:	2d6a 0e3c fff4 	movel %a2@(3644),%fp@(-12)
    11b8:	206a 0e3c      	moveal %a2@(3644),%a0
    11bc:	0c10 00f0      	cmpib #-16,%a0@
    11c0:	660a           	bnes 0x11cc
    11c2:	2d7c 5359 5358 	movel #1398362968,%fp@(-34)
    11c8:	ffde 
    11ca:	6008           	bras 0x11d4
    11cc:	2d7c 5352 4157 	movel #1397899607,%fp@(-34)
    11d2:	ffde 
    11d4:	2d6e ffde fff8 	movel %fp@(-34),%fp@(-8)
    11da:	41ec 0180      	lea %a4@(384),%a0
    11de:	43ee ffe6      	lea %fp@(-26),%a1
    11e2:	22d8           	movel %a0@+,%a1@+
    11e4:	22d8           	movel %a0@+,%a1@+
    11e6:	32d8           	movew %a0@+,%a1@+
    11e8:	41ee fff0      	lea %fp@(-16),%a0
    11ec:	2d48 ffec      	movel %a0,%fp@(-20)
    11f0:	2045           	moveal %d5,%a0
    11f2:	4a90           	tstl %a0@
    11f4:	670c           	beqs 0x1202
    11f6:	486e ffe6      	pea %fp@(-26)
    11fa:	2045           	moveal %d5,%a0
    11fc:	2050           	moveal %a0@,%a0
    11fe:	4e90           	jsr %a0@
    1200:	584f           	addqw #4,%sp
    1202:	362e ffea      	movew %fp@(-22),%d3
    1206:	5247           	addqw #1,%d7
    1208:	206e ffd6      	moveal %fp@(-42),%a0
    120c:	3247           	moveaw %d7,%a1
    120e:	b3d0           	cmpal %a0@,%a1
    1210:	6d00 ff74      	bltw 0x1186
    1214:	3003           	movew %d3,%d0
    1216:	4cdf 0cf8      	moveml %sp@+,%d3-%d7/%a2-%a3
    121a:	4e5e           	unlk %fp
    121c:	4e75           	rts
    121e:	9e53           	subw %a3@,%d7
    1220:	656e           	bcss 0x1290
    1222:	6444           	bccs 0x1268
    1224:	6174           	bsrs 0x129a
    1226:	615f           	bsrs 0x1287
    1228:	5f39 4353 4353 	subqb #7,0x43534353
    122e:	4950           	.short 0x4950
    1230:	6c75           	bges 0x12a7
    1232:	6746           	beqs 0x127a
    1234:	5037 4950      	addqb #8,%sp@(0)
    1238:	5f44           	subqw #7,%d4
    123a:	6174           	bsrs 0x12b0
    123c:	6100 0000      	bsrw 0x123e
    1240:	4e56 fffa      	linkw %fp,#-6
    1244:	48e7 1f20      	moveml %d3-%d7/%a2,%sp@-
    1248:	246e 0008      	moveal %fp@(8),%a2
    124c:	3e2e 000c      	movew %fp@(12),%d7
    1250:	7600           	moveq #0,%d3
    1252:	2d6c 017a fffa 	movel %a4@(378),%fp@(-6)
    1258:	3d6c 017e fffe 	movew %a4@(382),%fp@(-2)
    125e:	7600           	moveq #0,%d3
    1260:	4a2e 000e      	tstb %fp@(14)
    1264:	6704           	beqs 0x126a
    1266:	7801           	moveq #1,%d4
    1268:	6002           	bras 0x126c
    126a:	7800           	moveq #0,%d4
    126c:	1d44 fffc      	moveb %d4,%fp@(-4)
    1270:	4a2e 0010      	tstb %fp@(16)
    1274:	6704           	beqs 0x127a
    1276:	7a01           	moveq #1,%d5
    1278:	6002           	bras 0x127c
    127a:	7a00           	moveq #0,%d5
    127c:	1d45 fffd      	moveb %d5,%fp@(-3)
    1280:	3f07           	movew %d7,%sp@-
    1282:	486a 093a      	pea %a2@(2362)
    1286:	4eb9 0000 187e 	jsr 0x187e
    128c:	4a00           	tstb %d0
    128e:	5c4f           	addqw #6,%sp
    1290:	6722           	beqs 0x12b4
    1292:	4267           	clrw %sp@-
    1294:	4878 03e8      	pea 0x3e8
    1298:	42a7           	clrl %sp@-
    129a:	42a7           	clrl %sp@-
    129c:	486e fffa      	pea %fp@(-6)
    12a0:	3f07           	movew %d7,%sp@-
    12a2:	486a 093a      	pea %a2@(2362)
    12a6:	4eb9 0000 1620 	jsr 0x1620
    12ac:	3600           	movew %d0,%d3
    12ae:	4fef 0018      	lea %sp@(24),%sp
    12b2:	6004           	bras 0x12b8
    12b4:	7000           	moveq #0,%d0
    12b6:	600c           	bras 0x12c4
    12b8:	4a43           	tstw %d3
    12ba:	6604           	bnes 0x12c0
    12bc:	7c01           	moveq #1,%d6
    12be:	6002           	bras 0x12c2
    12c0:	7c00           	moveq #0,%d6
    12c2:	1006           	moveb %d6,%d0
    12c4:	4cdf 04f8      	moveml %sp@+,%d3-%d7/%a2
    12c8:	4e5e           	unlk %fp
    12ca:	4e75           	rts
    12cc:	8021           	orb %a1@-,%d0
    12ce:	5365           	subqw #1,%a5@-
    12d0:	7453           	moveq #83,%d2
    12d2:	4353           	.short 0x4353
    12d4:	494d           	.short 0x494d
    12d6:	4944           	.short 0x4944
    12d8:	494d           	.short 0x494d
    12da:	6f64           	bles 0x1340
    12dc:	655f           	bcss 0x133d
    12de:	5f39 4353 4353 	subqb #7,0x43534353
    12e4:	4950           	.short 0x4950
    12e6:	6c75           	bges 0x135d
    12e8:	6746           	beqs 0x1330
    12ea:	7355           	.short 0x7355
    12ec:	6355           	blss 0x1343
    12ee:	6300 0000      	blsw 0x12f0
    12f2:	4e56 fff6      	linkw %fp,#-10
    12f6:	48e7 1820      	moveml %d3-%d4/%a2,%sp@-
    12fa:	246e 0008      	moveal %fp@(8),%a2
    12fe:	7600           	moveq #0,%d3
    1300:	2d6c 0174 fff6 	movel %a4@(372),%fp@(-10)
    1306:	3d6c 0178 fffa 	movew %a4@(376),%fp@(-6)
    130c:	4a2e 000e      	tstb %fp@(14)
    1310:	6706           	beqs 0x1318
    1312:	383c 0080      	movew #128,%d4
    1316:	6002           	bras 0x131a
    1318:	7800           	moveq #0,%d4
    131a:	1d44 fffb      	moveb %d4,%fp@(-5)
    131e:	3f3c 0001      	movew #1,%sp@-
    1322:	4878 03e8      	pea 0x3e8
    1326:	4878 0003      	pea 0x3
    132a:	486e fffc      	pea %fp@(-4)
    132e:	486e fff6      	pea %fp@(-10)
    1332:	3f2e 000c      	movew %fp@(12),%sp@-
    1336:	486a 093a      	pea %a2@(2362)
    133a:	4eb9 0000 1620 	jsr 0x1620
    1340:	4aaa 0d66      	tstl %a2@(3430)
    1344:	4fef 0018      	lea %sp@(24),%sp
    1348:	661e           	bnes 0x1368
    134a:	7600           	moveq #0,%d3
    134c:	162e fffc      	moveb %fp@(-4),%d3
    1350:	e18b           	lsll #8,%d3
    1352:	7000           	moveq #0,%d0
    1354:	102e fffd      	moveb %fp@(-3),%d0
    1358:	d680           	addl %d0,%d3
    135a:	e18b           	lsll #8,%d3
    135c:	7000           	moveq #0,%d0
    135e:	102e fffe      	moveb %fp@(-2),%d0
    1362:	d680           	addl %d0,%d3
    1364:	2003           	movel %d3,%d0
    1366:	6004           	bras 0x136c
    1368:	202a 0d66      	movel %a2@(3430),%d0
    136c:	4cdf 0418      	moveml %sp@+,%d3-%d4/%a2
    1370:	4e5e           	unlk %fp
    1372:	4e75           	rts
    1374:	8021           	orb %a1@-,%d0
    1376:	534d           	subqw #1,%a5
    1378:	4461           	negw %a1@-
    137a:	7461           	moveq #97,%d2
    137c:	4279 7465 456e 	clrw 0x7465456e
    1382:	7175           	.short 0x7175
    1384:	6972           	bvss 0x13f8
    1386:	795f           	.short 0x795f
    1388:	5f39 4353 4353 	subqb #7,0x43534353
    138e:	4950           	.short 0x4950
    1390:	6c75           	bges 0x1407
    1392:	6746           	beqs 0x13da
    1394:	7355           	.short 0x7355
    1396:	6300 0000      	blsw 0x1398
    139a:	4e56 fff0      	linkw %fp,#-16
    139e:	48e7 1f30      	moveml %d3-%d7/%a2-%a3,%sp@-
    13a2:	246e 0008      	moveal %fp@(8),%a2
    13a6:	382e 000c      	movew %fp@(12),%d4
    13aa:	7c00           	moveq #0,%d6
    13ac:	594f           	subqw #4,%sp
    13ae:	a975           	.short 0xa975
    13b0:	201f           	movel %sp@+,%d0
    13b2:	2a00           	movel %d0,%d5
    13b4:	4a2a 0e46      	tstb %a2@(3654)
    13b8:	670c           	beqs 0x13c6
    13ba:	4a2a 0e47      	tstb %a2@(3655)
    13be:	6606           	bnes 0x13c6
    13c0:	7000           	moveq #0,%d0
    13c2:	6000 0218      	braw 0x15dc
    13c6:	266e 000e      	moveal %fp@(14),%a3
    13ca:	1d7c 000e fffa 	moveb #14,%fp@(-6)
    13d0:	422e fffb      	clrb %fp@(-5)
    13d4:	4a2e 0012      	tstb %fp@(18)
    13d8:	6708           	beqs 0x13e2
    13da:	3d7c 0080 fff0 	movew #128,%fp@(-16)
    13e0:	6004           	bras 0x13e6
    13e2:	426e fff0      	clrw %fp@(-16)
    13e6:	1d6e fff1 ffff 	moveb %fp@(-15),%fp@(-1)
    13ec:	4a2e 0012      	tstb %fp@(18)
    13f0:	6700 00fe      	beqw 0x14f0
    13f4:	206e 0014      	moveal %fp@(20),%a0
    13f8:	2d50 fff2      	movel %a0@,%fp@(-14)
    13fc:	42ae fff6      	clrl %fp@(-10)
    1400:	7e00           	moveq #0,%d7
    1402:	2607           	movel %d7,%d3
    1404:	6000 00c6      	braw 0x14cc
    1408:	594f           	subqw #4,%sp
    140a:	a975           	.short 0xa975
    140c:	201f           	movel %sp@+,%d0
    140e:	9085           	subl %d5,%d0
    1410:	b0aa 0e42      	cmpl %a2@(3650),%d0
    1414:	6308           	blss 0x141e
    1416:	303c c946      	movew #-14010,%d0
    141a:	6000 01c0      	braw 0x15dc
    141e:	3f3c 0037      	movew #55,%sp@-
    1422:	2f0a           	movel %a2,%sp@-
    1424:	2057           	moveal %sp@,%a0
    1426:	2250           	moveal %a0@,%a1
    1428:	2269 0020      	moveal %a1@(32),%a1
    142c:	4e91           	jsr %a1@
    142e:	4a40           	tstw %d0
    1430:	5c4f           	addqw #6,%sp
    1432:	671e           	beqs 0x1452
    1434:	3f3c 002f      	movew #47,%sp@-
    1438:	2f0a           	movel %a2,%sp@-
    143a:	2057           	moveal %sp@,%a0
    143c:	2250           	moveal %a0@,%a1
    143e:	2269 0020      	moveal %a1@(32),%a1
    1442:	4e91           	jsr %a1@
    1444:	4a40           	tstw %d0
    1446:	5c4f           	addqw #6,%sp
    1448:	6708           	beqs 0x1452
    144a:	303c c948      	movew #-14008,%d0
    144e:	6000 018c      	braw 0x15dc
    1452:	1f3c 0001      	moveb #1,%sp@-
    1456:	3f04           	movew %d4,%sp@-
    1458:	2f0a           	movel %a2,%sp@-
    145a:	4eba fe96      	jsr %pc@(0x12f2)
    145e:	2600           	movel %d0,%d3
    1460:	504f           	addqw #8,%sp
    1462:	6604           	bnes 0x1468
    1464:	4a46           	tstw %d6
    1466:	67a0           	beqs 0x1408
    1468:	4a83           	tstl %d3
    146a:	6754           	beqs 0x14c0
    146c:	2e03           	movel %d3,%d7
    146e:	2007           	movel %d7,%d0
    1470:	0280 0000 00ff 	andil #255,%d0
    1476:	1d40 fffe      	moveb %d0,%fp@(-2)
    147a:	e087           	asrl #8,%d7
    147c:	2007           	movel %d7,%d0
    147e:	0280 0000 00ff 	andil #255,%d0
    1484:	1d40 fffd      	moveb %d0,%fp@(-3)
    1488:	e087           	asrl #8,%d7
    148a:	2007           	movel %d7,%d0
    148c:	0280 0000 00ff 	andil #255,%d0
    1492:	1d40 fffc      	moveb %d0,%fp@(-4)
    1496:	3f3c 0001      	movew #1,%sp@-
    149a:	4878 03e8      	pea 0x3e8
    149e:	2f03           	movel %d3,%sp@-
    14a0:	2f0b           	movel %a3,%sp@-
    14a2:	486e fffa      	pea %fp@(-6)
    14a6:	3f04           	movew %d4,%sp@-
    14a8:	486a 093a      	pea %a2@(2362)
    14ac:	4eb9 0000 1620 	jsr 0x1620
    14b2:	3c00           	movew %d0,%d6
    14b4:	4fef 0018      	lea %sp@(24),%sp
    14b8:	6606           	bnes 0x14c0
    14ba:	d7ae fff6      	addl %d3,%fp@(-10)
    14be:	d7c3           	addal %d3,%a3
    14c0:	4a2a 0e46      	tstb %a2@(3654)
    14c4:	6706           	beqs 0x14cc
    14c6:	4aae fff6      	tstl %fp@(-10)
    14ca:	6616           	bnes 0x14e2
    14cc:	202e fff6      	movel %fp@(-10),%d0
    14d0:	b0ae fff2      	cmpl %fp@(-14),%d0
    14d4:	6d06           	blts 0x14dc
    14d6:	4a2a 0e46      	tstb %a2@(3654)
    14da:	6706           	beqs 0x14e2
    14dc:	4a46           	tstw %d6
    14de:	6700 ff28      	beqw 0x1408
    14e2:	206e 0014      	moveal %fp@(20),%a0
    14e6:	20ae fff6      	movel %fp@(-10),%a0@
    14ea:	3006           	movew %d6,%d0
    14ec:	6000 00ee      	braw 0x15dc
    14f0:	3f04           	movew %d4,%sp@-
    14f2:	486a 093a      	pea %a2@(2362)
    14f6:	4eb9 0000 187e 	jsr 0x187e
    14fc:	4a00           	tstb %d0
    14fe:	5c4f           	addqw #6,%sp
    1500:	6700 00d4      	beqw 0x15d6
    1504:	206e 0014      	moveal %fp@(20),%a0
    1508:	4290           	clrl %a0@
    150a:	4227           	clrb %sp@-
    150c:	3f04           	movew %d4,%sp@-
    150e:	2f0a           	movel %a2,%sp@-
    1510:	4eba fde0      	jsr %pc@(0x12f2)
    1514:	2600           	movel %d0,%d3
    1516:	3f3c 0037      	movew #55,%sp@-
    151a:	2f0a           	movel %a2,%sp@-
    151c:	2057           	moveal %sp@,%a0
    151e:	2250           	moveal %a0@,%a1
    1520:	2269 0020      	moveal %a1@(32),%a1
    1524:	4e91           	jsr %a1@
    1526:	4a40           	tstw %d0
    1528:	4fef 000e      	lea %sp@(14),%sp
    152c:	671e           	beqs 0x154c
    152e:	3f3c 002f      	movew #47,%sp@-
    1532:	2f0a           	movel %a2,%sp@-
    1534:	2057           	moveal %sp@,%a0
    1536:	2250           	moveal %a0@,%a1
    1538:	2269 0020      	moveal %a1@(32),%a1
    153c:	4e91           	jsr %a1@
    153e:	4a40           	tstw %d0
    1540:	5c4f           	addqw #6,%sp
    1542:	6708           	beqs 0x154c
    1544:	303c c948      	movew #-14008,%d0
    1548:	6000 0092      	braw 0x15dc
    154c:	594f           	subqw #4,%sp
    154e:	a975           	.short 0xa975
    1550:	201f           	movel %sp@+,%d0
    1552:	9085           	subl %d5,%d0
    1554:	b0aa 0e42      	cmpl %a2@(3650),%d0
    1558:	630a           	blss 0x1564
    155a:	263c ffff c946 	movel #-14010,%d3
    1560:	2543 0d66      	movel %d3,%a2@(3430)
    1564:	4a83           	tstl %d3
    1566:	6c06           	bges 0x156e
    1568:	302a 0d68      	movew %a2@(3432),%d0
    156c:	606e           	bras 0x15dc
    156e:	4a83           	tstl %d3
    1570:	6f98           	bles 0x150a
    1572:	206e 0014      	moveal %fp@(20),%a0
    1576:	d790           	addl %d3,%a0@
    1578:	2e03           	movel %d3,%d7
    157a:	2007           	movel %d7,%d0
    157c:	0280 0000 00ff 	andil #255,%d0
    1582:	1d40 fffe      	moveb %d0,%fp@(-2)
    1586:	e087           	asrl #8,%d7
    1588:	2007           	movel %d7,%d0
    158a:	0280 0000 00ff 	andil #255,%d0
    1590:	1d40 fffd      	moveb %d0,%fp@(-3)
    1594:	e087           	asrl #8,%d7
    1596:	2007           	movel %d7,%d0
    1598:	0280 0000 00ff 	andil #255,%d0
    159e:	1d40 fffc      	moveb %d0,%fp@(-4)
    15a2:	3f3c 0001      	movew #1,%sp@-
    15a6:	4878 03e8      	pea 0x3e8
    15aa:	2f03           	movel %d3,%sp@-
    15ac:	2f0b           	movel %a3,%sp@-
    15ae:	486e fffa      	pea %fp@(-6)
    15b2:	3f04           	movew %d4,%sp@-
    15b4:	486a 093a      	pea %a2@(2362)
    15b8:	4eb9 0000 1620 	jsr 0x1620
    15be:	3c00           	movew %d0,%d6
    15c0:	d7c3           	addal %d3,%a3
    15c2:	4a46           	tstw %d6
    15c4:	4fef 0018      	lea %sp@(24),%sp
    15c8:	6610           	bnes 0x15da
    15ca:	0c2b 00f7 ffff 	cmpib #-9,%a3@(-1)
    15d0:	6600 ff38      	bnew 0x150a
    15d4:	6004           	bras 0x15da
    15d6:	3c3c c948      	movew #-14008,%d6
    15da:	3006           	movew %d6,%d0
    15dc:	4cdf 0cf8      	moveml %sp@+,%d3-%d7/%a2-%a3
    15e0:	4e5e           	unlk %fp
    15e2:	4e75           	rts
    15e4:	8024           	orb %a4@-,%d0
    15e6:	534d           	subqw #1,%a5
    15e8:	4469 7370      	negw %a1@(29552)
    15ec:	6174           	bsrs 0x1662
    15ee:	6368           	blss 0x1658
    15f0:	5265           	addqw #1,%a5@-
    15f2:	706c           	moveq #108,%d0
    15f4:	795f           	.short 0x795f
    15f6:	5f39 4353 4353 	subqb #7,0x43534353
    15fc:	4950           	.short 0x4950
    15fe:	6c75           	bges 0x1675
    1600:	6746           	beqs 0x1648
    1602:	7350           	.short 0x7350
    1604:	5563           	subqw #2,%a3@-
    1606:	5563           	subqw #2,%a3@-
    1608:	506c 0000      	addqw #8,%a4@(0)
    160c:	4e56 fffa      	linkw %fp,#-6
    1610:	48e7 1f30      	moveml %d3-%d7/%a2-%a3,%sp@-
    1614:	246e 0008      	moveal %fp@(8),%a2
    1618:	3c2e 000c      	movew %fp@(12),%d6
    161c:	2e2e 0018      	movel %fp@(24),%d7
    1620:	266e 001c      	moveal %fp@(28),%a3
    1624:	7800           	moveq #0,%d4
    1626:	4293           	clrl %a3@
    1628:	3f06           	movew %d6,%sp@-
    162a:	486a 093a      	pea %a2@(2362)
    162e:	4eb9 0000 187e 	jsr 0x187e
    1634:	4a00           	tstb %d0
    1636:	5c4f           	addqw #6,%sp
    1638:	6700 008e      	beqw 0x16c8
    163c:	1d7c 000c fffa 	moveb #12,%fp@(-6)
    1642:	422e fffb      	clrb %fp@(-5)
    1646:	2607           	movel %d7,%d3
    1648:	2003           	movel %d3,%d0
    164a:	0280 0000 00ff 	andil #255,%d0
    1650:	1d40 fffe      	moveb %d0,%fp@(-2)
    1654:	e083           	asrl #8,%d3
    1656:	2003           	movel %d3,%d0
    1658:	0280 0000 00ff 	andil #255,%d0
    165e:	1d40 fffd      	moveb %d0,%fp@(-3)
    1662:	e083           	asrl #8,%d3
    1664:	2003           	movel %d3,%d0
    1666:	0280 0000 00ff 	andil #255,%d0
    166c:	1d40 fffc      	moveb %d0,%fp@(-4)
    1670:	4a2e 000e      	tstb %fp@(14)
    1674:	6706           	beqs 0x167c
    1676:	3a3c 0080      	movew #128,%d5
    167a:	6002           	bras 0x167e
    167c:	7a00           	moveq #0,%d5
    167e:	1d45 ffff      	moveb %d5,%fp@(-1)
    1682:	3f3c 0002      	movew #2,%sp@-
    1686:	4878 03e8      	pea 0x3e8
    168a:	2f07           	movel %d7,%sp@-
    168c:	2f2e 0010      	movel %fp@(16),%sp@-
    1690:	486e fffa      	pea %fp@(-6)
    1694:	3f06           	movew %d6,%sp@-
    1696:	486a 093a      	pea %a2@(2362)
    169a:	4eb9 0000 1620 	jsr 0x1620
    16a0:	3800           	movew %d0,%d4
    16a2:	4fef 0018      	lea %sp@(24),%sp
    16a6:	6626           	bnes 0x16ce
    16a8:	4aae 0014      	tstl %fp@(20)
    16ac:	6720           	beqs 0x16ce
    16ae:	2f0b           	movel %a3,%sp@-
    16b0:	1f2e 000e      	moveb %fp@(14),%sp@-
    16b4:	2f2e 0014      	movel %fp@(20),%sp@-
    16b8:	3f06           	movew %d6,%sp@-
    16ba:	2f0a           	movel %a2,%sp@-
    16bc:	4eba fcdc      	jsr %pc@(0x139a)
    16c0:	3800           	movew %d0,%d4
    16c2:	4fef 0010      	lea %sp@(16),%sp
    16c6:	6006           	bras 0x16ce
    16c8:	303c c948      	movew #-14008,%d0
    16cc:	6002           	bras 0x16d0
    16ce:	3004           	movew %d4,%d0
    16d0:	4cdf 0cf8      	moveml %sp@+,%d3-%d7/%a2-%a3
    16d4:	4e5e           	unlk %fp
    16d6:	4e75           	rts
    16d8:	8023           	orb %a3@-,%d0
    16da:	534d           	subqw #1,%a5
    16dc:	5365           	subqw #1,%a5@-
    16de:	6e64           	bgts 0x1744
    16e0:	4461           	negw %a1@-
    16e2:	7461           	moveq #97,%d2
    16e4:	5f5f           	subqw #7,%sp@+
    16e6:	3943 5343      	movew %d3,%a4@(21315)
    16ea:	5349           	subqw #1,%a1
    16ec:	506c 7567      	addqw #8,%a4@(30055)
    16f0:	4673 5563 5055 	notw %a3@(5055)@(63505563)
    16f6:	6350 5563 
    16fa:	6c50           	bges 0x174c
    16fc:	6c00 0000      	bgew 0x16fe
    1700:	4e56 f884      	linkw %fp,#-1916
    1704:	48e7 1f30      	moveml %d3-%d7/%a2-%a3,%sp@-
    1708:	246e 0008      	moveal %fp@(8),%a2
    170c:	486e f8a0      	pea %fp@(-1888)
    1710:	a976           	.short 0xa976
    1712:	7000           	moveq #0,%d0
    1714:	102e f8a7      	moveb %fp@(-1881),%d0
    1718:	e440           	asrw #2,%d0
    171a:	0240 0001      	andiw #1,%d0
    171e:	3d40 f88c      	movew %d0,%fp@(-1908)
    1722:	3d6e f88c f88a 	movew %fp@(-1908),%fp@(-1910)
    1728:	1d6e f88b f889 	moveb %fp@(-1909),%fp@(-1911)
    172e:	102e f889      	moveb %fp@(-1911),%d0
    1732:	56c0           	sne %d0
    1734:	4400           	negb %d0
    1736:	1e00           	moveb %d0,%d7
    1738:	41ec 009c      	lea %a4@(156),%a0
    173c:	2d48 f89c      	movel %a0,%fp@(-1892)
    1740:	41ec 009c      	lea %a4@(156),%a0
    1744:	41e8 0024      	lea %a0@(36),%a0
    1748:	2d48 f898      	movel %a0,%fp@(-1896)
    174c:	4a07           	tstb %d7
    174e:	6708           	beqs 0x1758
    1750:	2d6e f898 f8b4 	movel %fp@(-1896),%fp@(-1868)
    1756:	6006           	bras 0x175e
    1758:	2d6e f89c f8b4 	movel %fp@(-1892),%fp@(-1868)
    175e:	266e f8b4      	moveal %fp@(-1868),%a3
    1762:	306a 0d6e      	moveaw %a2@(3438),%a0
    1766:	2f08           	movel %a0,%sp@-
    1768:	3f3c 03e8      	movew #1000,%sp@-
    176c:	486e f8c0      	pea %fp@(-1856)
    1770:	4eb9 0000 210c 	jsr 0x210c
    1776:	486e f8c0      	pea %fp@(-1856)
    177a:	2057           	moveal %sp@,%a0
    177c:	2268 000e      	moveal %a0@(14),%a1
    1780:	2269 000c      	moveal %a1@(12),%a1
    1784:	4e91           	jsr %a1@
    1786:	7c00           	moveq #0,%d6
    1788:	2f0b           	movel %a3,%sp@-
    178a:	4267           	clrw %sp@-
    178c:	486e f8c0      	pea %fp@(-1856)
    1790:	4eb9 0000 21dc 	jsr 0x21dc
    1796:	486e f8c0      	pea %fp@(-1856)
    179a:	4eb9 0000 229c 	jsr 0x229c
    17a0:	7a00           	moveq #0,%d5
    17a2:	4fef 001c      	lea %sp@(28),%sp
    17a6:	6000 01d8      	braw 0x1980
    17aa:	7800           	moveq #0,%d4
    17ac:	6000 01c8      	braw 0x1976
    17b0:	4878 0024      	pea 0x24
    17b4:	486e fedc      	pea %fp@(-292)
    17b8:	1f04           	moveb %d4,%sp@-
    17ba:	1f05           	moveb %d5,%sp@-
    17bc:	486a 093a      	pea %a2@(2362)
    17c0:	4eb9 0000 17ac 	jsr 0x17ac
    17c6:	48c0           	extl %d0
    17c8:	2540 0d66      	movel %d0,%a2@(3430)
    17cc:	4aaa 0d66      	tstl %a2@(3430)
    17d0:	4fef 0010      	lea %sp@(16),%sp
    17d4:	6600 0190      	bnew 0x1966
    17d8:	4a07           	tstb %d7
    17da:	6636           	bnes 0x1812
    17dc:	7000           	moveq #0,%d0
    17de:	102e fee4      	moveb %fp@(-284),%d0
    17e2:	0c40 0041      	cmpiw #65,%d0
    17e6:	6600 017e      	bnew 0x1966
    17ea:	7000           	moveq #0,%d0
    17ec:	102e fee5      	moveb %fp@(-283),%d0
    17f0:	0c40 004b      	cmpiw #75,%d0
    17f4:	6600 0170      	bnew 0x1966
    17f8:	7000           	moveq #0,%d0
    17fa:	102e feec      	moveb %fp@(-276),%d0
    17fe:	0c40 0053      	cmpiw #83,%d0
    1802:	670e           	beqs 0x1812
    1804:	7000           	moveq #0,%d0
    1806:	102e feec      	moveb %fp@(-276),%d0
    180a:	0c40 0043      	cmpiw #67,%d0
    180e:	6600 0156      	bnew 0x1966
    1812:	422e ff00      	clrb %fp@(-256)
    1816:	522e ff00      	addqb #1,%fp@(-256)
    181a:	7000           	moveq #0,%d0
    181c:	102e ff00      	moveb %fp@(-256),%d0
    1820:	41ee ff00      	lea %fp@(-256),%a0
    1824:	11bc 0042 0000 	moveb #66,%a0@(0,%d0:w)
    182a:	522e ff00      	addqb #1,%fp@(-256)
    182e:	7000           	moveq #0,%d0
    1830:	102e ff00      	moveb %fp@(-256),%d0
    1834:	41ee ff00      	lea %fp@(-256),%a0
    1838:	11bc 0075 0000 	moveb #117,%a0@(0,%d0:w)
    183e:	522e ff00      	addqb #1,%fp@(-256)
    1842:	7000           	moveq #0,%d0
    1844:	102e ff00      	moveb %fp@(-256),%d0
    1848:	41ee ff00      	lea %fp@(-256),%a0
    184c:	11bc 0073 0000 	moveb #115,%a0@(0,%d0:w)
    1852:	522e ff00      	addqb #1,%fp@(-256)
    1856:	7000           	moveq #0,%d0
    1858:	102e ff00      	moveb %fp@(-256),%d0
    185c:	41ee ff00      	lea %fp@(-256),%a0
    1860:	11bc 0020 0000 	moveb #32,%a0@(0,%d0:w)
    1866:	1005           	moveb %d5,%d0
    1868:	4880           	extw %d0
    186a:	0640 0030      	addiw #48,%d0
    186e:	522e ff00      	addqb #1,%fp@(-256)
    1872:	7200           	moveq #0,%d1
    1874:	122e ff00      	moveb %fp@(-256),%d1
    1878:	41ee ff00      	lea %fp@(-256),%a0
    187c:	1180 1000      	moveb %d0,%a0@(0,%d1:w)
    1880:	522e ff00      	addqb #1,%fp@(-256)
    1884:	7000           	moveq #0,%d0
    1886:	102e ff00      	moveb %fp@(-256),%d0
    188a:	41ee ff00      	lea %fp@(-256),%a0
    188e:	11bc 002c 0000 	moveb #44,%a0@(0,%d0:w)
    1894:	522e ff00      	addqb #1,%fp@(-256)
    1898:	7000           	moveq #0,%d0
    189a:	102e ff00      	moveb %fp@(-256),%d0
    189e:	41ee ff00      	lea %fp@(-256),%a0
    18a2:	11bc 0049 0000 	moveb #73,%a0@(0,%d0:w)
    18a8:	522e ff00      	addqb #1,%fp@(-256)
    18ac:	7000           	moveq #0,%d0
    18ae:	102e ff00      	moveb %fp@(-256),%d0
    18b2:	41ee ff00      	lea %fp@(-256),%a0
    18b6:	11bc 0044 0000 	moveb #68,%a0@(0,%d0:w)
    18bc:	522e ff00      	addqb #1,%fp@(-256)
    18c0:	7000           	moveq #0,%d0
    18c2:	102e ff00      	moveb %fp@(-256),%d0
    18c6:	41ee ff00      	lea %fp@(-256),%a0
    18ca:	11bc 003d 0000 	moveb #61,%a0@(0,%d0:w)
    18d0:	1004           	moveb %d4,%d0
    18d2:	4880           	extw %d0
    18d4:	0640 0030      	addiw #48,%d0
    18d8:	522e ff00      	addqb #1,%fp@(-256)
    18dc:	7200           	moveq #0,%d1
    18de:	122e ff00      	moveb %fp@(-256),%d1
    18e2:	41ee ff00      	lea %fp@(-256),%a0
    18e6:	1180 1000      	moveb %d0,%a0@(0,%d1:w)
    18ea:	522e ff00      	addqb #1,%fp@(-256)
    18ee:	7000           	moveq #0,%d0
    18f0:	102e ff00      	moveb %fp@(-256),%d0
    18f4:	41ee ff00      	lea %fp@(-256),%a0
    18f8:	11bc 003a 0000 	moveb #58,%a0@(0,%d0:w)
    18fe:	522e ff00      	addqb #1,%fp@(-256)
    1902:	7000           	moveq #0,%d0
    1904:	102e ff00      	moveb %fp@(-256),%d0
    1908:	41ee ff00      	lea %fp@(-256),%a0
    190c:	11bc 0020 0000 	moveb #32,%a0@(0,%d0:w)
    1912:	7608           	moveq #8,%d3
    1914:	601a           	bras 0x1930
    1916:	41ee fedc      	lea %fp@(-292),%a0
    191a:	522e ff00      	addqb #1,%fp@(-256)
    191e:	7000           	moveq #0,%d0
    1920:	102e ff00      	moveb %fp@(-256),%d0
    1924:	43ee ff00      	lea %fp@(-256),%a1
    1928:	13b0 3800 0000 	moveb %a0@(0,%d3:l),%a1@(0,%d0:w)
    192e:	5283           	addql #1,%d3
    1930:	7024           	moveq #36,%d0
    1932:	b680           	cmpl %d0,%d3
    1934:	6de0           	blts 0x1916
    1936:	486e ff00      	pea %fp@(-256)
    193a:	3006           	movew %d6,%d0
    193c:	5246           	addqw #1,%d6
    193e:	3f00           	movew %d0,%sp@-
    1940:	486e f8c0      	pea %fp@(-1856)
    1944:	4eb9 0000 21dc 	jsr 0x21dc
    194a:	2f0b           	movel %a3,%sp@-
    194c:	3f06           	movew %d6,%sp@-
    194e:	486e f8c0      	pea %fp@(-1856)
    1952:	4eb9 0000 21dc 	jsr 0x21dc
    1958:	486e f8c0      	pea %fp@(-1856)
    195c:	4eb9 0000 229c 	jsr 0x229c
    1962:	4fef 0018      	lea %sp@(24),%sp
    1966:	0caa ffff e10a 	cmpil #-7926,%a2@(3430)
    196c:	0d66 
    196e:	6604           	bnes 0x1974
    1970:	42aa 0d66      	clrl %a2@(3430)
    1974:	5204           	addqb #1,%d4
    1976:	0c04 0007      	cmpib #7,%d4
    197a:	6d00 fe34      	bltw 0x17b0
    197e:	5205           	addqb #1,%d5
    1980:	1005           	moveb %d5,%d0
    1982:	4880           	extw %d0
    1984:	48c0           	extl %d0
    1986:	b0aa 0942      	cmpl %a2@(2370),%d0
    198a:	6d00 fe1e      	bltw 0x17aa
    198e:	4a46           	tstw %d6
    1990:	6722           	beqs 0x19b4
    1992:	486c 00e3      	pea %a4@(227)
    1996:	3f06           	movew %d6,%sp@-
    1998:	486e f8c0      	pea %fp@(-1856)
    199c:	4eb9 0000 21dc 	jsr 0x21dc
    19a2:	1d7c 0001 feda 	moveb #1,%fp@(-294)
    19a8:	3d7c 0001 fed6 	movew #1,%fp@(-298)
    19ae:	4fef 000a      	lea %sp@(10),%sp
    19b2:	6032           	bras 0x19e6
    19b4:	4a07           	tstb %d7
    19b6:	6716           	beqs 0x19ce
    19b8:	486c 010b      	pea %a4@(267)
    19bc:	3f06           	movew %d6,%sp@-
    19be:	486e f8c0      	pea %fp@(-1856)
    19c2:	4eb9 0000 21dc 	jsr 0x21dc
    19c8:	4fef 000a      	lea %sp@(10),%sp
    19cc:	6014           	bras 0x19e2
    19ce:	486c 0123      	pea %a4@(291)
    19d2:	3f06           	movew %d6,%sp@-
    19d4:	486e f8c0      	pea %fp@(-1856)
    19d8:	4eb9 0000 21dc 	jsr 0x21dc
    19de:	4fef 000a      	lea %sp@(10),%sp
    19e2:	422e feda      	clrb %fp@(-294)
    19e6:	486e f8c0      	pea %fp@(-1856)
    19ea:	2057           	moveal %sp@,%a0
    19ec:	2268 000e      	moveal %a0@(14),%a1
    19f0:	2269 0010      	moveal %a1@(16),%a1
    19f4:	4e91           	jsr %a1@
    19f6:	4a00           	tstb %d0
    19f8:	584f           	addqw #4,%sp
    19fa:	6700 00c6      	beqw 0x1ac2
    19fe:	4a6e fed6      	tstw %fp@(-298)
    1a02:	671a           	beqs 0x1a1e
    1a04:	302e fed6      	movew %fp@(-298),%d0
    1a08:	5340           	subqw #1,%d0
    1a0a:	48c0           	extl %d0
    1a0c:	e188           	lsll #8,%d0
    1a0e:	41ee f8c0      	lea %fp@(-1856),%a0
    1a12:	d1c0           	addal %d0,%a0
    1a14:	41e8 0016      	lea %a0@(22),%a0
    1a18:	2d48 f8b0      	movel %a0,%fp@(-1872)
    1a1c:	6004           	bras 0x1a22
    1a1e:	42ae f8b0      	clrl %fp@(-1872)
    1a22:	2d6e f8b0 f884 	movel %fp@(-1872),%fp@(-1916)
    1a28:	2d6e f884 f8b8 	movel %fp@(-1916),%fp@(-1864)
    1a2e:	4aae f8b8      	tstl %fp@(-1864)
    1a32:	6772           	beqs 0x1aa6
    1a34:	206e f8b8      	moveal %fp@(-1864),%a0
    1a38:	7000           	moveq #0,%d0
    1a3a:	1028 0005      	moveb %a0@(5),%d0
    1a3e:	0640 ffd0      	addiw #-48,%d0
    1a42:	3d40 f896      	movew %d0,%fp@(-1898)
    1a46:	206e f8b8      	moveal %fp@(-1864),%a0
    1a4a:	7000           	moveq #0,%d0
    1a4c:	1028 000a      	moveb %a0@(10),%d0
    1a50:	0640 ffd0      	addiw #-48,%d0
    1a54:	3d40 f894      	movew %d0,%fp@(-1900)
    1a58:	302e f896      	movew %fp@(-1898),%d0
    1a5c:	e148           	lslw #8,%d0
    1a5e:	d06e f894      	addw %fp@(-1900),%d0
    1a62:	3d40 f8bc      	movew %d0,%fp@(-1860)
    1a66:	426e f8be      	clrw %fp@(-1858)
    1a6a:	6028           	bras 0x1a94
    1a6c:	702e           	moveq #46,%d0
    1a6e:	c1ee f8be      	mulsw %fp@(-1858),%d0
    1a72:	2032 0862      	movel %a2@(62,%d0:l),%d0
    1a76:	b0ae 000c      	cmpl %fp@(12),%d0
    1a7a:	6614           	bnes 0x1a90
    1a7c:	306e f8bc      	moveaw %fp@(-1860),%a0
    1a80:	326e f8be      	moveaw %fp@(-1858),%a1
    1a84:	2009           	movel %a1,%d0
    1a86:	e588           	lsll #2,%d0
    1a88:	224a           	moveal %a2,%a1
    1a8a:	d3c0           	addal %d0,%a1
    1a8c:	2348 0d70      	movel %a0,%a1@(3440)
    1a90:	526e f8be      	addqw #1,%fp@(-1858)
    1a94:	306e f8be      	moveaw %fp@(-1858),%a0
    1a98:	b1ea 0038      	cmpal %a2@(56),%a0
    1a9c:	6dce           	blts 0x1a6c
    1a9e:	356e f8bc 0d6e 	movew %fp@(-1860),%a2@(3438)
    1aa4:	6038           	bras 0x1ade
    1aa6:	3d7c d8ed f892 	movew #-10003,%fp@(-1902)
    1aac:	3f3c ffff      	movew #-1,%sp@-
    1ab0:	486e f8c0      	pea %fp@(-1856)
    1ab4:	4eb9 0000 218a 	jsr 0x218a
    1aba:	302e f892      	movew %fp@(-1902),%d0
    1abe:	5c4f           	addqw #6,%sp
    1ac0:	6036           	bras 0x1af8
    1ac2:	3d7c d8ed f890 	movew #-10003,%fp@(-1904)
    1ac8:	3f3c ffff      	movew #-1,%sp@-
    1acc:	486e f8c0      	pea %fp@(-1856)
    1ad0:	4eb9 0000 218a 	jsr 0x218a
    1ad6:	302e f890      	movew %fp@(-1904),%d0
    1ada:	5c4f           	addqw #6,%sp
    1adc:	601a           	bras 0x1af8
    1ade:	3d6a 0d68 f88e 	movew %a2@(3432),%fp@(-1906)
    1ae4:	3f3c ffff      	movew #-1,%sp@-
    1ae8:	486e f8c0      	pea %fp@(-1856)
    1aec:	4eb9 0000 218a 	jsr 0x218a
    1af2:	302e f88e      	movew %fp@(-1906),%d0
    1af6:	5c4f           	addqw #6,%sp
    1af8:	4cdf 0cf8      	moveml %sp@+,%d3-%d7/%a2-%a3
    1afc:	4e5e           	unlk %fp
    1afe:	4e75           	rts
    1b00:	9943           	subxw %d3,%d4
    1b02:	686f           	bvcs 0x1b73
    1b04:	6f73           	bles 0x1b79
    1b06:	6553           	bcss 0x1b5b
    1b08:	4353           	.short 0x4353
    1b0a:	495f           	.short 0x495f
    1b0c:	5f39 4353 4353 	subqb #7,0x43534353
    1b12:	4950           	.short 0x4950
    1b14:	6c75           	bges 0x1b8b
    1b16:	6746           	beqs 0x1b5e
    1b18:	556c 0000      	subqw #2,%a4@(0)
    1b1c:	4e56 fffc      	linkw %fp,#-4
    1b20:	2f0a           	movel %a2,%sp@-
    1b22:	2f03           	movel %d3,%sp@-
    1b24:	246e 0008      	moveal %fp@(8),%a2
    1b28:	7600           	moveq #0,%d3
    1b2a:	4252           	clrw %a2@
    1b2c:	422a 0006      	clrb %a2@(6)
    1b30:	42aa 0008      	clrl %a2@(8)
    1b34:	4878 0408      	pea 0x408
    1b38:	4267           	clrw %sp@-
    1b3a:	486a 000c      	pea %a2@(12)
    1b3e:	4eb9 0000 24e2 	jsr 0x24e2
    1b44:	4878 0018      	pea 0x18
    1b48:	4267           	clrw %sp@-
    1b4a:	486a 0414      	pea %a2@(1044)
    1b4e:	4eb9 0000 24e2 	jsr 0x24e2
    1b54:	203c 0001 0000 	movel #65536,%d0
    1b5a:	a31e           	.short 0xa31e
    1b5c:	2548 0002      	movel %a0,%a2@(2)
    1b60:	4aaa 0002      	tstl %a2@(2)
    1b64:	4fef 0014      	lea %sp@(20),%sp
    1b68:	6602           	bnes 0x1b6c
    1b6a:	7694           	moveq #-108,%d3
    1b6c:	4a43           	tstw %d3
    1b6e:	662a           	bnes 0x1b9a
    1b70:	203c 7363 7369 	movel #1935897449,%d0
    1b76:	43ee fffc      	lea %fp@(-4),%a1
    1b7a:	a1ad           	.short 0xa1ad
    1b7c:	2288           	movel %a0,%a1@
    1b7e:	3600           	movew %d0,%d3
    1b80:	6618           	bnes 0x1b9a
    1b82:	7001           	moveq #1,%d0
    1b84:	c0ae fffc      	andl %fp@(-4),%d0
    1b88:	6710           	beqs 0x1b9a
    1b8a:	157c 0001 0006 	moveb #1,%a2@(6)
    1b90:	2f0a           	movel %a2,%sp@-
    1b92:	4eb9 0000 1970 	jsr 0x1970
    1b98:	584f           	addqw #4,%sp
    1b9a:	3483           	movew %d3,%a2@
    1b9c:	204a           	moveal %a2,%a0
    1b9e:	261f           	movel %sp@+,%d3
    1ba0:	245f           	moveal %sp@+,%a2
    1ba2:	4e5e           	unlk %fp
    1ba4:	4e75           	rts
    1ba6:	945f           	subw %sp@+,%d2
    1ba8:	5f63           	subqw #7,%a3@-
    1baa:	745f           	moveq #95,%d2
    1bac:	5f31 3043      	subqb #7,%a1@(43,%d3:w)
    1bb0:	5343           	subqw #1,%d3
    1bb2:	5349           	subqw #1,%a1
    1bb4:	5574 696c 7346 	subqw #2,%a4@(7346)@(0)
    1bba:	7600           	moveq #0,%d3
    1bbc:	0000 4e56      	orib #86,%d0
    1bc0:	0000 48e7      	orib #-25,%d0
    1bc4:	1f30 266e      	moveb %a0@(6e,%d2:w:8),%sp@-
    1bc8:	0008           	.short 0x0008
    1bca:	262e 000e      	movel %fp@(14),%d3
    1bce:	2e2e 0016      	movel %fp@(22),%d7
    1bd2:	3c2e 001e      	movew %fp@(30),%d6
    1bd6:	4253           	clrw %a3@
    1bd8:	382e 000c      	movew %fp@(12),%d4
    1bdc:	e044           	asrw #8,%d4
    1bde:	0244 00ff      	andiw #255,%d4
    1be2:	3a2e 000c      	movew %fp@(12),%d5
    1be6:	0245 00ff      	andiw #255,%d5
    1bea:	246b 0002      	moveal %a3@(2),%a2
    1bee:	3044           	moveaw %d4,%a0
    1bf0:	2008           	movel %a0,%d0
    1bf2:	e588           	lsll #2,%d0
    1bf4:	204b           	moveal %a3,%a0
    1bf6:	d1c0           	addal %d0,%a0
    1bf8:	2f28 0414      	movel %a0@(1044),%sp@-
    1bfc:	4267           	clrw %sp@-
    1bfe:	2f0a           	movel %a2,%sp@-
    1c00:	4eb9 0000 24e2 	jsr 0x24e2
    1c06:	200a           	movel %a2,%d0
    1c08:	4fef 000a      	lea %sp@(10),%sp
    1c0c:	6606           	bnes 0x1c14
    1c0e:	7094           	moveq #-108,%d0
    1c10:	6000 0104      	braw 0x1d16
    1c14:	3044           	moveaw %d4,%a0
    1c16:	2008           	movel %a0,%d0
    1c18:	e588           	lsll #2,%d0
    1c1a:	204b           	moveal %a3,%a0
    1c1c:	d1c0           	addal %d0,%a0
    1c1e:	3568 0416 0006 	movew %a0@(1046),%a2@(6)
    1c24:	157c 0001 0008 	moveb #1,%a2@(8)
    1c2a:	42aa 0010      	clrl %a2@(16)
    1c2e:	1544 000d      	moveb %d4,%a2@(13)
    1c32:	1545 000e      	moveb %d5,%a2@(14)
    1c36:	41ec 01ec      	lea %a4@(492),%a0
    1c3a:	2548 0030      	movel %a0,%a2@(48)
    1c3e:	157c 0076 0034 	moveb #118,%a2@(52)
    1c44:	157c 0006 0035 	moveb #6,%a2@(53)
    1c4a:	2043           	moveal %d3,%a0
    1c4c:	1550 0044      	moveb %a0@,%a2@(68)
    1c50:	2043           	moveal %d3,%a0
    1c52:	1568 0001 0045 	moveb %a0@(1),%a2@(69)
    1c58:	2043           	moveal %d3,%a0
    1c5a:	1568 0002 0046 	moveb %a0@(2),%a2@(70)
    1c60:	2043           	moveal %d3,%a0
    1c62:	1568 0003 0047 	moveb %a0@(3),%a2@(71)
    1c68:	2043           	moveal %d3,%a0
    1c6a:	1568 0004 0048 	moveb %a0@(4),%a2@(72)
    1c70:	2043           	moveal %d3,%a0
    1c72:	1568 0005 0049 	moveb %a0@(5),%a2@(73)
    1c78:	256e 001a 0054 	movel %fp@(26),%a2@(84)
    1c7e:	426a 0064      	clrw %a2@(100)
    1c82:	157c 0001 0067 	moveb #1,%a2@(103)
    1c88:	4a2b 0006      	tstb %a3@(6)
    1c8c:	6700 0082      	beqw 0x1d10
    1c90:	0c46 0001      	cmpiw #1,%d6
    1c94:	6618           	bnes 0x1cae
    1c96:	257c 4004 0000 	movel #1074003968,%a2@(20)
    1c9c:	0014 
    1c9e:	256e 0012 0028 	movel %fp@(18),%a2@(40)
    1ca4:	2547 002c      	movel %d7,%a2@(44)
    1ca8:	422a 0066      	clrb %a2@(102)
    1cac:	6026           	bras 0x1cd4
    1cae:	0c46 0002      	cmpiw #2,%d6
    1cb2:	6618           	bnes 0x1ccc
    1cb4:	257c 8004 0000 	movel #-2147221504,%a2@(20)
    1cba:	0014 
    1cbc:	256e 0012 0028 	movel %fp@(18),%a2@(40)
    1cc2:	2547 002c      	movel %d7,%a2@(44)
    1cc6:	422a 0066      	clrb %a2@(102)
    1cca:	6008           	bras 0x1cd4
    1ccc:	257c c004 0000 	movel #-1073479680,%a2@(20)
    1cd2:	0014 
    1cd4:	204a           	moveal %a2,%a0
    1cd6:	7001           	moveq #1,%d0
    1cd8:	a089           	.short 0xa089
    1cda:	3680           	movew %d0,%a3@
    1cdc:	4aaa 0010      	tstl %a2@(16)
    1ce0:	6632           	bnes 0x1d14
    1ce2:	4a53           	tstw %a3@
    1ce4:	6604           	bnes 0x1cea
    1ce6:	36aa 000a      	movew %a2@(10),%a3@
    1cea:	302a 0024      	movew %a2@(36),%d0
    1cee:	0240 0004      	andiw #4,%d0
    1cf2:	670c           	beqs 0x1d00
    1cf4:	1f04           	moveb %d4,%sp@-
    1cf6:	2f0b           	movel %a3,%sp@-
    1cf8:	4eb9 0000 191a 	jsr 0x191a
    1cfe:	5c4f           	addqw #6,%sp
    1d00:	302a 0024      	movew %a2@(36),%d0
    1d04:	0240 0002      	andiw #2,%d0
    1d08:	670a           	beqs 0x1d14
    1d0a:	36bc fffe      	movew #-2,%a3@
    1d0e:	6004           	bras 0x1d14
    1d10:	36bc c945      	movew #-14011,%a3@
    1d14:	3013           	movew %a3@,%d0
    1d16:	4cdf 0cf8      	moveml %sp@+,%d3-%d7/%a2-%a3
    1d1a:	4e5e           	unlk %fp
    1d1c:	4e75           	rts
    1d1e:	8027           	orb %sp@-,%d0
    1d20:	5343           	subqw #1,%d3
    1d22:	5349           	subqw #1,%a1
    1d24:	436f           	.short 0x436f
    1d26:	6d6d           	blts 0x1d95
    1d28:	616e           	bsrs 0x1d98
    1d2a:	645f           	bccs 0x1d8b
    1d2c:	5f31 3043      	subqb #7,%a1@(43,%d3:w)
    1d30:	5343           	subqw #1,%d3
    1d32:	5349           	subqw #1,%a1
    1d34:	5574 696c 7346 	subqw #2,%a4@(7346)@(0)
    1d3a:	7350           	.short 0x7350
    1d3c:	3343 6462      	movew %d3,%a1@(25698)
    1d40:	5055           	addqw #8,%a5@
    1d42:	6355           	blss 0x1d99
    1d44:	6c6c           	bges 0x1db2
    1d46:	7300           	.short 0x7300
    1d48:	0000 4e56      	orib #86,%d0
    1d4c:	fffa           	.short 0xfffa
    1d4e:	48e7 1820      	moveml %d3-%d4/%a2,%sp@-
    1d52:	246e 0008      	moveal %fp@(8),%a2
    1d56:	282e 0014      	movel %fp@(20),%d4
    1d5a:	2d6c 0096 fffa 	movel %a4@(150),%fp@(-6)
    1d60:	3d6c 009a fffe 	movew %a4@(154),%fp@(-2)
    1d66:	1d44 fffe      	moveb %d4,%fp@(-2)
    1d6a:	162e 000c      	moveb %fp@(12),%d3
    1d6e:	4883           	extw %d3
    1d70:	e14b           	lslw #8,%d3
    1d72:	102e 000e      	moveb %fp@(14),%d0
    1d76:	4880           	extw %d0
    1d78:	d640           	addw %d0,%d3
    1d7a:	3f3c 0001      	movew #1,%sp@-
    1d7e:	4878 03e8      	pea 0x3e8
    1d82:	2f04           	movel %d4,%sp@-
    1d84:	2f2e 0010      	movel %fp@(16),%sp@-
    1d88:	486e fffa      	pea %fp@(-6)
    1d8c:	3f03           	movew %d3,%sp@-
    1d8e:	2f0a           	movel %a2,%sp@-
    1d90:	4eba fe2c      	jsr %pc@(0x1bbe)
    1d94:	3012           	movew %a2@,%d0
    1d96:	4fef 0018      	lea %sp@(24),%sp
    1d9a:	4cdf 0418      	moveml %sp@+,%d3-%d4/%a2
    1d9e:	4e5e           	unlk %fp
    1da0:	4e75           	rts
    1da2:	9d49           	subxw %a1@-,%fp@-
    1da4:	6e71           	bgts 0x1e17
    1da6:	7569           	.short 0x7569
    1da8:	7279           	moveq #121,%d1
    1daa:	5f5f           	subqw #7,%sp@+
    1dac:	3130 4353 4353 	movew %a0@(0)@(43534955),%a0@-
    1db2:	4955 
    1db4:	7469           	moveq #105,%d2
    1db6:	6c73           	bges 0x1e2b
    1db8:	4663           	notw %a3@-
    1dba:	6350           	blss 0x1e0c
    1dbc:	5563           	subqw #2,%a3@-
    1dbe:	556c 0000      	subqw #2,%a4@(0)
    1dc2:	4e56 fffa      	linkw %fp,#-6
    1dc6:	2f0a           	movel %a2,%sp@-
    1dc8:	246e 0008      	moveal %fp@(8),%a2
    1dcc:	2d6c 0090 fffa 	movel %a4@(144),%fp@(-6)
    1dd2:	3d6c 0094 fffe 	movew %a4@(148),%fp@(-2)
    1dd8:	4267           	clrw %sp@-
    1dda:	4878 03e8      	pea 0x3e8
    1dde:	42a7           	clrl %sp@-
    1de0:	42a7           	clrl %sp@-
    1de2:	486e fffa      	pea %fp@(-6)
    1de6:	3f2e 000c      	movew %fp@(12),%sp@-
    1dea:	2f0a           	movel %a2,%sp@-
    1dec:	4eba fdd0      	jsr %pc@(0x1bbe)
    1df0:	3012           	movew %a2@,%d0
    1df2:	4fef 0018      	lea %sp@(24),%sp
    1df6:	245f           	moveal %sp@+,%a2
    1df8:	4e5e           	unlk %fp
    1dfa:	4e75           	rts
    1dfc:	9d54           	subw %d6,%a4@
    1dfe:	6573           	bcss 0x1e73
    1e00:	7455           	moveq #85,%d2
    1e02:	6e69           	bgts 0x1e6d
    1e04:	7452           	moveq #82,%d2
    1e06:	6561           	bcss 0x1e69
    1e08:	6479           	bccs 0x1e83
    1e0a:	5f5f           	subqw #7,%sp@+
    1e0c:	3130 4353 4353 	movew %a0@(0)@(43534955),%a0@-
    1e12:	4955 
    1e14:	7469           	moveq #105,%d2
    1e16:	6c73           	bges 0x1e8b
    1e18:	4673 0000      	notw %a3@(0,%d0:w)
    1e1c:	4e56 ffea      	linkw %fp,#-22
    1e20:	48e7 1f20      	moveml %d3-%d7/%a2,%sp@-
    1e24:	246e 0008      	moveal %fp@(8),%a2
    1e28:	7600           	moveq #0,%d3
    1e2a:	486e fff0      	pea %fp@(-16)
    1e2e:	a976           	.short 0xa976
    1e30:	7a00           	moveq #0,%d5
    1e32:	1a2e fff6      	moveb %fp@(-10),%d5
    1e36:	ee45           	asrw #7,%d5
    1e38:	0245 0001      	andiw #1,%d5
    1e3c:	3c05           	movew %d5,%d6
    1e3e:	671e           	beqs 0x1e5e
    1e40:	486e fff0      	pea %fp@(-16)
    1e44:	a976           	.short 0xa976
    1e46:	7e00           	moveq #0,%d7
    1e48:	1e2e fff5      	moveb %fp@(-11),%d7
    1e4c:	ee47           	asrw #7,%d7
    1e4e:	0247 0001      	andiw #1,%d7
    1e52:	3d47 ffee      	movew %d7,%fp@(-18)
    1e56:	4a6e ffee      	tstw %fp@(-18)
    1e5a:	6702           	beqs 0x1e5e
    1e5c:	7601           	moveq #1,%d3
    1e5e:	4a03           	tstb %d3
    1e60:	6708           	beqs 0x1e6a
    1e62:	34bc c948      	movew #-14008,%a2@
    1e66:	7000           	moveq #0,%d0
    1e68:	6024           	bras 0x1e8e
    1e6a:	3f2e 000c      	movew %fp@(12),%sp@-
    1e6e:	2f0a           	movel %a2,%sp@-
    1e70:	4eba ff50      	jsr %pc@(0x1dc2)
    1e74:	3800           	movew %d0,%d4
    1e76:	5c4f           	addqw #6,%sp
    1e78:	670e           	beqs 0x1e88
    1e7a:	207c 0000 001e 	moveal #30,%a0
    1e80:	43ee ffea      	lea %fp@(-22),%a1
    1e84:	a03b           	.short 0xa03b
    1e86:	2280           	movel %d0,%a1@
    1e88:	4a44           	tstw %d4
    1e8a:	669c           	bnes 0x1e28
    1e8c:	7001           	moveq #1,%d0
    1e8e:	4cdf 04f8      	moveml %sp@+,%d3-%d7/%a2
    1e92:	4e5e           	unlk %fp
    1e94:	4e75           	rts
    1e96:	9e57           	subw %sp@,%d7
    1e98:	6169           	bsrs 0x1f03
    1e9a:	7455           	moveq #85,%d2
    1e9c:	6e74           	bgts 0x1f12
    1e9e:	696c           	bvss 0x1f0c
    1ea0:	5265           	addqw #1,%a5@-
    1ea2:	6164           	bsrs 0x1f08
    1ea4:	795f           	.short 0x795f
    1ea6:	5f31 3043      	subqb #7,%a1@(43,%d3:w)
    1eaa:	5343           	subqw #1,%d3
    1eac:	5349           	subqw #1,%a1
    1eae:	5574 696c 7346 	subqw #2,%a4@(7346)@(0)
    1eb4:	7300           	.short 0x7300
    1eb6:	0000 4e56      	orib #86,%d0
    1eba:	ffdc           	.short 0xffdc
    1ebc:	4878 0024      	pea 0x24
    1ec0:	4267           	clrw %sp@-
    1ec2:	486e ffdc      	pea %fp@(-36)
    1ec6:	4eb9 0000 24e2 	jsr 0x24e2
    1ecc:	3d7c 0024 ffe2 	movew #36,%fp@(-30)
    1ed2:	1d7c 0011 ffe4 	moveb #17,%fp@(-28)
    1ed8:	1d6e 000c ffe9 	moveb %fp@(12),%fp@(-23)
    1ede:	422e ffea      	clrb %fp@(-22)
    1ee2:	422e ffeb      	clrb %fp@(-21)
    1ee6:	41ee ffdc      	lea %fp@(-36),%a0
    1eea:	7001           	moveq #1,%d0
    1eec:	a089           	.short 0xa089
    1eee:	4e5e           	unlk %fp
    1ef0:	4e75           	rts
    1ef2:	9852           	subw %a2@,%d4
    1ef4:	6573           	bcss 0x1f69
    1ef6:	6574           	bcss 0x1f6c
    1ef8:	4275 735f 5f31 	clrw %a5@(0)@(5f313043)
    1efe:	3043 
    1f00:	5343           	subqw #1,%d3
    1f02:	5349           	subqw #1,%a1
    1f04:	5574 696c 7346 	subqw #2,%a4@(7346)@(0)
    1f0a:	6300 0000      	blsw 0x1f0c
    1f0e:	4e56 ff54      	linkw %fp,#-172
    1f12:	2f0a           	movel %a2,%sp@-
    1f14:	2f03           	movel %d3,%sp@-
    1f16:	246e 0008      	moveal %fp@(8),%a2
    1f1a:	7600           	moveq #0,%d3
    1f1c:	4878 00ac      	pea 0xac
    1f20:	4267           	clrw %sp@-
    1f22:	486e ff54      	pea %fp@(-172)
    1f26:	4eb9 0000 24e2 	jsr 0x24e2
    1f2c:	3d7c 00ac ff5a 	movew #172,%fp@(-166)
    1f32:	1d7c 0003 ff5c 	moveb #3,%fp@(-164)
    1f38:	1d43 ff61      	moveb %d3,%fp@(-159)
    1f3c:	422e ff62      	clrb %fp@(-158)
    1f40:	422e ff63      	clrb %fp@(-157)
    1f44:	41ee ff54      	lea %fp@(-172),%a0
    1f48:	7001           	moveq #1,%d0
    1f4a:	a089           	.short 0xa089
    1f4c:	3480           	movew %d0,%a2@
    1f4e:	4fef 000a      	lea %sp@(10),%sp
    1f52:	6634           	bnes 0x1f88
    1f54:	41ee ff54      	lea %fp@(-172),%a0
    1f58:	1003           	moveb %d3,%d0
    1f5a:	4880           	extw %d0
    1f5c:	c1fc 00ac      	mulsw #172,%d0
    1f60:	224a           	moveal %a2,%a1
    1f62:	d3c0           	addal %d0,%a1
    1f64:	5089           	addql #8,%a1
    1f66:	5889           	addql #4,%a1
    1f68:	702a           	moveq #42,%d0
    1f6a:	22d8           	movel %a0@+,%a1@+
    1f6c:	51c8 fffc      	dbf %d0,0x1f6a
    1f70:	7000           	moveq #0,%d0
    1f72:	302e ff80      	movew %fp@(-128),%d0
    1f76:	1203           	moveb %d3,%d1
    1f78:	4881           	extw %d1
    1f7a:	48c1           	extl %d1
    1f7c:	e589           	lsll #2,%d1
    1f7e:	204a           	moveal %a2,%a0
    1f80:	d1c1           	addal %d1,%a0
    1f82:	2140 0414      	movel %d0,%a0@(1044)
    1f86:	5203           	addqb #1,%d3
    1f88:	4a52           	tstw %a2@
    1f8a:	6606           	bnes 0x1f92
    1f8c:	0c03 0006      	cmpib #6,%d3
    1f90:	6d8a           	blts 0x1f1c
    1f92:	0c52 e143      	cmpiw #-7869,%a2@
    1f96:	660c           	bnes 0x1fa4
    1f98:	4252           	clrw %a2@
    1f9a:	1003           	moveb %d3,%d0
    1f9c:	4880           	extw %d0
    1f9e:	48c0           	extl %d0
    1fa0:	2540 0008      	movel %d0,%a2@(8)
    1fa4:	261f           	movel %sp@+,%d3
    1fa6:	245f           	moveal %sp@+,%a2
    1fa8:	4e5e           	unlk %fp
    1faa:	4e75           	rts
    1fac:	9e49           	subw %a1,%d7
    1fae:	6465           	bccs 0x2015
    1fb0:	6e74           	bgts 0x2026
    1fb2:	6966           	bvss 0x201a
    1fb4:	7942           	.short 0x7942
    1fb6:	7573           	.short 0x7573
    1fb8:	7365           	.short 0x7365
    1fba:	735f           	.short 0x735f
    1fbc:	5f31 3043      	subqb #7,%a1@(43,%d3:w)
    1fc0:	5343           	subqw #1,%d3
    1fc2:	5349           	subqw #1,%a1
    1fc4:	5574 696c 7346 	subqw #2,%a4@(7346)@(0)
    1fca:	7600           	moveq #0,%d3
    1fcc:	0000 4e56      	orib #86,%d0
    1fd0:	0000 48e7      	orib #-25,%d0
    1fd4:	1e30 282e      	moveb %a0@(2e,%d2:l),%d7
    1fd8:	0008           	.short 0x0008
    1fda:	0c84 7fff fff0 	cmpil #2147483632,%d4
    1fe0:	6306           	blss 0x1fe8
    1fe2:	91c8           	subal %a0,%a0
    1fe4:	6000 0106      	braw 0x20ec
    1fe8:	70fc           	moveq #-4,%d0
    1fea:	2204           	movel %d4,%d1
    1fec:	5681           	addql #3,%d1
    1fee:	c280           	andl %d0,%d1
    1ff0:	5881           	addql #4,%d1
    1ff2:	2801           	movel %d1,%d4
    1ff4:	b8ac 0000      	cmpl %a4@(0),%d4
    1ff8:	6514           	bcss 0x200e
    1ffa:	2004           	movel %d4,%d0
    1ffc:	a11e           	.short 0xa11e
    1ffe:	2448           	moveal %a0,%a2
    2000:	2008           	movel %a0,%d0
    2002:	670a           	beqs 0x200e
    2004:	4292           	clrl %a2@
    2006:	204a           	moveal %a2,%a0
    2008:	5888           	addql #4,%a0
    200a:	6000 00e0      	braw 0x20ec
    200e:	246c 01e4      	moveal %a4@(484),%a2
    2012:	200a           	movel %a2,%d0
    2014:	670c           	beqs 0x2022
    2016:	2612           	movel %a2@,%d3
    2018:	b684           	cmpl %d4,%d3
    201a:	6d06           	blts 0x2022
    201c:	2a2c 01e8      	movel %a4@(488),%d5
    2020:	601a           	bras 0x203c
    2022:	266c 01e0      	moveal %a4@(480),%a3
    2026:	6074           	bras 0x209c
    2028:	244b           	moveal %a3,%a2
    202a:	508a           	addql #8,%a2
    202c:	204b           	moveal %a3,%a0
    202e:	d1eb 0004      	addal %a3@(4),%a0
    2032:	2a08           	movel %a0,%d5
    2034:	6060           	bras 0x2096
    2036:	2612           	movel %a2@,%d3
    2038:	4a83           	tstl %d3
    203a:	6f54           	bles 0x2090
    203c:	42ac 01e4      	clrl %a4@(484)
    2040:	6008           	bras 0x204a
    2042:	2003           	movel %d3,%d0
    2044:	d086           	addl %d6,%d0
    2046:	2600           	movel %d0,%d3
    2048:	2480           	movel %d0,%a2@
    204a:	204a           	moveal %a2,%a0
    204c:	d1c3           	addal %d3,%a0
    204e:	b1c5           	cmpal %d5,%a0
    2050:	6408           	bccs 0x205a
    2052:	2c32 3800      	movel %a2@(0,%d3:l),%d6
    2056:	4a86           	tstl %d6
    2058:	6ee8           	bgts 0x2042
    205a:	b684           	cmpl %d4,%d3
    205c:	652e           	bcss 0x208c
    205e:	2004           	movel %d4,%d0
    2060:	5080           	addql #8,%d0
    2062:	b680           	cmpl %d0,%d3
    2064:	651a           	bcss 0x2080
    2066:	294a 01e4      	movel %a2,%a4@(484)
    206a:	2945 01e8      	movel %d5,%a4@(488)
    206e:	9684           	subl %d4,%d3
    2070:	2483           	movel %d3,%a2@
    2072:	d5c3           	addal %d3,%a2
    2074:	2004           	movel %d4,%d0
    2076:	4480           	negl %d0
    2078:	2480           	movel %d0,%a2@
    207a:	204a           	moveal %a2,%a0
    207c:	5888           	addql #4,%a0
    207e:	606c           	bras 0x20ec
    2080:	2003           	movel %d3,%d0
    2082:	4480           	negl %d0
    2084:	2480           	movel %d0,%a2@
    2086:	204a           	moveal %a2,%a0
    2088:	5888           	addql #4,%a0
    208a:	6060           	bras 0x20ec
    208c:	d5c3           	addal %d3,%a2
    208e:	6006           	bras 0x2096
    2090:	4a83           	tstl %d3
    2092:	6706           	beqs 0x209a
    2094:	95c3           	subal %d3,%a2
    2096:	b5c5           	cmpal %d5,%a2
    2098:	659c           	bcss 0x2036
    209a:	2653           	moveal %a3@,%a3
    209c:	200b           	movel %a3,%d0
    209e:	6688           	bnes 0x2028
    20a0:	202c 0004      	movel %a4@(4),%d0
    20a4:	a11e           	.short 0xa11e
    20a6:	2648           	moveal %a0,%a3
    20a8:	2008           	movel %a0,%d0
    20aa:	671c           	beqs 0x20c8
    20ac:	26ac 01e0      	movel %a4@(480),%a3@
    20b0:	294b 01e0      	movel %a3,%a4@(480)
    20b4:	276c 0004 0004 	movel %a4@(4),%a3@(4)
    20ba:	202b 0004      	movel %a3@(4),%d0
    20be:	5180           	subql #8,%d0
    20c0:	2740 0008      	movel %d0,%a3@(8)
    20c4:	6000 ff62      	braw 0x2028
    20c8:	2004           	movel %d4,%d0
    20ca:	a11e           	.short 0xa11e
    20cc:	2448           	moveal %a0,%a2
    20ce:	2008           	movel %a0,%d0
    20d0:	6708           	beqs 0x20da
    20d2:	4292           	clrl %a2@
    20d4:	204a           	moveal %a2,%a0
    20d6:	5888           	addql #4,%a0
    20d8:	6012           	bras 0x20ec
    20da:	4aac 01dc      	tstl %a4@(476)
    20de:	670a           	beqs 0x20ea
    20e0:	206c 01dc      	moveal %a4@(476),%a0
    20e4:	4e90           	jsr %a0@
    20e6:	6000 ff0c      	braw 0x1ff4
    20ea:	91c8           	subal %a0,%a0
    20ec:	4cdf 0c78      	moveml %sp@+,%d3-%d6/%a2-%a3
    20f0:	4e5e           	unlk %fp
    20f2:	4e75           	rts
    20f4:	4e56 0000      	linkw %fp,#0
    20f8:	2f0a           	movel %a2,%sp@-
    20fa:	246e 0008      	moveal %fp@(8),%a2
    20fe:	200a           	movel %a2,%d0
    2100:	670e           	beqs 0x2110
    2102:	598a           	subql #4,%a2
    2104:	2012           	movel %a2@,%d0
    2106:	4480           	negl %d0
    2108:	2480           	movel %d0,%a2@
    210a:	6604           	bnes 0x2110
    210c:	204a           	moveal %a2,%a0
    210e:	a01f           	.short 0xa01f
    2110:	245f           	moveal %sp@+,%a2
    2112:	4e5e           	unlk %fp
    2114:	4e75           	rts
    2116:	201f           	movel %sp@+,%d0
    2118:	3f3c 0403      	movew #1027,%sp@-
    211c:	204f           	moveal %sp,%a0
    211e:	2f00           	movel %d0,%sp@-
    2120:	a08b           	.short 0xa08b
    2122:	205f           	moveal %sp@+,%a0
    2124:	5c4f           	addqw #6,%sp
    2126:	3e80           	movew %d0,%sp@
    2128:	4ed0           	jmp %a0@
    212a:	206f 0008      	moveal %sp@(8),%a0
    212e:	3f3c 0001      	movew #1,%sp@-
    2132:	a9ee           	.short 0xa9ee
    2134:	206f 0004      	moveal %sp@(4),%a0
    2138:	2080           	movel %d0,%a0@
    213a:	4efa 000e      	jmp %pc@(0x214a)
    213e:	206f 0004      	moveal %sp@(4),%a0
    2142:	202f 0008      	movel %sp@(8),%d0
    2146:	4267           	clrw %sp@-
    2148:	a9ee           	.short 0xa9ee
    214a:	205f           	moveal %sp@+,%a0
    214c:	504f           	addqw #8,%sp
    214e:	4ed0           	jmp %a0@
    2150:	4e56 0000      	linkw %fp,#0
    2154:	2f0a           	movel %a2,%sp@-
    2156:	246e 0008      	moveal %fp@(8),%a2
    215a:	41ec 004c      	lea %a4@(76),%a0
    215e:	2548 000e      	movel %a0,%a2@(14)
    2162:	2f0a           	movel %a2,%sp@-
    2164:	a874           	.short 0xa874
    2166:	594f           	subqw #4,%sp
    2168:	3f2e 000c      	movew %fp@(12),%sp@-
    216c:	42a7           	clrl %sp@-
    216e:	4878 ffff      	pea 0xffffffff
    2172:	a97c           	.short 0xa97c
    2174:	205f           	moveal %sp@+,%a0
    2176:	2548 0004      	movel %a0,%a2@(4)
    217a:	256e 000e 0008 	movel %fp@(14),%a2@(8)
    2180:	157c 0001 000c 	moveb #1,%a2@(12)
    2186:	2f2a 0004      	movel %a2@(4),%sp@-
    218a:	2f0a           	movel %a2,%sp@-
    218c:	a918           	.short 0xa918
    218e:	204a           	moveal %a2,%a0
    2190:	245f           	moveal %sp@+,%a2
    2192:	4e5e           	unlk %fp
    2194:	4e75           	rts
    2196:	925f           	subw %sp@+,%d1
    2198:	5f63           	subqw #7,%a3@-
    219a:	745f           	moveq #95,%d2
    219c:	5f37 4344      	subqb #7,%sp@(0)@(0)
    21a0:	6961           	bvss 0x2203
    21a2:	6c6f           	bges 0x2213
    21a4:	6746           	beqs 0x21ec
    21a6:	7350           	.short 0x7350
    21a8:	7600           	moveq #0,%d3
    21aa:	0000 4e56      	orib #86,%d0
    21ae:	0000 2f0a      	orib #10,%d0
    21b2:	246e 0008      	moveal %fp@(8),%a2
    21b6:	200a           	movel %a2,%d0
    21b8:	6728           	beqs 0x21e2
    21ba:	41ec 004c      	lea %a4@(76),%a0
    21be:	2548 000e      	movel %a0,%a2@(14)
    21c2:	2f2a 0004      	movel %a2@(4),%sp@-
    21c6:	a916           	.short 0xa916
    21c8:	2f2a 0004      	movel %a2@(4),%sp@-
    21cc:	a983           	.short 0xa983
    21ce:	2f12           	movel %a2@,%sp@-
    21d0:	a873           	.short 0xa873
    21d2:	4a6e 000c      	tstw %fp@(12)
    21d6:	6f0a           	bles 0x21e2
    21d8:	2f0a           	movel %a2,%sp@-
    21da:	4eb9 0000 1b56 	jsr 0x1b56
    21e0:	584f           	addqw #4,%sp
    21e2:	204a           	moveal %a2,%a0
    21e4:	245f           	moveal %sp@+,%a2
    21e6:	4e5e           	unlk %fp
    21e8:	4e75           	rts
    21ea:	905f           	subw %sp@+,%d0
    21ec:	5f64           	subqw #7,%a4@-
    21ee:	745f           	moveq #95,%d2
    21f0:	5f37 4344      	subqb #7,%sp@(0)@(0)
    21f4:	6961           	bvss 0x2257
    21f6:	6c6f           	bges 0x2267
    21f8:	6746           	beqs 0x2240
    21fa:	7600           	moveq #0,%d3
    21fc:	0000 4e56      	orib #86,%d0
    2200:	0000 2f0a      	orib #10,%d0
    2204:	246e 0008      	moveal %fp@(8),%a2
    2208:	2f2a 0004      	movel %a2@(4),%sp@-
    220c:	a873           	.short 0xa873
    220e:	2f2a 0004      	movel %a2@(4),%sp@-
    2212:	a915           	.short 0xa915
    2214:	2f2a 0004      	movel %a2@(4),%sp@-
    2218:	a91f           	.short 0xa91f
    221a:	245f           	moveal %sp@+,%a2
    221c:	4e5e           	unlk %fp
    221e:	4e75           	rts
    2220:	9053           	subw %a3@,%d0
    2222:	686f           	bvcs 0x2293
    2224:	775f           	.short 0x775f
    2226:	5f37 4344      	subqb #7,%sp@(0)@(0)
    222a:	6961           	bvss 0x228d
    222c:	6c6f           	bges 0x229d
    222e:	6746           	beqs 0x2276
    2230:	7600           	moveq #0,%d3
    2232:	0000 4e56      	orib #86,%d0
    2236:	fffc           	.short 0xfffc
    2238:	2f0a           	movel %a2,%sp@-
    223a:	246e 0008      	moveal %fp@(8),%a2
    223e:	486e fffc      	pea %fp@(-4)
    2242:	a874           	.short 0xa874
    2244:	2f2a 0004      	movel %a2@(4),%sp@-
    2248:	a873           	.short 0xa873
    224a:	2f2a 0004      	movel %a2@(4),%sp@-
    224e:	a981           	.short 0xa981
    2250:	2f0a           	movel %a2,%sp@-
    2252:	2057           	moveal %sp@,%a0
    2254:	2268 000e      	moveal %a0@(14),%a1
    2258:	2269 0030      	moveal %a1@(48),%a1
    225c:	4e91           	jsr %a1@
    225e:	2f2e fffc      	movel %fp@(-4),%sp@-
    2262:	a873           	.short 0xa873
    2264:	584f           	addqw #4,%sp
    2266:	245f           	moveal %sp@+,%a2
    2268:	4e5e           	unlk %fp
    226a:	4e75           	rts
    226c:	9044           	subw %d4,%d0
    226e:	7261           	moveq #97,%d1
    2270:	775f           	.short 0x775f
    2272:	5f37 4344      	subqb #7,%sp@(0)@(0)
    2276:	6961           	bvss 0x22d9
    2278:	6c6f           	bges 0x22e9
    227a:	6746           	beqs 0x22c2
    227c:	7600           	moveq #0,%d3
    227e:	0000 4e56      	orib #86,%d0
    2282:	fffe           	.short 0xfffe
    2284:	48e7 1830      	moveml %d3-%d4/%a2-%a3,%sp@-
    2288:	266e 0008      	moveal %fp@(8),%a3
    228c:	7600           	moveq #0,%d3
    228e:	45f9 0000 1d44 	lea 0x1d44,%a2
    2294:	601e           	bras 0x22b4
    2296:	2f0a           	movel %a2,%sp@-
    2298:	486e fffe      	pea %fp@(-2)
    229c:	a991           	.short 0xa991
    229e:	3f2e fffe      	movew %fp@(-2),%sp@-
    22a2:	2f0b           	movel %a3,%sp@-
    22a4:	2057           	moveal %sp@,%a0
    22a6:	2268 000e      	moveal %a0@(14),%a1
    22aa:	2269 002c      	moveal %a1@(44),%a1
    22ae:	4e91           	jsr %a1@
    22b0:	1600           	moveb %d0,%d3
    22b2:	5c4f           	addqw #6,%sp
    22b4:	4a03           	tstb %d3
    22b6:	67de           	beqs 0x2296
    22b8:	0c6e 0001 fffe 	cmpiw #1,%fp@(-2)
    22be:	6604           	bnes 0x22c4
    22c0:	7801           	moveq #1,%d4
    22c2:	6002           	bras 0x22c6
    22c4:	7800           	moveq #0,%d4
    22c6:	1004           	moveb %d4,%d0
    22c8:	4cdf 0c18      	moveml %sp@+,%d3-%d4/%a2-%a3
    22cc:	4e5e           	unlk %fp
    22ce:	4e75           	rts
    22d0:	8e44           	orw %d4,%d7
    22d2:	6f5f           	bles 0x2333
    22d4:	5f37 4344      	subqb #7,%sp@(0)@(0)
    22d8:	6961           	bvss 0x233b
    22da:	6c6f           	bges 0x234b
    22dc:	6746           	beqs 0x2324
    22de:	7600           	moveq #0,%d3
    22e0:	0000 4e56      	orib #86,%d0
    22e4:	ffe2           	.short 0xffe2
    22e6:	48e7 1f30      	moveml %d3-%d7/%a2-%a3,%sp@-
    22ea:	262e 0010      	movel %fp@(16),%d3
    22ee:	266e 000c      	moveal %fp@(12),%a3
    22f2:	2e2e 0008      	movel %fp@(8),%d7
    22f6:	7800           	moveq #0,%d4
    22f8:	594f           	subqw #4,%sp
    22fa:	2f03           	movel %d3,%sp@-
    22fc:	a917           	.short 0xa917
    22fe:	201f           	movel %sp@+,%d0
    2300:	2440           	moveal %d0,%a2
    2302:	1d6a 000c ffeb 	moveb %a2@(12),%fp@(-21)
    2308:	486e ffe6      	pea %fp@(-26)
    230c:	a874           	.short 0xa874
    230e:	2f03           	movel %d3,%sp@-
    2310:	a873           	.short 0xa873
    2312:	3013           	movew %a3@,%d0
    2314:	6700 0172      	beqw 0x2488
    2318:	5340           	subqw #1,%d0
    231a:	6700 0140      	beqw 0x245c
    231e:	5540           	subqw #2,%d0
    2320:	6700 0086      	beqw 0x23a8
    2324:	5740           	subqw #3,%d0
    2326:	6704           	beqs 0x232c
    2328:	6000 015e      	braw 0x2488
    232c:	b6ab 0002      	cmpl %a3@(2),%d3
    2330:	6670           	bnes 0x23a2
    2332:	2f03           	movel %d3,%sp@-
    2334:	a922           	.short 0xa922
    2336:	4878 0021      	pea 0x21
    233a:	a862           	.short 0xa862
    233c:	2f03           	movel %d3,%sp@-
    233e:	a981           	.short 0xa981
    2340:	2f03           	movel %d3,%sp@-
    2342:	3f3c 0001      	movew #1,%sp@-
    2346:	486e fff2      	pea %fp@(-14)
    234a:	486e fff4      	pea %fp@(-12)
    234e:	486e fff8      	pea %fp@(-8)
    2352:	a98d           	.short 0xa98d
    2354:	206e fff4      	moveal %fp@(-12),%a0
    2358:	2050           	moveal %a0@,%a0
    235a:	2d68 0008 fff8 	movel %a0@(8),%fp@(-8)
    2360:	2d68 000c fffc 	movel %a0@(12),%fp@(-4)
    2366:	2f3c 0003 0003 	movel #196611,%sp@-
    236c:	a89b           	.short 0xa89b
    236e:	486e fff8      	pea %fp@(-8)
    2372:	2f3c fffc fffc 	movel #-196612,%sp@-
    2378:	a8a9           	.short 0xa8a9
    237a:	486e fff8      	pea %fp@(-8)
    237e:	2f3c 0010 0010 	movel #1048592,%sp@-
    2384:	a8b0           	.short 0xa8b0
    2386:	2f3c 0001 0001 	movel #65537,%sp@-
    238c:	a89b           	.short 0xa89b
    238e:	2f0a           	movel %a2,%sp@-
    2390:	2057           	moveal %sp@,%a0
    2392:	2268 000e      	moveal %a0@(14),%a1
    2396:	2269 0030      	moveal %a1@(48),%a1
    239a:	4e91           	jsr %a1@
    239c:	2f03           	movel %d3,%sp@-
    239e:	a923           	.short 0xa923
    23a0:	584f           	addqw #4,%sp
    23a2:	7801           	moveq #1,%d4
    23a4:	6000 00f2      	braw 0x2498
    23a8:	2a2b 0002      	movel %a3@(2),%d5
    23ac:	0285 0000 00ff 	andil #255,%d5
    23b2:	7c00           	moveq #0,%d6
    23b4:	0c05 000d      	cmpib #13,%d5
    23b8:	6706           	beqs 0x23c0
    23ba:	0c05 0003      	cmpib #3,%d5
    23be:	660e           	bnes 0x23ce
    23c0:	4a2a 000c      	tstb %a2@(12)
    23c4:	6708           	beqs 0x23ce
    23c6:	2047           	moveal %d7,%a0
    23c8:	30bc 0001      	movew #1,%a0@
    23cc:	7c01           	moveq #1,%d6
    23ce:	082b 0000 000e 	btst #0,%a3@(14)
    23d4:	6706           	beqs 0x23dc
    23d6:	0c05 002e      	cmpib #46,%d5
    23da:	6706           	beqs 0x23e2
    23dc:	0c05 001b      	cmpib #27,%d5
    23e0:	6608           	bnes 0x23ea
    23e2:	2047           	moveal %d7,%a0
    23e4:	30bc 0002      	movew #2,%a0@
    23e8:	7c02           	moveq #2,%d6
    23ea:	4a46           	tstw %d6
    23ec:	6754           	beqs 0x2442
    23ee:	554f           	subqw #2,%sp
    23f0:	2f03           	movel %d3,%sp@-
    23f2:	4eb9 0000 1b78 	jsr 0x1b78
    23f8:	301f           	movew %sp@+,%d0
    23fa:	6746           	beqs 0x2442
    23fc:	2f03           	movel %d3,%sp@-
    23fe:	3f06           	movew %d6,%sp@-
    2400:	486e fff2      	pea %fp@(-14)
    2404:	486e fff4      	pea %fp@(-12)
    2408:	486e fff8      	pea %fp@(-8)
    240c:	a98d           	.short 0xa98d
    240e:	4a6e fff2      	tstw %fp@(-14)
    2412:	660a           	bnes 0x241e
    2414:	2f2e fff4      	movel %fp@(-12),%sp@-
    2418:	3f3c 000a      	movew #10,%sp@-
    241c:	a95d           	.short 0xa95d
    241e:	207c 0000 000a 	moveal #10,%a0
    2424:	43ee ffe2      	lea %fp@(-30),%a1
    2428:	a03b           	.short 0xa03b
    242a:	2280           	movel %d0,%a1@
    242c:	3f06           	movew %d6,%sp@-
    242e:	2f0a           	movel %a2,%sp@-
    2430:	2057           	moveal %sp@,%a0
    2432:	2268 000e      	moveal %a0@(14),%a1
    2436:	2269 002c      	moveal %a1@(44),%a1
    243a:	4e91           	jsr %a1@
    243c:	7801           	moveq #1,%d4
    243e:	5c4f           	addqw #6,%sp
    2440:	6056           	bras 0x2498
    2442:	3f2b 000e      	movew %a3@(14),%sp@-
    2446:	1f05           	moveb %d5,%sp@-
    2448:	2f0a           	movel %a2,%sp@-
    244a:	2057           	moveal %sp@,%a0
    244c:	2268 000e      	moveal %a0@(14),%a1
    2450:	2269 0034      	moveal %a1@(52),%a1
    2454:	4e91           	jsr %a1@
    2456:	1800           	moveb %d0,%d4
    2458:	504f           	addqw #8,%sp
    245a:	603c           	bras 0x2498
    245c:	2d6b 000a ffee 	movel %a3@(10),%fp@(-18)
    2462:	486e ffee      	pea %fp@(-18)
    2466:	a871           	.short 0xa871
    2468:	2f07           	movel %d7,%sp@-
    246a:	3f2b 000e      	movew %a3@(14),%sp@-
    246e:	2f2e ffee      	movel %fp@(-18),%sp@-
    2472:	2f0a           	movel %a2,%sp@-
    2474:	2057           	moveal %sp@,%a0
    2476:	2268 000e      	moveal %a0@(14),%a1
    247a:	2269 003c      	moveal %a1@(60),%a1
    247e:	4e91           	jsr %a1@
    2480:	1800           	moveb %d0,%d4
    2482:	4fef 000e      	lea %sp@(14),%sp
    2486:	6010           	bras 0x2498
    2488:	2f0a           	movel %a2,%sp@-
    248a:	2057           	moveal %sp@,%a0
    248c:	2268 000e      	moveal %a0@(14),%a1
    2490:	2269 0038      	moveal %a1@(56),%a1
    2494:	4e91           	jsr %a1@
    2496:	584f           	addqw #4,%sp
    2498:	102a 000c      	moveb %a2@(12),%d0
    249c:	b02e ffeb      	cmpb %fp@(-21),%d0
    24a0:	6730           	beqs 0x24d2
    24a2:	2f03           	movel %d3,%sp@-
    24a4:	3f3c 0001      	movew #1,%sp@-
    24a8:	486e fff2      	pea %fp@(-14)
    24ac:	486e fff4      	pea %fp@(-12)
    24b0:	486e fff8      	pea %fp@(-8)
    24b4:	a98d           	.short 0xa98d
    24b6:	4a2a 000c      	tstb %a2@(12)
    24ba:	6706           	beqs 0x24c2
    24bc:	426e ffec      	clrw %fp@(-20)
    24c0:	6006           	bras 0x24c8
    24c2:	3d7c 00ff ffec 	movew #255,%fp@(-20)
    24c8:	2f2e fff4      	movel %fp@(-12),%sp@-
    24cc:	3f2e ffec      	movew %fp@(-20),%sp@-
    24d0:	a95d           	.short 0xa95d
    24d2:	2f2e ffe6      	movel %fp@(-26),%sp@-
    24d6:	a873           	.short 0xa873
    24d8:	1f44 004e      	moveb %d4,%sp@(78)
    24dc:	4cdf 0cf8      	moveml %sp@+,%d3-%d7/%a2-%a3
    24e0:	4e5e           	unlk %fp
    24e2:	205f           	moveal %sp@+,%a0
    24e4:	4fef 000c      	lea %sp@(12),%sp
    24e8:	4ed0           	jmp %a0@
    24ea:	8035 4469      	orb %a5@(69,%d4:w:4),%d0
    24ee:	616c           	bsrs 0x255c
    24f0:	6f67           	bles 0x2559
    24f2:	4669 6c74      	notw %a1@(27764)
    24f6:	6572           	bcss 0x256a
    24f8:	5072 6f63 5f5f 	addqw #8,%a2@(5f5f)@(37434469)
    24fe:	3743 4469 
    2502:	616c           	bsrs 0x2570
    2504:	6f67           	bles 0x256d
    2506:	4650           	notw %a0@
    2508:	3847           	moveaw %d7,%a4
    250a:	7261           	moveq #97,%d1
    250c:	6650           	bnes 0x255e
    250e:	6f72           	bles 0x2582
    2510:	7450           	moveq #80,%d2
    2512:	3131 4576 656e 	movew %a1@(656e7452)@(6563),%a0@-
    2518:	7452 6563 
    251c:	6f72           	bles 0x2590
    251e:	6450           	bccs 0x2570
    2520:	7300           	.short 0x7300
    2522:	0000 4e56      	orib #86,%d0
    2526:	fff2           	.short 0xfff2
    2528:	206e 0008      	moveal %fp@(8),%a0
    252c:	2f28 0004      	movel %a0@(4),%sp@-
    2530:	3f2e 000c      	movew %fp@(12),%sp@-
    2534:	486e fffa      	pea %fp@(-6)
    2538:	486e fffc      	pea %fp@(-4)
    253c:	486e fff2      	pea %fp@(-14)
    2540:	a98d           	.short 0xa98d
    2542:	2f2e fffc      	movel %fp@(-4),%sp@-
    2546:	2f2e 000e      	movel %fp@(14),%sp@-
    254a:	a990           	.short 0xa990
    254c:	4e5e           	unlk %fp
    254e:	4e75           	rts
    2550:	9a47           	subw %d7,%d5
    2552:	6574           	bcss 0x25c8
    2554:	4974           	.short 0x4974
    2556:	656d           	bcss 0x25c5
    2558:	5465           	addqw #2,%a5@-
    255a:	7874           	moveq #116,%d4
    255c:	5f5f           	subqw #7,%sp@+
    255e:	3743 4469      	movew %d3,%a3@(17513)
    2562:	616c           	bsrs 0x25d0
    2564:	6f67           	bles 0x25cd
    2566:	4673 5055      	notw %a3@(55,%d5:w)
    256a:	6300 0000      	blsw 0x256c
    256e:	4e56 fefc      	linkw %fp,#-260
    2572:	486e fefc      	pea %fp@(-260)
    2576:	3f2e 000c      	movew %fp@(12),%sp@-
    257a:	2f2e 0008      	movel %fp@(8),%sp@-
    257e:	2057           	moveal %sp@,%a0
    2580:	2268 000e      	moveal %a0@(14),%a1
    2584:	2269 0014      	moveal %a1@(20),%a1
    2588:	4e91           	jsr %a1@
    258a:	42ae fffc      	clrl %fp@(-4)
    258e:	486e fefc      	pea %fp@(-260)
    2592:	486e fffc      	pea %fp@(-4)
    2596:	4eb9 0000 1b8c 	jsr 0x1b8c
    259c:	202e fffc      	movel %fp@(-4),%d0
    25a0:	4e5e           	unlk %fp
    25a2:	4e75           	rts
    25a4:	9847           	subw %d7,%d4
    25a6:	6574           	bcss 0x261c
    25a8:	4974           	.short 0x4974
    25aa:	656d           	bcss 0x2619
    25ac:	5661           	addqw #3,%a1@-
    25ae:	6c75           	bges 0x2625
    25b0:	655f           	bcss 0x2611
    25b2:	5f37 4344      	subqb #7,%sp@(0)@(0)
    25b6:	6961           	bvss 0x2619
    25b8:	6c6f           	bges 0x2629
    25ba:	6746           	beqs 0x2602
    25bc:	7300           	.short 0x7300
    25be:	0000 4e56      	orib #86,%d0
    25c2:	fff2           	.short 0xfff2
    25c4:	48e7 1820      	moveml %d3-%d4/%a2,%sp@-
    25c8:	246e 0008      	moveal %fp@(8),%a2
    25cc:	2f2a 0004      	movel %a2@(4),%sp@-
    25d0:	3f2e 000c      	movew %fp@(12),%sp@-
    25d4:	486e fffa      	pea %fp@(-6)
    25d8:	486e fffc      	pea %fp@(-4)
    25dc:	486e fff2      	pea %fp@(-14)
    25e0:	a98d           	.short 0xa98d
    25e2:	554f           	subqw #2,%sp
    25e4:	2f2e fffc      	movel %fp@(-4),%sp@-
    25e8:	a960           	.short 0xa960
    25ea:	301f           	movew %sp@+,%d0
    25ec:	3800           	movew %d0,%d4
    25ee:	6704           	beqs 0x25f4
    25f0:	7600           	moveq #0,%d3
    25f2:	6002           	bras 0x25f6
    25f4:	7601           	moveq #1,%d3
    25f6:	2f2e fffc      	movel %fp@(-4),%sp@-
    25fa:	3f03           	movew %d3,%sp@-
    25fc:	a963           	.short 0xa963
    25fe:	4cdf 0418      	moveml %sp@+,%d3-%d4/%a2
    2602:	4e5e           	unlk %fp
    2604:	4e75           	rts
    2606:	9a54           	subw %a4@,%d5
    2608:	6f67           	bles 0x2671
    260a:	676c           	beqs 0x2678
    260c:	6543           	bcss 0x2651
    260e:	6865           	bvcs 0x2675
    2610:	636b           	blss 0x267d
    2612:	426f 785f      	clrw %sp@(30815)
    2616:	5f37 4344      	subqb #7,%sp@(0)@(0)
    261a:	6961           	bvss 0x267d
    261c:	6c6f           	bges 0x268d
    261e:	6746           	beqs 0x2666
    2620:	7300           	.short 0x7300
    2622:	0000 4e56      	orib #86,%d0
    2626:	0000 206e      	orib #110,%d0
    262a:	0008           	.short 0x0008
    262c:	116e 000c 000d 	moveb %fp@(12),%a0@(13)
    2632:	4e5e           	unlk %fp
    2634:	4e75           	rts
    2636:	9953           	subw %d4,%a3@
    2638:	6574           	bcss 0x26ae
    263a:	4973           	.short 0x4973
    263c:	4d6f           	.short 0x4d6f
    263e:	7661           	moveq #97,%d3
    2640:	626c           	bhis 0x26ae
    2642:	655f           	bcss 0x26a3
    2644:	5f37 4344      	subqb #7,%sp@(0)@(0)
    2648:	6961           	bvss 0x26ab
    264a:	6c6f           	bges 0x26bb
    264c:	6746           	beqs 0x2694
    264e:	5563           	subqw #2,%a3@-
    2650:	0000 4e56      	orib #86,%d0
    2654:	0000 206e      	orib #110,%d0
    2658:	0008           	.short 0x0008
    265a:	1028 000d      	moveb %a0@(13),%d0
    265e:	4e5e           	unlk %fp
    2660:	4e75           	rts
    2662:	9549           	subxw %a1@-,%a2@-
    2664:	734d           	.short 0x734d
    2666:	6f76           	bles 0x26de
    2668:	6162           	bsrs 0x26cc
    266a:	6c65           	bges 0x26d1
    266c:	5f5f           	subqw #7,%sp@+
    266e:	3743 4469      	movew %d3,%a3@(17513)
    2672:	616c           	bsrs 0x26e0
    2674:	6f67           	bles 0x26dd
    2676:	4676 0000      	notw %fp@(0,%d0:w)
    267a:	4e56 0000      	linkw %fp,#0
    267e:	206e 0008      	moveal %fp@(8),%a0
    2682:	2f28 0004      	movel %a0@(4),%sp@-
    2686:	2f2e 000c      	movel %fp@(12),%sp@-
    268a:	a91a           	.short 0xa91a
    268c:	4e5e           	unlk %fp
    268e:	4e75           	rts
    2690:	9653           	subw %a3@,%d3
    2692:	6574           	bcss 0x2708
    2694:	5469 746c      	addqw #2,%a1@(29804)
    2698:	655f           	bcss 0x26f9
    269a:	5f37 4344      	subqb #7,%sp@(0)@(0)
    269e:	6961           	bvss 0x2701
    26a0:	6c6f           	bges 0x2711
    26a2:	6746           	beqs 0x26ea
    26a4:	5055           	addqw #8,%a5@
    26a6:	6300 0000      	blsw 0x26a8
    26aa:	4e56 0000      	linkw %fp,#0
    26ae:	48e7 1030      	moveml %d3/%a2-%a3,%sp@-
    26b2:	246e 0008      	moveal %fp@(8),%a2
    26b6:	266e 000e      	moveal %fp@(14),%a3
    26ba:	2f0b           	movel %a3,%sp@-
    26bc:	3f2e 000c      	movew %fp@(12),%sp@-
    26c0:	2f0a           	movel %a2,%sp@-
    26c2:	4eb9 0000 1bb2 	jsr 0x1bb2
    26c8:	41ec 0008      	lea %a4@(8),%a0
    26cc:	2548 000e      	movel %a0,%a2@(14)
    26d0:	200b           	movel %a3,%d0
    26d2:	4840           	swap %d0
    26d4:	48c0           	extl %d0
    26d6:	3540 0012      	movew %d0,%a2@(18)
    26da:	200b           	movel %a3,%d0
    26dc:	3540 0014      	movew %d0,%a2@(20)
    26e0:	7600           	moveq #0,%d3
    26e2:	4fef 000a      	lea %sp@(10),%sp
    26e6:	600a           	bras 0x26f2
    26e8:	2003           	movel %d3,%d0
    26ea:	e188           	lsll #8,%d0
    26ec:	4232 0816      	clrb %a2@(16,%d0:l)
    26f0:	5283           	addql #1,%d3
    26f2:	7006           	moveq #6,%d0
    26f4:	b680           	cmpl %d0,%d3
    26f6:	6df0           	blts 0x26e8
    26f8:	426a 0616      	clrw %a2@(1558)
    26fc:	422a 061a      	clrb %a2@(1562)
    2700:	426a 0618      	clrw %a2@(1560)
    2704:	204a           	moveal %a2,%a0
    2706:	4cdf 0c08      	moveml %sp@+,%d3/%a2-%a3
    270a:	4e5e           	unlk %fp
    270c:	4e75           	rts
    270e:	975f           	subw %d3,%sp@+
    2710:	5f63           	subqw #7,%a3@-
    2712:	745f           	moveq #95,%d2
    2714:	5f31 3143 5343 	subqb #7,%a1@(0)@(53435349)
    271a:	5349 
    271c:	4469 616c      	negw %a1@(24940)
    2720:	6f67           	bles 0x2789
    2722:	4673 5076      	notw %a3@(76,%d5:w)
    2726:	0000 4e56      	orib #86,%d0
    272a:	0000 2f0a      	orib #10,%d0
    272e:	246e 0008      	moveal %fp@(8),%a2
    2732:	200a           	movel %a2,%d0
    2734:	6724           	beqs 0x275a
    2736:	41ec 0008      	lea %a4@(8),%a0
    273a:	2548 000e      	movel %a0,%a2@(14)
    273e:	4267           	clrw %sp@-
    2740:	2f0a           	movel %a2,%sp@-
    2742:	4eb9 0000 1c0e 	jsr 0x1c0e
    2748:	4a6e 000c      	tstw %fp@(12)
    274c:	5c4f           	addqw #6,%sp
    274e:	6f0a           	bles 0x275a
    2750:	2f0a           	movel %a2,%sp@-
    2752:	4eb9 0000 1b56 	jsr 0x1b56
    2758:	584f           	addqw #4,%sp
    275a:	204a           	moveal %a2,%a0
    275c:	245f           	moveal %sp@+,%a2
    275e:	4e5e           	unlk %fp
    2760:	4e75           	rts
    2762:	955f           	subw %d2,%sp@+
    2764:	5f64           	subqw #7,%a4@-
    2766:	745f           	moveq #95,%d2
    2768:	5f31 3143 5343 	subqb #7,%a1@(0)@(53435349)
    276e:	5349 
    2770:	4469 616c      	negw %a1@(24940)
    2774:	6f67           	bles 0x27dd
    2776:	4676 0000      	notw %fp@(0,%d0:w)
    277a:	4e56 0000      	linkw %fp,#0
    277e:	2f0b           	movel %a3,%sp@-
    2780:	2f05           	movel %d5,%sp@-
    2782:	226e 0008      	moveal %fp@(8),%a1
    2786:	3a2e 000c      	movew %fp@(12),%d5
    278a:	266e 000e      	moveal %fp@(14),%a3
    278e:	7200           	moveq #0,%d1
    2790:	6012           	bras 0x27a4
    2792:	3045           	moveaw %d5,%a0
    2794:	2008           	movel %a0,%d0
    2796:	e188           	lsll #8,%d0
    2798:	2049           	moveal %a1,%a0
    279a:	d1c0           	addal %d0,%a0
    279c:	11b3 1800 1816 	moveb %a3@(0,%d1:l),%a0@(16,%d1:l)
    27a2:	5281           	addql #1,%d1
    27a4:	7000           	moveq #0,%d0
    27a6:	1013           	moveb %a3@,%d0
    27a8:	5240           	addqw #1,%d0
    27aa:	48c0           	extl %d0
    27ac:	b280           	cmpl %d0,%d1
    27ae:	6de2           	blts 0x2792
    27b0:	4269 0618      	clrw %a1@(1560)
    27b4:	7400           	moveq #0,%d2
    27b6:	6010           	bras 0x27c8
    27b8:	2002           	movel %d2,%d0
    27ba:	e188           	lsll #8,%d0
    27bc:	4a31 0816      	tstb %a1@(16,%d0:l)
    27c0:	6704           	beqs 0x27c6
    27c2:	5269 0618      	addqw #1,%a1@(1560)
    27c6:	5282           	addql #1,%d2
    27c8:	7006           	moveq #6,%d0
    27ca:	b480           	cmpl %d0,%d2
    27cc:	6dea           	blts 0x27b8
    27ce:	2a1f           	movel %sp@+,%d5
    27d0:	265f           	moveal %sp@+,%a3
    27d2:	4e5e           	unlk %fp
    27d4:	4e75           	rts
    27d6:	9b53           	subw %d5,%a3@
    27d8:	6574           	bcss 0x284e
    27da:	4c69           	.short 0x4c69
    27dc:	6e65           	bgts 0x2843
    27de:	5f5f           	subqw #7,%sp@+
    27e0:	3131 4353 4353 	movew %a1@(0)@(43534944),%a0@-
    27e6:	4944 
    27e8:	6961           	bvss 0x284b
    27ea:	6c6f           	bges 0x285b
    27ec:	6746           	beqs 0x2834
    27ee:	7350           	.short 0x7350
    27f0:	5563           	subqw #2,%a3@-
    27f2:	0000 4e56      	orib #86,%d0
    27f6:	0000 342e      	orib #46,%d0
    27fa:	000c           	.short 0x000c
    27fc:	7001           	moveq #1,%d0
    27fe:	0c42 0001      	cmpiw #1,%d2
    2802:	6708           	beqs 0x280c
    2804:	0c42 0002      	cmpiw #2,%d2
    2808:	6702           	beqs 0x280c
    280a:	7000           	moveq #0,%d0
    280c:	4a00           	tstb %d0
    280e:	6704           	beqs 0x2814
    2810:	7201           	moveq #1,%d1
    2812:	6002           	bras 0x2816
    2814:	7200           	moveq #0,%d1
    2816:	1001           	moveb %d1,%d0
    2818:	4e5e           	unlk %fp
    281a:	4e75           	rts
    281c:	9a44           	subw %d4,%d5
    281e:	6f49           	bles 0x2869
    2820:	7465           	moveq #101,%d2
    2822:	6d48           	blts 0x286c
    2824:	6974           	bvss 0x289a
    2826:	5f5f           	subqw #7,%sp@+
    2828:	3131 4353 4353 	movew %a1@(0)@(43534944),%a0@-
    282e:	4944 
    2830:	6961           	bvss 0x2893
    2832:	6c6f           	bges 0x28a3
    2834:	6746           	beqs 0x287c
    2836:	7300           	.short 0x7300
    2838:	0000 4e56      	orib #86,%d0
    283c:	ffea           	.short 0xffea
    283e:	48e7 1c20      	moveml %d3-%d5/%a2,%sp@-
    2842:	246e 0008      	moveal %fp@(8),%a2
    2846:	2f2a 0004      	movel %a2@(4),%sp@-
    284a:	3f3c 0003      	movew #3,%sp@-
    284e:	486e ffee      	pea %fp@(-18)
    2852:	486e ffea      	pea %fp@(-22)
    2856:	486e fff0      	pea %fp@(-16)
    285a:	a98d           	.short 0xa98d
    285c:	486e fff0      	pea %fp@(-16)
    2860:	a8a3           	.short 0xa8a3
    2862:	3f3c 0003      	movew #3,%sp@-
    2866:	a887           	.short 0xa887
    2868:	3f3c 0009      	movew #9,%sp@-
    286c:	a88a           	.short 0xa88a
    286e:	7600           	moveq #0,%d3
    2870:	3a2a 0616      	movew %a2@(1558),%d5
    2874:	5345           	subqw #1,%d5
    2876:	2d6e fff0 fff8 	movel %fp@(-16),%fp@(-8)
    287c:	2d6e fff4 fffc 	movel %fp@(-12),%fp@(-4)
    2882:	526e fff8      	addqw #1,%fp@(-8)
    2886:	526e fffa      	addqw #1,%fp@(-6)
    288a:	536e fffe      	subqw #1,%fp@(-2)
    288e:	700c           	moveq #12,%d0
    2890:	d06e fff8      	addw %fp@(-8),%d0
    2894:	3d40 fffc      	movew %d0,%fp@(-4)
    2898:	7800           	moveq #0,%d4
    289a:	6058           	bras 0x28f4
    289c:	2004           	movel %d4,%d0
    289e:	e188           	lsll #8,%d0
    28a0:	4a32 0816      	tstb %a2@(16,%d0:l)
    28a4:	674c           	beqs 0x28f2
    28a6:	302e fffa      	movew %fp@(-6),%d0
    28aa:	5240           	addqw #1,%d0
    28ac:	3f00           	movew %d0,%sp@-
    28ae:	302e fffc      	movew %fp@(-4),%d0
    28b2:	5540           	subqw #2,%d0
    28b4:	3f00           	movew %d0,%sp@-
    28b6:	a893           	.short 0xa893
    28b8:	3043           	moveaw %d3,%a0
    28ba:	2008           	movel %a0,%d0
    28bc:	e188           	lsll #8,%d0
    28be:	4872 0816      	pea %a2@(16,%d0:l)
    28c2:	a884           	.short 0xa884
    28c4:	b645           	cmpw %d5,%d3
    28c6:	661c           	bnes 0x28e4
    28c8:	554f           	subqw #2,%sp
    28ca:	1eb8 0938      	moveb 0x938,%sp@
    28ce:	101f           	moveb %sp@+,%d0
    28d0:	7200           	moveq #0,%d1
    28d2:	1200           	moveb %d0,%d1
    28d4:	0241 ff7f      	andiw #-129,%d1
    28d8:	1f01           	moveb %d1,%sp@-
    28da:	11df 0938      	moveb %sp@+,0x938
    28de:	486e fff8      	pea %fp@(-8)
    28e2:	a8a4           	.short 0xa8a4
    28e4:	5243           	addqw #1,%d3
    28e6:	486e fff8      	pea %fp@(-8)
    28ea:	2f3c 000c 0000 	movel #786432,%sp@-
    28f0:	a8a8           	.short 0xa8a8
    28f2:	5284           	addql #1,%d4
    28f4:	7006           	moveq #6,%d0
    28f6:	b880           	cmpl %d0,%d4
    28f8:	6da2           	blts 0x289c
    28fa:	486e fff0      	pea %fp@(-16)
    28fe:	a8a1           	.short 0xa8a1
    2900:	4cdf 0438      	moveml %sp@+,%d3-%d5/%a2
    2904:	4e5e           	unlk %fp
    2906:	4e75           	rts
    2908:	9744           	subxw %d4,%d3
    290a:	6f44           	bles 0x2950
    290c:	7261           	moveq #97,%d1
    290e:	775f           	.short 0x775f
    2910:	5f31 3143 5343 	subqb #7,%a1@(0)@(53435349)
    2916:	5349 
    2918:	4469 616c      	negw %a1@(24940)
    291c:	6f67           	bles 0x2985
    291e:	4676 0000      	notw %fp@(0,%d0:w)
    2922:	4e56 0000      	linkw %fp,#0
    2926:	7000           	moveq #0,%d0
    2928:	4e5e           	unlk %fp
    292a:	4e75           	rts
    292c:	9c44           	subw %d4,%d6
    292e:	6f4b           	bles 0x297b
    2930:	6579           	bcss 0x29ab
    2932:	5072 6573 735f 	addqw #8,%a2@(735f5f31)@(31435343)
    2938:	5f31 3143 5343 
    293e:	5349           	subqw #1,%a1
    2940:	4469 616c      	negw %a1@(24940)
    2944:	6f67           	bles 0x29ad
    2946:	4663           	notw %a3@-
    2948:	7300           	.short 0x7300
    294a:	0000 4e56      	orib #86,%d0
    294e:	0000 206e      	orib #110,%d0
    2952:	0008           	.short 0x0008
    2954:	4a68 0616      	tstw %a0@(1558)
    2958:	6704           	beqs 0x295e
    295a:	7001           	moveq #1,%d0
    295c:	6002           	bras 0x2960
    295e:	7000           	moveq #0,%d0
    2960:	1140 000c      	moveb %d0,%a0@(12)
    2964:	4e5e           	unlk %fp
    2966:	4e75           	rts
    2968:	9744           	subxw %d4,%d3
    296a:	6f4e           	bles 0x29ba
    296c:	756c           	.short 0x756c
    296e:	6c5f           	bges 0x29cf
    2970:	5f31 3143 5343 	subqb #7,%a1@(0)@(53435349)
    2976:	5349 
    2978:	4469 616c      	negw %a1@(24940)
    297c:	6f67           	bles 0x29e5
    297e:	4676 0000      	notw %fp@(0,%d0:w)
    2982:	4e56 ffea      	linkw %fp,#-22
    2986:	48e7 1c20      	moveml %d3-%d5/%a2,%sp@-
    298a:	246e 0008      	moveal %fp@(8),%a2
    298e:	4a2a 061a      	tstb %a2@(1562)
    2992:	6700 00ba      	beqw 0x2a4e
    2996:	2f2a 0004      	movel %a2@(4),%sp@-
    299a:	3f3c 0003      	movew #3,%sp@-
    299e:	486e ffee      	pea %fp@(-18)
    29a2:	486e ffea      	pea %fp@(-22)
    29a6:	486e fff0      	pea %fp@(-16)
    29aa:	a98d           	.short 0xa98d
    29ac:	554f           	subqw #2,%sp
    29ae:	2f2e 000c      	movel %fp@(12),%sp@-
    29b2:	486e fff0      	pea %fp@(-16)
    29b6:	a8ad           	.short 0xa8ad
    29b8:	101f           	moveb %sp@+,%d0
    29ba:	6700 0092      	beqw 0x2a4e
    29be:	7600           	moveq #0,%d3
    29c0:	3a2a 0616      	movew %a2@(1558),%d5
    29c4:	5345           	subqw #1,%d5
    29c6:	2d6e fff0 fff8 	movel %fp@(-16),%fp@(-8)
    29cc:	2d6e fff4 fffc 	movel %fp@(-12),%fp@(-4)
    29d2:	526e fff8      	addqw #1,%fp@(-8)
    29d6:	526e fffa      	addqw #1,%fp@(-6)
    29da:	536e fffe      	subqw #1,%fp@(-2)
    29de:	700c           	moveq #12,%d0
    29e0:	d06e fff8      	addw %fp@(-8),%d0
    29e4:	3d40 fffc      	movew %d0,%fp@(-4)
    29e8:	7800           	moveq #0,%d4
    29ea:	6048           	bras 0x2a34
    29ec:	2004           	movel %d4,%d0
    29ee:	e188           	lsll #8,%d0
    29f0:	4a32 0816      	tstb %a2@(16,%d0:l)
    29f4:	673c           	beqs 0x2a32
    29f6:	5243           	addqw #1,%d3
    29f8:	554f           	subqw #2,%sp
    29fa:	2f2e 000c      	movel %fp@(12),%sp@-
    29fe:	486e fff8      	pea %fp@(-8)
    2a02:	a8ad           	.short 0xa8ad
    2a04:	101f           	moveb %sp@+,%d0
    2a06:	671e           	beqs 0x2a26
    2a08:	b66a 0618      	cmpw %a2@(1560),%d3
    2a0c:	6c18           	bges 0x2a26
    2a0e:	3543 0616      	movew %d3,%a2@(1558)
    2a12:	2f0a           	movel %a2,%sp@-
    2a14:	2057           	moveal %sp@,%a0
    2a16:	2268 000e      	moveal %a0@(14),%a1
    2a1a:	2269 0030      	moveal %a1@(48),%a1
    2a1e:	4e91           	jsr %a1@
    2a20:	7001           	moveq #1,%d0
    2a22:	584f           	addqw #4,%sp
    2a24:	602a           	bras 0x2a50
    2a26:	486e fff8      	pea %fp@(-8)
    2a2a:	2f3c 000c 0000 	movel #786432,%sp@-
    2a30:	a8a8           	.short 0xa8a8
    2a32:	5284           	addql #1,%d4
    2a34:	7006           	moveq #6,%d0
    2a36:	b880           	cmpl %d0,%d4
    2a38:	6db2           	blts 0x29ec
    2a3a:	426a 0616      	clrw %a2@(1558)
    2a3e:	2f0a           	movel %a2,%sp@-
    2a40:	2057           	moveal %sp@,%a0
    2a42:	2268 000e      	moveal %a0@(14),%a1
    2a46:	2269 0030      	moveal %a1@(48),%a1
    2a4a:	4e91           	jsr %a1@
    2a4c:	584f           	addqw #4,%sp
    2a4e:	7000           	moveq #0,%d0
    2a50:	4cdf 0438      	moveml %sp@+,%d3-%d5/%a2
    2a54:	4e5e           	unlk %fp
    2a56:	4e75           	rts
    2a58:	8024           	orb %a4@-,%d0
    2a5a:	446f 4d6f      	negw %sp@(19823)
    2a5e:	7573           	.short 0x7573
    2a60:	6544           	bcss 0x2aa6
    2a62:	6f77           	bles 0x2adb
    2a64:	6e5f           	bgts 0x2ac5
    2a66:	5f31 3143 5343 	subqb #7,%a1@(0)@(53435349)
    2a6c:	5349 
    2a6e:	4469 616c      	negw %a1@(24940)
    2a72:	6f67           	bles 0x2adb
    2a74:	4635 506f      	notb %a5@(6f,%d5:w)
    2a78:	696e           	bvss 0x2ae8
    2a7a:	7473           	moveq #115,%d2
    2a7c:	5073 0000      	addqw #8,%a3@(0,%d0:w)
    2a80:	2f0a           	movel %a2,%sp@-
    2a82:	246f 0008      	moveal %sp@(8),%a2
    2a86:	2f2f 000e      	movel %sp@(14),%sp@-
    2a8a:	3f2f 0010      	movew %sp@(16),%sp@-
    2a8e:	2f0a           	movel %a2,%sp@-
    2a90:	4eb9 0000 2502 	jsr 0x2502
    2a96:	204a           	moveal %a2,%a0
    2a98:	4fef 000a      	lea %sp@(10),%sp
    2a9c:	245f           	moveal %sp@+,%a2
    2a9e:	4e75           	rts
    2aa0:	48e7 1e00      	moveml %d3-%d6,%sp@-
    2aa4:	226f 0014      	moveal %sp@(20),%a1
    2aa8:	2a2f 001a      	movel %sp@(26),%d5
    2aac:	7600           	moveq #0,%d3
    2aae:	162f 0019      	moveb %sp@(25),%d3
    2ab2:	7020           	moveq #32,%d0
    2ab4:	ba80           	cmpl %d0,%d5
    2ab6:	6500 0086      	bcsw 0x2b3e
    2aba:	7003           	moveq #3,%d0
    2abc:	2809           	movel %a1,%d4
    2abe:	4484           	negl %d4
    2ac0:	c880           	andl %d0,%d4
    2ac2:	670c           	beqs 0x2ad0
    2ac4:	9a84           	subl %d4,%d5
    2ac6:	2049           	moveal %a1,%a0
    2ac8:	5289           	addql #1,%a1
    2aca:	1083           	moveb %d3,%a0@
    2acc:	5384           	subql #1,%d4
    2ace:	66f6           	bnes 0x2ac6
    2ad0:	4a83           	tstl %d3
    2ad2:	6716           	beqs 0x2aea
    2ad4:	2003           	movel %d3,%d0
    2ad6:	4840           	swap %d0
    2ad8:	4240           	clrw %d0
    2ada:	2203           	movel %d3,%d1
    2adc:	7418           	moveq #24,%d2
    2ade:	e5a9           	lsll %d2,%d1
    2ae0:	8280           	orl %d0,%d1
    2ae2:	2003           	movel %d3,%d0
    2ae4:	e188           	lsll #8,%d0
    2ae6:	8081           	orl %d1,%d0
    2ae8:	8680           	orl %d0,%d3
    2aea:	2805           	movel %d5,%d4
    2aec:	ea8c           	lsrl #5,%d4
    2aee:	2c04           	movel %d4,%d6
    2af0:	6734           	beqs 0x2b26
    2af2:	2049           	moveal %a1,%a0
    2af4:	5889           	addql #4,%a1
    2af6:	2083           	movel %d3,%a0@
    2af8:	2049           	moveal %a1,%a0
    2afa:	5889           	addql #4,%a1
    2afc:	2083           	movel %d3,%a0@
    2afe:	2049           	moveal %a1,%a0
    2b00:	5889           	addql #4,%a1
    2b02:	2083           	movel %d3,%a0@
    2b04:	2049           	moveal %a1,%a0
    2b06:	5889           	addql #4,%a1
    2b08:	2083           	movel %d3,%a0@
    2b0a:	2049           	moveal %a1,%a0
    2b0c:	5889           	addql #4,%a1
    2b0e:	2083           	movel %d3,%a0@
    2b10:	2049           	moveal %a1,%a0
    2b12:	5889           	addql #4,%a1
    2b14:	2083           	movel %d3,%a0@
    2b16:	2049           	moveal %a1,%a0
    2b18:	5889           	addql #4,%a1
    2b1a:	2083           	movel %d3,%a0@
    2b1c:	2049           	moveal %a1,%a0
    2b1e:	5889           	addql #4,%a1
    2b20:	2083           	movel %d3,%a0@
    2b22:	5384           	subql #1,%d4
    2b24:	66cc           	bnes 0x2af2
    2b26:	781f           	moveq #31,%d4
    2b28:	c885           	andl %d5,%d4
    2b2a:	e48c           	lsrl #2,%d4
    2b2c:	2c04           	movel %d4,%d6
    2b2e:	670a           	beqs 0x2b3a
    2b30:	2049           	moveal %a1,%a0
    2b32:	5889           	addql #4,%a1
    2b34:	2083           	movel %d3,%a0@
    2b36:	5384           	subql #1,%d4
    2b38:	66f6           	bnes 0x2b30
    2b3a:	7003           	moveq #3,%d0
    2b3c:	ca80           	andl %d0,%d5
    2b3e:	4a85           	tstl %d5
    2b40:	670a           	beqs 0x2b4c
    2b42:	2049           	moveal %a1,%a0
    2b44:	5289           	addql #1,%a1
    2b46:	1083           	moveb %d3,%a0@
    2b48:	5385           	subql #1,%d5
    2b4a:	66f6           	bnes 0x2b42
    2b4c:	4cdf 0078      	moveml %sp@+,%d3-%d6
    2b50:	4e75           	rts
    2b52:	0000 1000      	orib #0,%d0
    2b56:	0001 0000      	orib #0,%d1
	...
    2b62:	0000 218a      	orib #-118,%d0
    2b66:	0000 1c60      	orib #96,%d0
    2b6a:	0000 1ce2      	orib #-30,%d0
    2b6e:	0000 1f86      	orib #-122,%d0
    2b72:	0000 1fd0      	orib #-48,%d0
    2b76:	0000 2086      	orib #-122,%d0
    2b7a:	0000 20b4      	orib #-76,%d0
    2b7e:	0000 20dc      	orib #-36,%d0
    2b82:	0000 1c96      	orib #-106,%d0
    2b86:	0000 2256      	orib #86,%d0
    2b8a:	0000 229c      	orib #-100,%d0
    2b8e:	0000 2384      	orib #-124,%d0
    2b92:	0000 23ae      	orib #-82,%d0
    2b96:	0000 23e4      	orib #-28,%d0
    2b9a:	0000 2022      	orib #34,%d0
	...
    2ba6:	0000 1c0e      	orib #14,%d0
    2baa:	0000 1c60      	orib #96,%d0
    2bae:	0000 1ce2      	orib #-30,%d0
    2bb2:	0000 1f86      	orib #-122,%d0
    2bb6:	0000 1fd0      	orib #-48,%d0
    2bba:	0000 2086      	orib #-122,%d0
    2bbe:	0000 20b4      	orib #-76,%d0
    2bc2:	0000 20dc      	orib #-36,%d0
    2bc6:	0000 1c96      	orib #-106,%d0
	...
    2bde:	0000 2022      	orib #34,%d0
    2be2:	0000 0000      	orib #0,%d0
    2be6:	0000 1200      	orib #0,%d0
    2bea:	0000 0000      	orib #0,%d0
    2bee:	2353 6561      	movel %a3@,%a1@(25953)
    2bf2:	7263           	moveq #99,%d1
    2bf4:	6869           	bvcs 0x2c5f
    2bf6:	6e67           	bgts 0x2c5f
    2bf8:	2066           	moveal %fp@-,%a0
    2bfa:	6f72           	bles 0x2c6e
    2bfc:	2073 616d 706c 	moveal %a3@(706c)@(0),%a0
    2c02:	6572           	bcss 0x2c76
    2c04:	732c           	.short 0x732c
    2c06:	2070 6c65      	moveal %a0@(65,%d6:l:4),%a0
    2c0a:	6173           	bsrs 0x2c7f
    2c0c:	6520           	bcss 0x2c2e
    2c0e:	7761           	.short 0x7761
    2c10:	6974           	bvss 0x2c86
    2c12:	2253           	moveal %a3@,%a1
    2c14:	6561           	bcss 0x2c77
    2c16:	7263           	moveq #99,%d1
    2c18:	6869           	bvcs 0x2c83
    2c1a:	6e67           	bgts 0x2c83
    2c1c:	2066           	moveal %fp@-,%a0
    2c1e:	6f72           	bles 0x2c92
    2c20:	2064           	moveal %a4@-,%a0
    2c22:	6576           	bcss 0x2c9a
    2c24:	6963           	bvss 0x2c89
    2c26:	6573           	bcss 0x2c9b
    2c28:	2c20           	movel %a0@-,%d6
    2c2a:	706c           	moveq #108,%d0
    2c2c:	6561           	bcss 0x2c8f
    2c2e:	7365           	.short 0x7365
    2c30:	2077 6169 7427 	moveal %sp@(7427)@(0),%a0
    2c36:	202d 2d20      	movel %a5@(11552),%d0
    2c3a:	5365           	subqw #1,%a5@-
    2c3c:	6c65           	bges 0x2ca3
    2c3e:	6374           	blss 0x2cb4
    2c40:	206f 6e65      	moveal %sp@(28261),%a0
    2c44:	206f 6620      	moveal %sp@(26144),%a0
    2c48:	6162           	bsrs 0x2cac
    2c4a:	6f76           	bles 0x2cc2
    2c4c:	6520           	bcss 0x2c6e
    2c4e:	616e           	bsrs 0x2cbe
    2c50:	6420           	bccs 0x2c72
    2c52:	636c           	blss 0x2cc0
    2c54:	6963           	bvss 0x2cb9
    2c56:	6b20           	bmis 0x2c78
    2c58:	4f4b           	.short 0x4f4b
    2c5a:	202d 2d17      	movel %a5@(11543),%d0
    2c5e:	202d 2d20      	movel %a5@(11552),%d0
    2c62:	4e6f           	movel %usp,%sp
    2c64:	2064           	moveal %a4@-,%a0
    2c66:	6576           	bcss 0x2cde
    2c68:	6963           	bvss 0x2ccd
    2c6a:	6573           	bcss 0x2cdf
    2c6c:	2046           	moveal %d6,%a0
    2c6e:	6f75           	bles 0x2ce5
    2c70:	6e64           	bgts 0x2cd6
    2c72:	202d 2d18      	movel %a5@(11544),%d0
    2c76:	202d 2d20      	movel %a5@(11552),%d0
    2c7a:	4e6f           	movel %usp,%sp
    2c7c:	2053           	moveal %a3@,%a0
    2c7e:	616d           	bsrs 0x2ced
    2c80:	706c           	moveq #108,%d0
    2c82:	6572           	bcss 0x2cf6
    2c84:	7320           	.short 0x7320
    2c86:	466f 756e      	notw %sp@(30062)
    2c8a:	6420           	bccs 0x2cac
    2c8c:	2d2d 0000      	movel %a5@(0),%fp@-
	...
    2c98:	06ec 0000 02b8 	callm #0,%a4@(696)
    2c9e:	0000 0746      	orib #70,%d0
    2ca2:	0000 0854      	orib #84,%d0
    2ca6:	0000 05fa      	orib #-6,%d0
    2caa:	0000 0548      	orib #72,%d0
    2cae:	0000 05a2      	orib #-94,%d0
    2cb2:	0000 07f0      	orib #-16,%d0
    2cb6:	0000 080e      	orib #14,%d0
    2cba:	0000 082c      	orib #44,%d0
    2cbe:	0000 0434      	orib #52,%d0
    2cc2:	0000 04c0      	orib #-64,%d0
    2cc6:	0d00           	btst %d6,%d0
    2cc8:	0000 0000      	orib #0,%d0
    2ccc:	0900           	btst %d4,%d0
    2cce:	0000 0000      	orib #0,%d0
    2cd2:	4144           	.short 0x4144
    2cd4:	4154           	.short 0x4154
	...
    2ce6:	0000 5041      	orib #65,%d0
    2cea:	5343           	subqw #1,%d3
	...
    2cf4:	0000 0274      	orib #116,%d0
    2cf8:	0000 02b8      	orib #-72,%d0
    2cfc:	0000 02fc      	orib #-4,%d0
    2d00:	0000 0000      	orib #0,%d0
    2d04:	0000 05fa      	orib #-6,%d0
    2d08:	0000 0548      	orib #72,%d0
    2d0c:	0000 05a2      	orib #-94,%d0
	...
    2d1c:	0000 0434      	orib #52,%d0
    2d20:	0000 04c0      	orib #-64,%d0
    2d24:	4255           	clrw %a5@
    2d26:	5359           	subqw #1,%a1@+
	...
    2dc0:	6e40           	bgts 0x2e02
    2dc2:	be8c           	cmpl %a4,%d7
    2dc4:	8840           	orw %d0,%d4
    2dc6:	48af 4044 40a0 	movemw %d2/%d6/%fp,%sp@(16544)
    2dcc:	40ef 8640      	movew %sr,%sp@(-31168)
    2dd0:	6788           	beqs 0x2d5a
    2dd2:	b890           	cmpl %a0@,%d4
    2dd4:	4082           	negxl %d2
    2dd6:	4182           	chkw %d2,%d0
    2dd8:	e6f4 e47e      	rorw %a4@(7e,%fp:w:4)
    2ddc:	f0ed           	.short 0xf0ed
    2dde:	a940           	.short 0xa940
    2de0:	be7f           	.short 0xbe7f
    2de2:	5041           	addqw #8,%d1
    2de4:	25da           	.short 0x25da
    2de6:	dd7f           	.short 0xdd7f
    2de8:	bdc8           	cmpal %a0,%fp
    2dea:	d241           	addw %d1,%d1
    2dec:	9390           	subl %d1,%a0@
    2dee:	404a           	.short 0x404a
    2df0:	413f           	.short 0x413f
    2df2:	7f7a           	.short 0x7f7a
    2df4:	a540           	.short 0xa540
    2df6:	9cb6 406b      	subl %fp@(6b,%d4:w),%d6
    2dfa:	4134 f5ed dbf9 	chkl @(ffffffffffffdbf9)@(0),%d0
    2e00:	7f26           	.short 0x7f26
    2e02:	8593           	orl %d2,%a3@
    2e04:	40ce           	.short 0x40ce
    2e06:	40ac 8e8e      	negxl %a4@(-29042)
    2e0a:	b1f8 aab7      	cmpal 0xffffaab7,%a0
    2e0e:	407c           	.short 0x407c
    2e10:	40e7           	movew %sr,%sp@-
    2e12:	b041           	cmpw %d1,%d0
    2e14:	5a40           	addqw #5,%d0
    2e16:	5a40           	addqw #5,%d0
    2e18:	b240           	cmpw %d0,%d1
    2e1a:	d240           	addw %d0,%d1
    2e1c:	9640           	subw %d0,%d3
    2e1e:	4088           	.short 0x4088
    2e20:	419f           	chkw %sp@+,%d0
    2e22:	4068 94fe      	negxw %a0@(-27394)
    2e26:	8482           	orl %d2,%d2
    2e28:	82e8 8282      	divuw %a0@(-32126),%d1
    2e2c:	8282           	orl %d2,%d1
    2e2e:	8282           	orl %d2,%d1
    2e30:	828c           	.short 0x828c
    2e32:	8682           	orl %d2,%d3
    2e34:	8282           	orl %d2,%d1
    2e36:	8282           	orl %d2,%d1
    2e38:	8282           	orl %d2,%d1
    2e3a:	828c           	.short 0x828c
    2e3c:	405c           	negxw %a4@+
    2e3e:	8482           	orl %d2,%d2
    2e40:	8882           	orl %d2,%d4
    2e42:	82f0 8682      	divuw %a0@(ffffffffffffff82,%a0:w:8),%d1
    2e46:	8288           	.short 0x8288
    2e48:	8299           	orl %a1@+,%d1
    2e4a:	8282           	orl %d2,%d1
    2e4c:	8482           	orl %d2,%d2
    2e4e:	8288           	.short 0x8288
    2e50:	8200           	orb %d0,%d1
    2e52:	0001 0000      	orib #0,%d1
    2e56:	002e 5100 002d 	orib #0,%fp@(45)
    2e5c:	5100           	subqb #8,%d0
    2e5e:	0000 c408      	orib #8,%d0
    2e62:	db2a 9c26      	addb %d5,%a2@(-25562)
    2e66:	ee00           	asrb #7,%d0
    2e68:	0000 1c00      	orib #0,%d0
    2e6c:	b600           	cmpb %d0,%d3
    2e6e:	0676 6572 7300 	addiw #25970,%fp@(0,%d7:w:2)
    2e74:	0000 3a53      	orib #83,%d0
    2e78:	5452           	addqw #2,%a2@
    2e7a:	2300           	movel %d0,%a1@-
    2e7c:	0000 4641      	orib #65,%d0
    2e80:	4c52 5400      	divul %a2@,%d0,%d5
    2e84:	0000 5263      	orib #99,%d0
    2e88:	6963           	bvss 0x2eed
    2e8a:	6e00 0000      	bgtw 0x2e8c
    2e8e:	5e44           	addqw #7,%d4
    2e90:	4954           	.short 0x4954
    2e92:	4c00           	.short 0x4c00
    2e94:	0100           	btst %d0,%d0
    2e96:	6a44           	bpls 0x2edc
    2e98:	4c4f           	.short 0x4c4f
    2e9a:	4700           	chkl %d0,%d3
    2e9c:	0000 8250      	orib #80,%d0
    2ea0:	4c55           	.short 0x4c55
    2ea2:	4700           	chkl %d0,%d3
    2ea4:	0000 8e00      	orib #0,%d0
    2ea8:	01ff           	.short 0x01ff
    2eaa:	ff00           	.short 0xff00
	...
    2eb4:	8000           	orb %d0,%d0
    2eb6:	0000 0000      	orib #0,%d0
    2eba:	3d00           	movew %d0,%fp@-
    2ebc:	0000 0001      	orib #1,%d0
    2ec0:	f400           	.short 0xf400
    2ec2:	0800 0000      	btst #0,%d0
    2ec6:	5200           	addqb #1,%d0
    2ec8:	0000 0000      	orib #0,%d0
    2ecc:	02ff           	.short 0x02ff
    2ece:	ff20           	.short 0xff20
    2ed0:	0000 6400      	orib #0,%d0
    2ed4:	0000 0001      	orib #1,%d0
    2ed8:	f4ff           	.short 0xf4ff
    2eda:	ff00           	.short 0xff00
    2edc:	0003 fa00      	orib #0,%d3
    2ee0:	0000 0003      	orib #3,%d0
    2ee4:	e8ff           	.short 0xe8ff
    2ee6:	ff00           	.short 0xff00
    2ee8:	0004 4600      	orib #0,%d4
    2eec:	0000 0003      	orib #3,%d0
    2ef0:	e8ff           	.short 0xe8ff
    2ef2:	ff00           	.short 0xff00
    2ef4:	0004 7e00      	orib #0,%d4
    2ef8:	0000 0000      	orib #0,%d0
    2efc:	00ff           	.short 0x00ff
    2efe:	ff1c           	.short 0xff1c
    2f00:	0004 9a00      	orib #0,%d4
    2f04:	0000 0007      	orib #7,%d0
    2f08:	4765           	.short 0x4765
    2f0a:	6e65           	bgts 0x2f71
    2f0c:	7261           	moveq #97,%d1
    2f0e:	6c05           	bges 0x2f15
    2f10:	4572           	.short 0x4572
    2f12:	726f           	moveq #111,%d1
    2f14:	Address 0x2f14 is out of bounds.

