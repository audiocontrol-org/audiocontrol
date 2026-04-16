; GetItemValue__7CDialogFs
; File offset: 0x256e - 0x25a4 (54 bytes)
; Source: scsi-plug-rsrc.bin

  00256e: 4e 56 fe fc        LINK    A6,#$FEFC (-260)
  002572: 48 6e fe fc        PEA     -260(A6)
  002576: 3f 2e              .word   $3F2E
  002578: 00 0c              .word   $000C
  00257a: 2f 2e              .word   $2F2E
  00257c: 00 08              .word   $0008
  00257e: 20 57              .word   $2057
  002580: 22 68              .word   $2268
  002582: 00 0e              .word   $000E
  002584: 22 69              .word   $2269
  002586: 00 14              .word   $0014
  002588: 4e 91              JSR     (A1)  ; vtable call
  00258a: 42 ae              .word   $42AE
  00258c: ff fc              .word   $FFFC
  00258e: 48 6e fe fc        PEA     -260(A6)
  002592: 48 6e ff fc        PEA     -4(A6)
  002596: 4e b9 00 00 1b 8c  JSR     $00001B8C
  00259c: 20 2e              .word   $202E
  00259e: ff fc              .word   $FFFC
  0025a0: 4e 5e              UNLK    A6
  0025a2: 4e 75              RTS
