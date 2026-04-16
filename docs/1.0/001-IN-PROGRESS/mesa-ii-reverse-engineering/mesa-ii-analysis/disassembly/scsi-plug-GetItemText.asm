; GetItemText__7CDialogFsPUc
; File offset: 0x2524 - 0x2550 (44 bytes)
; Source: scsi-plug-rsrc.bin

  002524: 4e 56 ff f2        LINK    A6,#$FFF2 (-14)
  002528: 20 6e 00 08        MOVEA.L 8(A6),A0
  00252c: 2f 28 00 04        MOVE.L  4(A0),-(SP)
  002530: 3f 2e              .word   $3F2E
  002532: 00 0c              .word   $000C
  002534: 48 6e ff fa        PEA     -6(A6)
  002538: 48 6e ff fc        PEA     -4(A6)
  00253c: 48 6e ff f2        PEA     -14(A6)
  002540: a9 8d              .word   $A98D
  002542: 2f 2e              .word   $2F2E
  002544: ff fc              .word   $FFFC
  002546: 2f 2e              .word   $2F2E
  002548: 00 0e              .word   $000E
  00254a: a9 90              .word   $A990
  00254c: 4e 5e              UNLK    A6
  00254e: 4e 75              RTS
