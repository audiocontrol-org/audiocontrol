; main
; File offset: 0x070c - 0x07a4 (152 bytes)
; Source: scsi-plug-rsrc.bin

  00070c: 4e 56 00 00        LINK    A6,#$0000 (0)
  000710: 48 e7 1c 30        MOVEM.L #1C30,-(SP)
  000714: 24 6e 00 08        MOVEA.L 8(A6),A2
  000718: 4e b9 00 00 01 04  JSR     $00000104
  00071e: 28 00              .word   $2800
  000720: 20 12              .word   $2012
  000722: 04 80              .word   $0480
  000724: 49 4e              .word   $494E
  000726: 49 54              .word   $4954
  000728: 67 02              .word   $6702
  00072a: 60 3c              .word   $603C
  00072c: 48 78 0e 48        PEA     $0E48.W (=3656)
  000730: 4e b9 00 00 1a 30  JSR     $00001A30
  000736: 26 48              .word   $2648
  000738: 20 08              .word   $2008
  00073a: 58 4f              .word   $584F
  00073c: 67 0a              .word   $670A
  00073e: 2f 0b              .word   $2F0B
  000740: 4e b9 00 00 06 28  JSR     $00000628
  000746: 58 4f              .word   $584F
  000748: 29 4b              .word   $294B
  00074a: 02 62              .word   $0262
  00074c: 4a ac              .word   $4AAC
  00074e: 02 62              .word   $0262
  000750: 67 46              .word   $6746
  000752: 2f 2a              .word   $2F2A
  000754: 00 06              .word   $0006
  000756: 2f 2c              .word   $2F2C
  000758: 02 62              .word   $0262
  00075a: 20 57              .word   $2057
  00075c: 22 50              .word   $2250
  00075e: 22 69              .word   $2269
  000760: 00 0c              .word   $000C
  000762: 4e 91              JSR     (A1)  ; vtable call
  000764: 50 4f              .word   $504F
  000766: 60 30              .word   $6030
  000768: 4a ac              .word   $4AAC
  00076a: 02 62              .word   $0262
  00076c: 67 2a              .word   $672A
  00076e: 55 4f              .word   $554F
  000770: a9 94              .word   $A994
  000772: 30 1f              .word   $301F
  000774: 3a 00              .word   $3A00
  000776: 26 2c              .word   $262C
  000778: 02 62              .word   $0262
  00077a: 20 43              .word   $2043
  00077c: 3f 28              .word   $3F28
  00077e: 09 38              .word   $0938
  000780: a9 98              .word   $A998
  000782: 2f 0a              .word   $2F0A
  000784: 2f 2c              .word   $2F2C
  000786: 02 62              .word   $0262
  000788: 20 57              .word   $2057
  00078a: 22 50              .word   $2250
  00078c: 22 69              .word   $2269
  00078e: 00 10              .word   $0010
  000790: 4e 91              JSR     (A1)  ; vtable call
  000792: 3f 05              .word   $3F05
  000794: a9 98              .word   $A998
  000796: 50 4f              .word   $504F
  000798: 20 04              .word   $2004
  00079a: c1 8c              .word   $C18C
  00079c: 4c df 0c 38        MOVEM.L (SP)+,#0C38
  0007a0: 4e 5e              UNLK    A6
  0007a2: 4e 75              RTS
