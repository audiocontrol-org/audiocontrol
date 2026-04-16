; ChooseSCSI__9CSCSIPlugFUl
; File offset: 0x1700 - 0x1b00 (1024 bytes)
; Source: scsi-plug-rsrc.bin

  001700: 4e 56 f8 84        LINK    A6,#$F884 (-1916)
  001704: 48 e7 1f 30        MOVEM.L #1F30,-(SP)
  001708: 24 6e 00 08        MOVEA.L 8(A6),A2
  00170c: 48 6e f8 a0        PEA     -1888(A6)
  001710: a9 76              .word   $A976
  001712: 70 00              .word   $7000
  001714: 10 2e              .word   $102E
  001716: f8 a7              .word   $F8A7
  001718: e4 40              .word   $E440
  00171a: 02 40              .word   $0240
  00171c: 00 01              .word   $0001
  00171e: 3d 40              .word   $3D40
  001720: f8 8c              .word   $F88C
  001722: 3d 6e              .word   $3D6E
  001724: f8 8c              .word   $F88C
  001726: f8 8a              .word   $F88A
  001728: 1d 6e              .word   $1D6E
  00172a: f8 8b              .word   $F88B
  00172c: f8 89              .word   $F889
  00172e: 10 2e              .word   $102E
  001730: f8 89              .word   $F889
  001732: 56 c0              .word   $56C0
  001734: 44 00              .word   $4400
  001736: 1e 00              .word   $1E00
  001738: 41 ec              .word   $41EC
  00173a: 00 9c              .word   $009C
  00173c: 2d 48              .word   $2D48
  00173e: f8 9c              .word   $F89C
  001740: 41 ec              .word   $41EC
  001742: 00 9c              .word   $009C
  001744: 41 e8              .word   $41E8
  001746: 00 24              .word   $0024
  001748: 2d 48              .word   $2D48
  00174a: f8 98              .word   $F898
  00174c: 4a 07              .word   $4A07
  00174e: 67 08              .word   $6708
  001750: 2d 6e              .word   $2D6E
  001752: f8 98              .word   $F898
  001754: f8 b4              .word   $F8B4
  001756: 60 06              .word   $6006
  001758: 2d 6e              .word   $2D6E
  00175a: f8 9c              .word   $F89C
  00175c: f8 b4              .word   $F8B4
  00175e: 26 6e f8 b4        MOVEA.L -1868(A6),A3
  001762: 30 6a              .word   $306A
  001764: 0d 6e              .word   $0D6E
  001766: 2f 08              .word   $2F08
  001768: 3f 3c 03 e8        MOVE.W  #$03E8,-(SP) (=1000)
  00176c: 48 6e f8 c0        PEA     -1856(A6)
  001770: 4e b9 00 00 21 0c  JSR     $0000210C
  001776: 48 6e f8 c0        PEA     -1856(A6)
  00177a: 20 57              .word   $2057
  00177c: 22 68              .word   $2268
  00177e: 00 0e              .word   $000E
  001780: 22 69              .word   $2269
  001782: 00 0c              .word   $000C
  001784: 4e 91              JSR     (A1)  ; vtable call
  001786: 7c 00              .word   $7C00
  001788: 2f 0b              .word   $2F0B
  00178a: 42 67              CLR.W   -(SP)
  00178c: 48 6e f8 c0        PEA     -1856(A6)
  001790: 4e b9 00 00 21 dc  JSR     $000021DC
  001796: 48 6e f8 c0        PEA     -1856(A6)
  00179a: 4e b9 00 00 22 9c  JSR     $0000229C
  0017a0: 7a 00              .word   $7A00
  0017a2: 4f ef              .word   $4FEF
  0017a4: 00 1c              .word   $001C
  0017a6: 60 00 01 d8        BRA     $001980
  0017aa: 78 00              .word   $7800
  0017ac: 60 00 01 c8        BRA     $001976
  0017b0: 48 78 00 24        PEA     $0024.W (=36)
  0017b4: 48 6e fe dc        PEA     -292(A6)
  0017b8: 1f 04              .word   $1F04
  0017ba: 1f 05              .word   $1F05
  0017bc: 48 6a 09 3a        PEA     2362(A2)
  0017c0: 4e b9 00 00 17 ac  JSR     $000017AC
  0017c6: 48 c0              .word   $48C0
  0017c8: 25 40              .word   $2540
  0017ca: 0d 66              .word   $0D66
  0017cc: 4a aa              .word   $4AAA
  0017ce: 0d 66              .word   $0D66
  0017d0: 4f ef              .word   $4FEF
  0017d2: 00 10              .word   $0010
  0017d4: 66 00 01 90        BNE     $001966
  0017d8: 4a 07              .word   $4A07
  0017da: 66 36              .word   $6636
  0017dc: 70 00              .word   $7000
  0017de: 10 2e              .word   $102E
  0017e0: fe e4              .word   $FEE4
  0017e2: 0c 40              .word   $0C40
  0017e4: 00 41              .word   $0041
  0017e6: 66 00 01 7e        BNE     $001966
  0017ea: 70 00              .word   $7000
  0017ec: 10 2e              .word   $102E
  0017ee: fe e5              .word   $FEE5
  0017f0: 0c 40              .word   $0C40
  0017f2: 00 4b              .word   $004B
  0017f4: 66 00 01 70        BNE     $001966
  0017f8: 70 00              .word   $7000
  0017fa: 10 2e              .word   $102E
  0017fc: fe ec              .word   $FEEC
  0017fe: 0c 40              .word   $0C40
  001800: 00 53              .word   $0053
  001802: 67 0e              .word   $670E
  001804: 70 00              .word   $7000
  001806: 10 2e              .word   $102E
  001808: fe ec              .word   $FEEC
  00180a: 0c 40              .word   $0C40
  00180c: 00 43              .word   $0043
  00180e: 66 00 01 56        BNE     $001966
  001812: 42 2e              .word   $422E
  001814: ff 00              .word   $FF00
  001816: 52 2e              .word   $522E
  001818: ff 00              .word   $FF00
  00181a: 70 00              .word   $7000
  00181c: 10 2e              .word   $102E
  00181e: ff 00              .word   $FF00
  001820: 41 ee              .word   $41EE
  001822: ff 00              .word   $FF00
  001824: 11 bc              .word   $11BC
  001826: 00 42              .word   $0042
  001828: 00 00              .word   $0000
  00182a: 52 2e              .word   $522E
  00182c: ff 00              .word   $FF00
  00182e: 70 00              .word   $7000
  001830: 10 2e              .word   $102E
  001832: ff 00              .word   $FF00
  001834: 41 ee              .word   $41EE
  001836: ff 00              .word   $FF00
  001838: 11 bc              .word   $11BC
  00183a: 00 75              .word   $0075
  00183c: 00 00              .word   $0000
  00183e: 52 2e              .word   $522E
  001840: ff 00              .word   $FF00
  001842: 70 00              .word   $7000
  001844: 10 2e              .word   $102E
  001846: ff 00              .word   $FF00
  001848: 41 ee              .word   $41EE
  00184a: ff 00              .word   $FF00
  00184c: 11 bc              .word   $11BC
  00184e: 00 73              .word   $0073
  001850: 00 00              .word   $0000
  001852: 52 2e              .word   $522E
  001854: ff 00              .word   $FF00
  001856: 70 00              .word   $7000
  001858: 10 2e              .word   $102E
  00185a: ff 00              .word   $FF00
  00185c: 41 ee              .word   $41EE
  00185e: ff 00              .word   $FF00
  001860: 11 bc              .word   $11BC
  001862: 00 20              .word   $0020
  001864: 00 00              .word   $0000
  001866: 10 05              .word   $1005
  001868: 48 80              .word   $4880
  00186a: 06 40              .word   $0640
  00186c: 00 30              .word   $0030
  00186e: 52 2e              .word   $522E
  001870: ff 00              .word   $FF00
  001872: 72 00              .word   $7200
  001874: 12 2e              .word   $122E
  001876: ff 00              .word   $FF00
  001878: 41 ee              .word   $41EE
  00187a: ff 00              .word   $FF00
  00187c: 11 80              .word   $1180
  00187e: 10 00              .word   $1000
  001880: 52 2e              .word   $522E
  001882: ff 00              .word   $FF00
  001884: 70 00              .word   $7000
  001886: 10 2e              .word   $102E
  001888: ff 00              .word   $FF00
  00188a: 41 ee              .word   $41EE
  00188c: ff 00              .word   $FF00
  00188e: 11 bc              .word   $11BC
  001890: 00 2c              .word   $002C
  001892: 00 00              .word   $0000
  001894: 52 2e              .word   $522E
  001896: ff 00              .word   $FF00
  001898: 70 00              .word   $7000
  00189a: 10 2e              .word   $102E
  00189c: ff 00              .word   $FF00
  00189e: 41 ee              .word   $41EE
  0018a0: ff 00              .word   $FF00
  0018a2: 11 bc              .word   $11BC
  0018a4: 00 49              .word   $0049
  0018a6: 00 00              .word   $0000
  0018a8: 52 2e              .word   $522E
  0018aa: ff 00              .word   $FF00
  0018ac: 70 00              .word   $7000
  0018ae: 10 2e              .word   $102E
  0018b0: ff 00              .word   $FF00
  0018b2: 41 ee              .word   $41EE
  0018b4: ff 00              .word   $FF00
  0018b6: 11 bc              .word   $11BC
  0018b8: 00 44              .word   $0044
  0018ba: 00 00              .word   $0000
  0018bc: 52 2e              .word   $522E
  0018be: ff 00              .word   $FF00
  0018c0: 70 00              .word   $7000
  0018c2: 10 2e              .word   $102E
  0018c4: ff 00              .word   $FF00
  0018c6: 41 ee              .word   $41EE
  0018c8: ff 00              .word   $FF00
  0018ca: 11 bc              .word   $11BC
  0018cc: 00 3d              .word   $003D
  0018ce: 00 00              .word   $0000
  0018d0: 10 04              .word   $1004
  0018d2: 48 80              .word   $4880
  0018d4: 06 40              .word   $0640
  0018d6: 00 30              .word   $0030
  0018d8: 52 2e              .word   $522E
  0018da: ff 00              .word   $FF00
  0018dc: 72 00              .word   $7200
  0018de: 12 2e              .word   $122E
  0018e0: ff 00              .word   $FF00
  0018e2: 41 ee              .word   $41EE
  0018e4: ff 00              .word   $FF00
  0018e6: 11 80              .word   $1180
  0018e8: 10 00              .word   $1000
  0018ea: 52 2e              .word   $522E
  0018ec: ff 00              .word   $FF00
  0018ee: 70 00              .word   $7000
  0018f0: 10 2e              .word   $102E
  0018f2: ff 00              .word   $FF00
  0018f4: 41 ee              .word   $41EE
  0018f6: ff 00              .word   $FF00
  0018f8: 11 bc              .word   $11BC
  0018fa: 00 3a              .word   $003A
  0018fc: 00 00              .word   $0000
  0018fe: 52 2e              .word   $522E
  001900: ff 00              .word   $FF00
  001902: 70 00              .word   $7000
  001904: 10 2e              .word   $102E
  001906: ff 00              .word   $FF00
  001908: 41 ee              .word   $41EE
  00190a: ff 00              .word   $FF00
  00190c: 11 bc              .word   $11BC
  00190e: 00 20              .word   $0020
  001910: 00 00              .word   $0000
  001912: 76 08              .word   $7608
  001914: 60 1a              .word   $601A
  001916: 41 ee              .word   $41EE
  001918: fe dc              .word   $FEDC
  00191a: 52 2e              .word   $522E
  00191c: ff 00              .word   $FF00
  00191e: 70 00              .word   $7000
  001920: 10 2e              .word   $102E
  001922: ff 00              .word   $FF00
  001924: 43 ee              .word   $43EE
  001926: ff 00              .word   $FF00
  001928: 13 b0              .word   $13B0
  00192a: 38 00              .word   $3800
  00192c: 00 00              .word   $0000
  00192e: 52 83              .word   $5283
  001930: 70 24              .word   $7024
  001932: b6 80              .word   $B680
  001934: 6d e0              .word   $6DE0
  001936: 48 6e ff 00        PEA     -256(A6)
  00193a: 30 06              .word   $3006
  00193c: 52 46              .word   $5246
  00193e: 3f 00              .word   $3F00
  001940: 48 6e f8 c0        PEA     -1856(A6)
  001944: 4e b9 00 00 21 dc  JSR     $000021DC
  00194a: 2f 0b              .word   $2F0B
  00194c: 3f 06              .word   $3F06
  00194e: 48 6e f8 c0        PEA     -1856(A6)
  001952: 4e b9 00 00 21 dc  JSR     $000021DC
  001958: 48 6e f8 c0        PEA     -1856(A6)
  00195c: 4e b9 00 00 22 9c  JSR     $0000229C
  001962: 4f ef              .word   $4FEF
  001964: 00 18              .word   $0018
  001966: 0c aa              .word   $0CAA
  001968: ff ff              .word   $FFFF
  00196a: e1 0a              .word   $E10A
  00196c: 0d 66              .word   $0D66
  00196e: 66 04              .word   $6604
  001970: 42 aa              .word   $42AA
  001972: 0d 66              .word   $0D66
  001974: 52 04              .word   $5204
  001976: 0c 04              .word   $0C04
  001978: 00 07              .word   $0007
  00197a: 6d 00              .word   $6D00
  00197c: fe 34              .word   $FE34
  00197e: 52 05              .word   $5205
  001980: 10 05              .word   $1005
  001982: 48 80              .word   $4880
  001984: 48 c0              .word   $48C0
  001986: b0 aa              .word   $B0AA
  001988: 09 42              .word   $0942
  00198a: 6d 00              .word   $6D00
  00198c: fe 1e              .word   $FE1E
  00198e: 4a 46              .word   $4A46
  001990: 67 22              .word   $6722
  001992: 48 6c 00 e3        PEA     227(A4)
  001996: 3f 06              .word   $3F06
  001998: 48 6e f8 c0        PEA     -1856(A6)
  00199c: 4e b9 00 00 21 dc  JSR     $000021DC
  0019a2: 1d 7c              .word   $1D7C
  0019a4: 00 01              .word   $0001
  0019a6: fe da              .word   $FEDA
  0019a8: 3d 7c              .word   $3D7C
  0019aa: 00 01              .word   $0001
  0019ac: fe d6              .word   $FED6
  0019ae: 4f ef              .word   $4FEF
  0019b0: 00 0a              .word   $000A
  0019b2: 60 32              .word   $6032
  0019b4: 4a 07              .word   $4A07
  0019b6: 67 16              .word   $6716
  0019b8: 48 6c 01 0b        PEA     267(A4)
  0019bc: 3f 06              .word   $3F06
  0019be: 48 6e f8 c0        PEA     -1856(A6)
  0019c2: 4e b9 00 00 21 dc  JSR     $000021DC
  0019c8: 4f ef              .word   $4FEF
  0019ca: 00 0a              .word   $000A
  0019cc: 60 14              .word   $6014
  0019ce: 48 6c 01 23        PEA     291(A4)
  0019d2: 3f 06              .word   $3F06
  0019d4: 48 6e f8 c0        PEA     -1856(A6)
  0019d8: 4e b9 00 00 21 dc  JSR     $000021DC
  0019de: 4f ef              .word   $4FEF
  0019e0: 00 0a              .word   $000A
  0019e2: 42 2e              .word   $422E
  0019e4: fe da              .word   $FEDA
  0019e6: 48 6e f8 c0        PEA     -1856(A6)
  0019ea: 20 57              .word   $2057
  0019ec: 22 68              .word   $2268
  0019ee: 00 0e              .word   $000E
  0019f0: 22 69              .word   $2269
  0019f2: 00 10              .word   $0010
  0019f4: 4e 91              JSR     (A1)  ; vtable call
  0019f6: 4a 00              .word   $4A00
  0019f8: 58 4f              .word   $584F
  0019fa: 67 00 00 c6        BEQ     $001AC2
  0019fe: 4a 6e              .word   $4A6E
  001a00: fe d6              .word   $FED6
  001a02: 67 1a              .word   $671A
  001a04: 30 2e              .word   $302E
  001a06: fe d6              .word   $FED6
  001a08: 53 40              .word   $5340
  001a0a: 48 c0              .word   $48C0
  001a0c: e1 88              .word   $E188
  001a0e: 41 ee              .word   $41EE
  001a10: f8 c0              .word   $F8C0
  001a12: d1 c0              .word   $D1C0
  001a14: 41 e8              .word   $41E8
  001a16: 00 16              .word   $0016
  001a18: 2d 48              .word   $2D48
  001a1a: f8 b0              .word   $F8B0
  001a1c: 60 04              .word   $6004
  001a1e: 42 ae              .word   $42AE
  001a20: f8 b0              .word   $F8B0
  001a22: 2d 6e              .word   $2D6E
  001a24: f8 b0              .word   $F8B0
  001a26: f8 84              .word   $F884
  001a28: 2d 6e              .word   $2D6E
  001a2a: f8 84              .word   $F884
  001a2c: f8 b8              .word   $F8B8
  001a2e: 4a ae              .word   $4AAE
  001a30: f8 b8              .word   $F8B8
  001a32: 67 72              .word   $6772
  001a34: 20 6e f8 b8        MOVEA.L -1864(A6),A0
  001a38: 70 00              .word   $7000
  001a3a: 10 28              .word   $1028
  001a3c: 00 05              .word   $0005
  001a3e: 06 40              .word   $0640
  001a40: ff d0              .word   $FFD0
  001a42: 3d 40              .word   $3D40
  001a44: f8 96              .word   $F896
  001a46: 20 6e f8 b8        MOVEA.L -1864(A6),A0
  001a4a: 70 00              .word   $7000
  001a4c: 10 28              .word   $1028
  001a4e: 00 0a              .word   $000A
  001a50: 06 40              .word   $0640
  001a52: ff d0              .word   $FFD0
  001a54: 3d 40              .word   $3D40
  001a56: f8 94              .word   $F894
  001a58: 30 2e              .word   $302E
  001a5a: f8 96              .word   $F896
  001a5c: e1 48              .word   $E148
  001a5e: d0 6e              .word   $D06E
  001a60: f8 94              .word   $F894
  001a62: 3d 40              .word   $3D40
  001a64: f8 bc              .word   $F8BC
  001a66: 42 6e              .word   $426E
  001a68: f8 be              .word   $F8BE
  001a6a: 60 28              .word   $6028
  001a6c: 70 2e              .word   $702E
  001a6e: c1 ee              .word   $C1EE
  001a70: f8 be              .word   $F8BE
  001a72: 20 32              .word   $2032
  001a74: 08 62              .word   $0862
  001a76: b0 ae              .word   $B0AE
  001a78: 00 0c              .word   $000C
  001a7a: 66 14              .word   $6614
  001a7c: 30 6e              .word   $306E
  001a7e: f8 bc              .word   $F8BC
  001a80: 32 6e              .word   $326E
  001a82: f8 be              .word   $F8BE
  001a84: 20 09              .word   $2009
  001a86: e5 88              .word   $E588
  001a88: 22 4a              .word   $224A
  001a8a: d3 c0              .word   $D3C0
  001a8c: 23 48              .word   $2348
  001a8e: 0d 70              .word   $0D70
  001a90: 52 6e              .word   $526E
  001a92: f8 be              .word   $F8BE
  001a94: 30 6e              .word   $306E
  001a96: f8 be              .word   $F8BE
  001a98: b1 ea              .word   $B1EA
  001a9a: 00 38              .word   $0038
  001a9c: 6d ce              .word   $6DCE
  001a9e: 35 6e              .word   $356E
  001aa0: f8 bc              .word   $F8BC
  001aa2: 0d 6e              .word   $0D6E
  001aa4: 60 38              .word   $6038
  001aa6: 3d 7c              .word   $3D7C
  001aa8: d8 ed              .word   $D8ED
  001aaa: f8 92              .word   $F892
  001aac: 3f 3c ff ff        MOVE.W  #$FFFF,-(SP) (=65535)
  001ab0: 48 6e f8 c0        PEA     -1856(A6)
  001ab4: 4e b9 00 00 21 8a  JSR     $0000218A
  001aba: 30 2e              .word   $302E
  001abc: f8 92              .word   $F892
  001abe: 5c 4f              .word   $5C4F
  001ac0: 60 36              .word   $6036
  001ac2: 3d 7c              .word   $3D7C
  001ac4: d8 ed              .word   $D8ED
  001ac6: f8 90              .word   $F890
  001ac8: 3f 3c ff ff        MOVE.W  #$FFFF,-(SP) (=65535)
  001acc: 48 6e f8 c0        PEA     -1856(A6)
  001ad0: 4e b9 00 00 21 8a  JSR     $0000218A
  001ad6: 30 2e              .word   $302E
  001ad8: f8 90              .word   $F890
  001ada: 5c 4f              .word   $5C4F
  001adc: 60 1a              .word   $601A
  001ade: 3d 6a              .word   $3D6A
  001ae0: 0d 68              .word   $0D68
  001ae2: f8 8e              .word   $F88E
  001ae4: 3f 3c ff ff        MOVE.W  #$FFFF,-(SP) (=65535)
  001ae8: 48 6e f8 c0        PEA     -1856(A6)
  001aec: 4e b9 00 00 21 8a  JSR     $0000218A
  001af2: 30 2e              .word   $302E
  001af4: f8 8e              .word   $F88E
  001af6: 5c 4f              .word   $5C4F
  001af8: 4c df 0c f8        MOVEM.L (SP)+,#0CF8
  001afc: 4e 5e              UNLK    A6
  001afe: 4e 75              RTS
