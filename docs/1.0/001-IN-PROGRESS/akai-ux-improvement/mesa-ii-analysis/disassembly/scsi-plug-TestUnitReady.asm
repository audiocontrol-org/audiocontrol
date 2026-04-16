; TestUnitReady__10CSCSIUtilsFs
; File offset: 0x1dc2 - 0x1dfc (58 bytes)
; Source: scsi-plug-rsrc.bin

  001dc2: 4e 56 ff fa        LINK    A6,#$FFFA (-6)
  001dc6: 2f 0a              .word   $2F0A
  001dc8: 24 6e 00 08        MOVEA.L 8(A6),A2
  001dcc: 2d 6c              .word   $2D6C
  001dce: 00 90              .word   $0090
  001dd0: ff fa              .word   $FFFA
  001dd2: 3d 6c              .word   $3D6C
  001dd4: 00 94              .word   $0094
  001dd6: ff fe              .word   $FFFE
  001dd8: 42 67              CLR.W   -(SP)
  001dda: 48 78 03 e8        PEA     $03E8.W (=1000)
  001dde: 42 a7              CLR.L   -(SP)
  001de0: 42 a7              CLR.L   -(SP)
  001de2: 48 6e ff fa        PEA     -6(A6)
  001de6: 3f 2e              .word   $3F2E
  001de8: 00 0c              .word   $000C
  001dea: 2f 0a              .word   $2F0A
  001dec: 4e ba              .word   $4EBA
  001dee: fd d0              .word   $FDD0
  001df0: 30 12              .word   $3012
  001df2: 4f ef              .word   $4FEF
  001df4: 00 18              .word   $0018
  001df6: 24 5f              .word   $245F
  001df8: 4e 5e              UNLK    A6
  001dfa: 4e 75              RTS
