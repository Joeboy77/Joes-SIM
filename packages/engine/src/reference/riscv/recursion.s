# Recursive sum of 5 + 4 + ... + 0, saving ra and n on the stack
.text
main:   li   a0, 5
        jal  ra, sum
        li   a7, 1
        ecall
        li   a7, 10
        ecall
sum:    beqz a0, base
        addi sp, sp, -8
        sw   ra, 4(sp)
        sw   a0, 0(sp)
        addi a0, a0, -1
        jal  ra, sum
        lw   t0, 0(sp)
        lw   ra, 4(sp)
        addi sp, sp, 8
        add  a0, a0, t0
        ret
base:   ret
