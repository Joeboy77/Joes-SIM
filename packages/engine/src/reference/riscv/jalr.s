# Call a function through a register with jalr
.text
        la   t0, f
        jalr ra, 0(t0)
        li   a0, 2
        li   a7, 1
        ecall
        li   a7, 10
        ecall
f:      li   a0, 1
        li   a7, 1
        ecall
        ret
