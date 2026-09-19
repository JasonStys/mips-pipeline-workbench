# File: Computes the tenth Fibonacci value with a bounded loop and stores the result at address 512.
# Labels: loop and done. Registers: $t0-$t4 track count, limit, and the recurrence state.

    li    $t0, 0
    li    $t1, 10
    li    $t2, 0
    li    $t3, 1
loop:
    beq   $t0, $t1, done
    addu  $t4, $t2, $t3
    move  $t2, $t3
    move  $t3, $t4
    addiu $t0, $t0, 1
    j     loop
done:
    li    $sp, 512
    sw    $t2, 0($sp)
    halt

