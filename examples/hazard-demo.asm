# File: Exercises forwarding, a load-use stall, memory, a conditional branch, and a jump flush.
# Labels: start, never, and done. Registers: $sp holds 256; $t0-$t5 hold deterministic values.

start:
    li    $sp, 256
    li    $t0, 5
    li    $t1, 8
    addu  $t2, $t0, $t1
    sw    $t2, 0($sp)
    lw    $t3, 0($sp)
    addu  $t4, $t3, $t2
    beq   $t4, $zero, never
    subu  $t5, $t4, $t0
    j     done
never:
    li    $t5, -1
done:
    halt

