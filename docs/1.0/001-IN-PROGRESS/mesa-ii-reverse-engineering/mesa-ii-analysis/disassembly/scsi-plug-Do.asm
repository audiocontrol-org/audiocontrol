; Do__7CDialogFv
; File offset: 0x2280 - 0x22d0 (80 bytes)
; Source: scsi-plug-rsrc.bin

  002280: 4e 56 ff fe        LINK    A6,#$FFFE (-2)
  002284: 48 e7 18 30        MOVEM.L #1830,-(SP)
  002288: 26 6e 00 08        MOVEA.L 8(A6),A3
  00228c: 76 00              .word   $7600
  00228e: 45 f9              .word   $45F9
  002290: 00 00              .word   $0000
  002292: 1d 44              .word   $1D44
  002294: 60 1e              .word   $601E
  002296: 2f 0a              .word   $2F0A
  002298: 48 6e ff fe        PEA     -2(A6)
  00229c: a9 91              .word   $A991
  00229e: 3f 2e              .word   $3F2E
  0022a0: ff fe              .word   $FFFE
  0022a2: 2f 0b              .word   $2F0B
  0022a4: 20 57              .word   $2057
  0022a6: 22 68              .word   $2268
  0022a8: 00 0e              .word   $000E
  0022aa: 22 69              .word   $2269
  0022ac: 00 2c              .word   $002C
  0022ae: 4e 91              JSR     (A1)  ; vtable call
  0022b0: 16 00              .word   $1600
  0022b2: 5c 4f              .word   $5C4F
  0022b4: 4a 03              .word   $4A03
  0022b6: 67 de              .word   $67DE
  0022b8: 0c 6e              .word   $0C6E
  0022ba: 00 01              .word   $0001
  0022bc: ff fe              .word   $FFFE
  0022be: 66 04              .word   $6604
  0022c0: 78 01              .word   $7801
  0022c2: 60 02              .word   $6002
  0022c4: 78 00              .word   $7800
  0022c6: 10 04              .word   $1004
  0022c8: 4c df 0c 18        MOVEM.L (SP)+,#0C18
  0022cc: 4e 5e              UNLK    A6
  0022ce: 4e 75              RTS
