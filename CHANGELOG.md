# Changelog

## Lessons (V1 build, 2026-09-17)

| Failure mode | Detection signal | Prevention rule |
|---|---|---|
| Stain labels lost antibody digits (CD3 → "CD", Ki67 → "Ki") because a regex stripped every trailing number | A tally of stain labels in the built catalog | Strip only explicit slide numbering (`HE1`, `MGG-1`). Check label distributions after any naming regex. |
| Slides directly under a chapter title got no heading, so `hodgkin/HE` was titled with its id and "lymphoma" found nothing | Independent review, reproduced with `search_slides("lymphoma")` returning no_match | Quarto chapter titles have no `data-anchor-id`, so fall back to the page title. Test that each chapter-level slide is searchable. |
| Keeping only the top score tier let filler words ("can", "için") push the correctly titled case out | Review: "Can you find colon adenocarcinoma?" | Also keep the best title matches; prefix-match only tokens of 4+ characters; keep a small stopword list. Regression test added. |
| Hyphenated markers (Ki-67, HER-2, c-erbB-2) split into short fragments that matched slide numbers | Review: "c-erbB-2" returned GBD2 and a quiz case | Join letter-hyphen-digit and single-letter prefixes in `tokens()` (applies to both the index and queries). |
| URL boilerplate ("com", "sec") in a pasted atlas link picked unrelated quiz cases as suggestions | Review: `show_slide` with an atlas section URL | Resolve atlas section URLs directly; strip URL parts before suggesting; URL words are stopwords. |
