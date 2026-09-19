# Supported ISA Profile

## Status

This is an educational MIPS32-inspired profile. Instruction widths, register count, R/I/J field layouts, conventional register names, branch-relative offsets, `$zero`, and aligned word operations follow familiar MIPS patterns. `halt` is a workbench-only control instruction using opcode `0x3f`; it is not presented as a standard processor instruction.

## Register model

- 32 unsigned 32-bit general-purpose registers.
- `$zero` / register 0 always reads as zero and ignores writes.
- Conventional aliases `$at`, `$v0-$v1`, `$a0-$a3`, `$t0-$t9`, `$s0-$s7`, `$k0-$k1`, `$gp`, `$sp`, `$fp`, and `$ra` are accepted.
- Numeric forms `$0` through `$31` are accepted.
- There are no HI/LO, floating-point, control, exception, or coprocessor registers.

## Instructions and semantics

| Instruction | Meaning | Notable policy |
|---|---|---|
| `addu rd, rs, rt` | `rd = rs + rt` | wraps modulo 2³²; no overflow trap |
| `subu rd, rs, rt` | `rd = rs - rt` | wraps modulo 2³² |
| `and rd, rs, rt` | bitwise AND | register operands |
| `or rd, rs, rt` | bitwise OR | register operands |
| `slt rd, rs, rt` | signed less-than | writes 0 or 1 |
| `sll rd, rt, shamt` | logical shift left | `shamt` must be 0–31 |
| `addiu rt, rs, imm` | sign-extended addition | wraps; no overflow trap |
| `lw rt, off(base)` | load aligned word | absent sparse memory reads as zero |
| `sw rt, off(base)` | store aligned word | unaligned address fails |
| `beq rs, rt, label` | branch if equal | signed PC-relative word offset |
| `bne rs, rt, label` | branch if unequal | signed PC-relative word offset |
| `j label` | absolute-region jump | 26-bit word target with upper PC region bits |
| `nop` | no architectural change | machine word zero |
| `halt` | stop fetching and drain | workbench-only opcode |

There are no architecturally visible delay slots. The pipeline flushes younger instructions when control transfer resolves.

## Assembler conveniences

- `li rt, imm` becomes `addiu rt, $zero, imm` and therefore accepts only signed 16-bit values.
- `move rd, rs` becomes `addu rd, rs, $zero`.
- `.word value` emits a raw unsigned 32-bit word.
- Labels must begin with an ASCII letter or underscore and may continue with ASCII letters, digits, or underscores.
- `#` begins a comment.

Each accepted source statement emits exactly one word. Macro expansion, sections, relocation, linking, and expression evaluation are intentionally out of scope.

## Pipeline policy

- Five in-order stages: IF, ID, EX, MEM, WB.
- Arithmetic results forward from EX/MEM; completed results forward from MEM/WB.
- A direct load-use dependency incurs one interlock cycle.
- Branches and jumps resolve in EX and flush younger pipeline positions.
- There is no branch prediction, exception pipeline, cache latency coupling, superscalar issue, or out-of-order execution.

## Endianness and binary output

The `assemble` command writes words in big-endian byte order, a deliberate stable file-format choice. The in-memory interpreter works with numeric words and is independent of the host machine’s byte order.

