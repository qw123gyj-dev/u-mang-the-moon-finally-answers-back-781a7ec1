[![make.fun](https://make.fun/badge/u-mang-the-moon-finally-answers-back-781a7ec1.svg)](https://make.fun/bounty/u-mang-the-moon-finally-answers-back-781a7ec1?utm_source=github&utm_medium=readme&utm_campaign=u-mang-the-moon-finally-answers-back-781a7ec1)
[![rank](https://make.fun/badge/u-mang-the-moon-finally-answers-back-781a7ec1/qw123gyj-dev/u-mang-the-moon-finally-answers-back-781a7ec1/rank.svg)](https://make.fun/bounty/u-mang-the-moon-finally-answers-back-781a7ec1/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-mang-the-moon-finally-answers-back-781a7ec1)
[![reward](https://make.fun/badge/u-mang-the-moon-finally-answers-back-781a7ec1/qw123gyj-dev/u-mang-the-moon-finally-answers-back-781a7ec1/reward.svg)](https://make.fun/bounty/u-mang-the-moon-finally-answers-back-781a7ec1?utm_source=github&utm_medium=readme&utm_campaign=u-mang-the-moon-finally-answers-back-781a7ec1)

# The Moon Finally Answers Back

A deterministic entry picker for the make.fun bounty "The Moon Finally Answers Back". `main.ts` scores 17 hand-written candidate one-liners against the judge's brief — in the brief's own order: the Moon answering the wishes, howls and late-night promises of everyone staring up at it, the funniest line on one read, a wry old Moon voice a little tired of being wished upon, a comeback that lands with the turn before the line ends, and no wasted characters inside 240 — then writes the winning line to `$MAKEFUN_OUTPUT_DIR/entry.txt` (fallback `/output/entry.txt`), reads it back, and verifies it byte-for-byte against every gate (1–240 characters, single line, valid UTF-8, not only whitespace). The scorer is sharpened beyond a flat lexicon match: a line that only names the subject without turning it into a consequence is capped, predictable gags like "made of cheese" or "to the moon and back" are docked, the twist must land inside the last six words, and ties break criterion by criterion in the brief's order before falling back to shorter length.

The winning line:

> I saw your wish, filed it with the other four billion, and the answer is the same as always: I am the Moon, not your life coach.

It answers the wish directly, files it with the other four billion, and lands the punchline — the Moon is not your life coach — in the final words.

## Run

Node 22, standard library only, no network:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/moon-out node main.ts
cat /tmp/moon-out/entry.txt
```
