# Sum an array of words
.data
arr:    .word 3, -1, 4, 1, 5
n:      .word 5
.text
        la   t0, arr
        la   t2, n
        lw   t1, 0(t2)
        li   t3, 0
loop:   beqz t1, done
        lw   t4, 0(t0)
        add  t3, t3, t4
        addi t0, t0, 4
        addi t1, t1, -1
        j    loop
done:   mv   a0, t3
        li   a7, 1
        ecall
        li   a7, 10
        ecall
