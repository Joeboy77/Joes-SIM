# bltu treats -1 as a huge number; blt does not
.text
        li   t0, -1
        li   t1, 5
        li   a0, 0
        bltu t0, t1, u
        j    next
u:      li   a0, 1
next:   li   a7, 1
        ecall
        li   a0, 0
        blt  t0, t1, s
        j    out
s:      li   a0, 1
out:    ecall
        li   a7, 10
        ecall
