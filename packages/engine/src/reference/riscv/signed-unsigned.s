# slt and sltu see -1 differently
.text
        li   t0, -1
        li   t1, 1
        slt  a0, t0, t1
        li   a7, 1
        ecall
        sltu a0, t0, t1
        ecall
        li   a7, 10
        ecall
