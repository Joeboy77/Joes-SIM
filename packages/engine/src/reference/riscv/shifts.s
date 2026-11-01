# Arithmetic and logical shifts of a negative number
.text
        li   t0, -16
        srai a0, t0, 2
        li   a7, 1
        ecall
        li   a0, 10
        li   a7, 11
        ecall
        srli a0, t0, 28
        li   a7, 1
        ecall
        li   a0, 10
        li   a7, 11
        ecall
        slli a0, t0, 1
        li   a7, 1
        ecall
        li   a0, 10
        li   a7, 11
        ecall
        li   a7, 10
        ecall
