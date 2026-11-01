# lb sign-extends a byte; lbu does not
.data
b:      .byte 200, 0x7f
.text
        la   t0, b
        lb   a0, 0(t0)
        li   a7, 1
        ecall
        li   a0, 32
        li   a7, 11
        ecall
        lbu  a0, 0(t0)
        li   a7, 1
        ecall
        li   a7, 10
        ecall
