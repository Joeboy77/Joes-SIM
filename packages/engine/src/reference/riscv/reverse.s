# Reverse an array in place with lw and sw
.data
a:      .word 1, 2, 3, 4
.text
        la   t0, a
        addi t1, t0, 12
loop:   bge  t0, t1, print
        lw   t2, 0(t0)
        lw   t3, 0(t1)
        sw   t3, 0(t0)
        sw   t2, 0(t1)
        addi t0, t0, 4
        addi t1, t1, -4
        j    loop
print:  la   t0, a
        li   t4, 4
p:      beqz t4, end
        lw   a0, 0(t0)
        li   a7, 1
        ecall
        addi t0, t0, 4
        addi t4, t4, -1
        j    p
end:    li   a7, 10
        ecall
