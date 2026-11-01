# and, or, xor and their immediate forms
.text
        li   t0, 12
        li   t1, 10
        and  a0, t0, t1
        jal  ra, show
        or   a0, t0, t1
        jal  ra, show
        xor  a0, t0, t1
        jal  ra, show
        andi a0, t0, 5
        jal  ra, show
        ori  a0, t0, 3
        jal  ra, show
        not  a0, t0
        li   a7, 1
        ecall
        li   a7, 10
        ecall
show:   li   a7, 1
        ecall
        li   a0, 32
        li   a7, 11
        ecall
        ret
