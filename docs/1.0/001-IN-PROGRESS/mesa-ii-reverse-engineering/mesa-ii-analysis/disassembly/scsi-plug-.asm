; 
; File offset: 0x2982 - 0x2a58 (214 bytes)
; Source: scsi-plug-rsrc.bin

  002982: 4e 56 ff ea        LINK    A6,#$FFEA (-22)
  002986: 48 e7 1c 20        MOVEM.L #1C20,-(SP)
  00298a: 24 6e 00 08        MOVEA.L 8(A6),A2
  00298e: 4a 2a 06 1a        TST.B   1562(A2)
  002992: 67 00 00 ba        BEQ     $002A4E
  002996: 2f 2a              .word   $2F2A
  002998: 00 04              .word   $0004
  00299a: 3f 3c 00 03        MOVE.W  #$0003,-(SP) (=3)
  00299e: 48 6e ff ee        PEA     -18(A6)
  0029a2: 48 6e ff ea        PEA     -22(A6)
  0029a6: 48 6e ff f0        PEA     -16(A6)
  0029aa: a9 8d              .word   $A98D
  0029ac: 55 4f              .word   $554F
  0029ae: 2f 2e              .word   $2F2E
  0029b0: 00 0c              .word   $000C
  0029b2: 48 6e ff f0        PEA     -16(A6)
  0029b6: a8 ad              .word   $A8AD
  0029b8: 10 1f              .word   $101F
  0029ba: 67 00 00 92        BEQ     $002A4E
  0029be: 76 00              .word   $7600
  0029c0: 3a 2a              .word   $3A2A
  0029c2: 06 16              .word   $0616
  0029c4: 53 45              .word   $5345
  0029c6: 2d 6e              .word   $2D6E
  0029c8: ff f0              .word   $FFF0
  0029ca: ff f8              .word   $FFF8
  0029cc: 2d 6e              .word   $2D6E
  0029ce: ff f4              .word   $FFF4
  0029d0: ff fc              .word   $FFFC
  0029d2: 52 6e              .word   $526E
  0029d4: ff f8              .word   $FFF8
  0029d6: 52 6e              .word   $526E
  0029d8: ff fa              .word   $FFFA
  0029da: 53 6e              .word   $536E
  0029dc: ff fe              .word   $FFFE
  0029de: 70 0c              .word   $700C
  0029e0: d0 6e              .word   $D06E
  0029e2: ff f8              .word   $FFF8
  0029e4: 3d 40              .word   $3D40
  0029e6: ff fc              .word   $FFFC
  0029e8: 78 00              .word   $7800
  0029ea: 60 48              .word   $6048
  0029ec: 20 04              .word   $2004
  0029ee: e1 88              .word   $E188
  0029f0: 4a 32              .word   $4A32
  0029f2: 08 16              .word   $0816
  0029f4: 67 3c              .word   $673C
  0029f6: 52 43              .word   $5243
  0029f8: 55 4f              .word   $554F
  0029fa: 2f 2e              .word   $2F2E
  0029fc: 00 0c              .word   $000C
  0029fe: 48 6e ff f8        PEA     -8(A6)
  002a02: a8 ad              .word   $A8AD
  002a04: 10 1f              .word   $101F
  002a06: 67 1e              .word   $671E
  002a08: b6 6a              .word   $B66A
  002a0a: 06 18              .word   $0618
  002a0c: 6c 18              .word   $6C18
  002a0e: 35 43              .word   $3543
  002a10: 06 16              .word   $0616
  002a12: 2f 0a              .word   $2F0A
  002a14: 20 57              .word   $2057
  002a16: 22 68              .word   $2268
  002a18: 00 0e              .word   $000E
  002a1a: 22 69              .word   $2269
  002a1c: 00 30              .word   $0030
  002a1e: 4e 91              JSR     (A1)  ; vtable call
  002a20: 70 01              .word   $7001
  002a22: 58 4f              .word   $584F
  002a24: 60 2a              .word   $602A
  002a26: 48 6e ff f8        PEA     -8(A6)
  002a2a: 2f 3c 00 0c 00 00  MOVE.L  #$000C0000,-(SP)
  002a30: a8 a8              .word   $A8A8
  002a32: 52 84              .word   $5284
  002a34: 70 06              .word   $7006
  002a36: b8 80              .word   $B880
  002a38: 6d b2              .word   $6DB2
  002a3a: 42 6a              .word   $426A
  002a3c: 06 16              .word   $0616
  002a3e: 2f 0a              .word   $2F0A
  002a40: 20 57              .word   $2057
  002a42: 22 68              .word   $2268
  002a44: 00 0e              .word   $000E
  002a46: 22 69              .word   $2269
  002a48: 00 30              .word   $0030
  002a4a: 4e 91              JSR     (A1)  ; vtable call
  002a4c: 58 4f              .word   $584F
  002a4e: 70 00              .word   $7000
  002a50: 4c df 04 38        MOVEM.L (SP)+,#0438
  002a54: 4e 5e              UNLK    A6
  002a56: 4e 75              RTS
