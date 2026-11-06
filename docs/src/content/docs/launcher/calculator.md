---
title: Calculator
description: Type a sum and get the answer, copied with Enter.
---

Type a calculation. The answer shows at the top; press <kbd>Enter</kbd> to copy it.

![The launcher showing (1299*12)/100 = 155.88.](../../../assets/screenshots/tool-calculator.webp)

## What it understands

- Operators `+ - * / %` (`%` is the remainder, so `7%4` is 3), powers with `^` or `**`, brackets, and `×` and `÷`.
- Functions `sqrt abs round floor ceil sin cos tan log ln exp min max pow`, and the constants `pi` and `e`.

```text
(2+3)*4          → 20
2^10             → 1024
sqrt(16)+max(1,2) → 6
```

Only complete, valid expressions are treated as maths. A bare number, a word, or something like `1/0` is left alone and searched normally.

## History

Calculations you copy are saved, and appear under **Recent** as `expression = answer` so you can copy them again. The history keeps the last 25.

## Also a widget

The [Calculator tool widget](/widgets/tool-widgets/) puts the same box on your dashboard.
