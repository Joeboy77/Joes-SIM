# Print a string
.data
msg:    .asciz "Hello, RISC-V!\n"
.text
        la   a0, msg
        li   a7, 4
        ecall
        li   a7, 10
        ecall
