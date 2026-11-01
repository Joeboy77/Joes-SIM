# 7 x -6 by repeated addition
.text
        li   t0, 7
        li   t1, -6
        li   t2, 0
loop:   beqz t0, done
        add  t2, t2, t1
        addi t0, t0, -1
        j    loop
done:   mv   a0, t2
        li   a7, 1
        ecall
        li   a7, 10
        ecall
