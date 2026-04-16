; SetTitle__7CDialogFPUc
; File offset: 0x267a - 0x2690 (22 bytes)
; Source: scsi-plug-rsrc.bin

  00267a: 4e 56 00 00        LINK    A6,#$0000 (0)
  00267e: 20 6e 00 08        MOVEA.L 8(A6),A0
  002682: 2f 28 00 04        MOVE.L  4(A0),-(SP)
  002686: 2f 2e              .word   $2F2E
  002688: 00 0c              .word   $000C
  00268a: a9 1a              .word   $A91A
  00268c: 4e 5e              UNLK    A6
  00268e: 4e 75              RTS
