# Length of a string, then a character
.data
s:      .asciz "riscv"
.text
        la   t0, s
        li   t1, 0
loop:   lbu  t2, 0(t0)
        beqz t2, done
        addi t1, t1, 1
        addi t0, t0, 1
        j    loop
done:   mv   a0, t1
        li   a7, 1
        ecall
        li   a0, 33
        li   a7, 11
        ecall
        li   a7, 10
        ecall
