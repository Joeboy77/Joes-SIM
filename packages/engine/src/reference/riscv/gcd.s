# Greatest common divisor by subtraction
.text
        li   t0, 48
        li   t1, 18
loop:   beq  t0, t1, done
        blt  t0, t1, less
        sub  t0, t0, t1
        j    loop
less:   sub  t1, t1, t0
        j    loop
done:   mv   a0, t0
        li   a7, 1
        ecall
        li   a7, 10
        ecall
