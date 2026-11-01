# lh sign-extends a halfword; lhu does not; sh stores one
.data
h:      .half -2, 300
.text
        la   t0, h
        lh   a0, 0(t0)
        li   a7, 1
        ecall
        li   a0, 32
        li   a7, 11
        ecall
        lhu  a0, 0(t0)
        li   a7, 1
        ecall
        li   a0, 32
        li   a7, 11
        ecall
        li   t1, 7
        sh   t1, 2(t0)
        lh   a0, 2(t0)
        li   a7, 1
        ecall
        li   a7, 10
        ecall
