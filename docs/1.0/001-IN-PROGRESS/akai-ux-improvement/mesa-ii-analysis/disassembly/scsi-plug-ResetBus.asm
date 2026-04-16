; ResetBus__10CSCSIUtilsFc
; File offset: 0x1eb8 - 0x1ef2 (58 bytes)
; Source: scsi-plug-rsrc.bin

  001eb8: 4e 56 ff dc        LINK    A6,#$FFDC (-36)
  001ebc: 48 78 00 24        PEA     $0024.W (=36)
  001ec0: 42 67              CLR.W   -(SP)
  001ec2: 48 6e ff dc        PEA     -36(A6)
  001ec6: 4e b9 00 00 24 e2  JSR     $000024E2
  001ecc: 3d 7c              .word   $3D7C
  001ece: 00 24              .word   $0024
  001ed0: ff e2              .word   $FFE2
  001ed2: 1d 7c              .word   $1D7C
  001ed4: 00 11              .word   $0011
  001ed6: ff e4              .word   $FFE4
  001ed8: 1d 6e              .word   $1D6E
  001eda: 00 0c              .word   $000C
  001edc: ff e9              .word   $FFE9
  001ede: 42 2e              .word   $422E
  001ee0: ff ea              .word   $FFEA
  001ee2: 42 2e              .word   $422E
  001ee4: ff eb              .word   $FFEB
  001ee6: 41 ee              .word   $41EE
  001ee8: ff dc              .word   $FFDC
  001eea: 70 01              .word   $7001
  001eec: a0 89              .word   $A089
  001eee: 4e 5e              UNLK    A6
  001ef0: 4e 75              RTS
