# Add 1 to 10 with a loop
.text
        li   t0, 0          # total
        li   t1, 1          # i
        li   t2, 10
loop:   bgt  t1, t2, done
        add  t0, t0, t1
        addi t1, t1, 1
        j    loop
done:   mv   a0, t0
        li   a7, 1
        ecall
        li   a7, 10
        ecall
