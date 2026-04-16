; Draw__7CDialogFv
; File offset: 0x2234 - 0x226c (56 bytes)
; Source: scsi-plug-rsrc.bin

  002234: 4e 56 ff fc        LINK    A6,#$FFFC (-4)
  002238: 2f 0a              .word   $2F0A
  00223a: 24 6e 00 08        MOVEA.L 8(A6),A2
  00223e: 48 6e ff fc        PEA     -4(A6)
  002242: a8 74              .word   $A874
  002244: 2f 2a              .word   $2F2A
  002246: 00 04              .word   $0004
  002248: a8 73              .word   $A873
  00224a: 2f 2a              .word   $2F2A
  00224c: 00 04              .word   $0004
  00224e: a9 81              .word   $A981
  002250: 2f 0a              .word   $2F0A
  002252: 20 57              .word   $2057
  002254: 22 68              .word   $2268
  002256: 00 0e              .word   $000E
  002258: 22 69              .word   $2269
  00225a: 00 30              .word   $0030
  00225c: 4e 91              JSR     (A1)  ; vtable call
  00225e: 2f 2e              .word   $2F2E
  002260: ff fc              .word   $FFFC
  002262: a8 73              .word   $A873
  002264: 58 4f              .word   $584F
  002266: 24 5f              .word   $245F
  002268: 4e 5e              UNLK    A6
  00226a: 4e 75              RTS
