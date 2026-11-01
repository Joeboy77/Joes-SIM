# li needs lui + addi for large values
.text
        li   a0, 0x12345FFF
        li   a7, 1
        ecall
        li   a0, 32
        li   a7, 11
        ecall
        li   t1, -2048
        li   t2, 2048
        add  a0, t1, t2
        li   a7, 1
        ecall
        li   a7, 10
        ecall
