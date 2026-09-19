# File: Walks eight aligned words twice to provide a predictable cache-locality example.
# Labels: first, rewind, second, and done. Registers: $t0-$t4 hold pointers and loop counters.

    li    $t0, 1024
    li    $t1, 8
    li    $t2, 0
first:
    beq   $t2, $t1, rewind
    sw    $t2, 0($t0)
    addiu $t0, $t0, 4
    addiu $t2, $t2, 1
    j     first
rewind:
    li    $t0, 1024
    li    $t2, 0
second:
    beq   $t2, $t1, done
    lw    $t3, 0($t0)
    addu  $t4, $t4, $t3
    addiu $t0, $t0, 4
    addiu $t2, $t2, 1
    j     second
done:
    halt

