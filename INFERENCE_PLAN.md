# Word-to-root inference plan

Status: proposal; inference is not implemented by this document.

## Outcome and boundaries

Keep one search bar, static hosting, build-time Python managed by uv, strict TypeScript, and the existing category tabs. Nişanyan remains the only source of lexical and etymological evidence. A pattern match must never become a dictionary entry or acquire a green source badge.

There are two different operations:

- **Resolve an inflected word to a sourced lemma:** `teftişlerden → teftiş → فتش`. The Arabic root is sourced for the lemma; the analysis of the input is computational.
- **Suggest a root from an unfamiliar word:** match its shape against Arabic templates and limited Turkish borrowing correspondences. This produces **Varsayımsal** results, possibly several or none.

We cannot precompute every Turkish word: suffix chains and productive derivation are open-ended. We can precompute all combinations within explicitly bounded paradigms and the existing finite root/template inventory. The first release should advertise that scope.

## 1. Define evidence and resolution before adding rules

Introduce separate typed matches for a direct Nişanyan entry, an inflection of a Nişanyan lemma, and a pattern hypothesis. Inflected matches retain the lemma's entry reference and the inferred suffix sequence. Hypotheses retain the full Arabic root identity, pattern ID, matched surface, and transformation rule IDs.

Do not use a single numeric confidence value as a substitute for this distinction. Preserve all ties. A known root does not prove that an unfamiliar input derives from it.

Search precedence:

1. Exact sourced headword, including existing circumflex aliases.
2. Explicit root input, retaining current Arabic and three-letter root behavior.
3. A supported inflected surface whose lemma has a Nişanyan root connection.
4. A hypothetical reverse-pattern match for an otherwise unresolved word.
5. No supported analysis.

An authoritative Nişanyan record establishing another origin must block a conflicting hypothetical etymology when such a record is available. Missing data alone does not establish that a word has no Arabic root.

## 2. Precompute Turkish inflections of known lemmas

Start with a closed nominal paradigm: singular/plural, possessive endings, and noun cases in their legal order. Exclude productive derivational suffixes, informal spellings, compounds assembled from separate words, proper-name guesses, and arbitrary repeated suffix chains from this first release.

Use a build-time Zemberek adapter as the initial implementation candidate. Its documented API supports custom dictionaries, morphology analysis, and surface generation. Construct the lexicon from Nişanyan-backed entries only, without loading its default vocabulary or accepting its unknown-token guesses. Python orchestrates the tool and exports JSON; this adds a pinned Java build dependency, not a visitor dependency. [Zemberek morphology documentation](https://github.com/ahmetaa/zemberek-nlp/tree/master/morphology)

First run a small compatibility spike covering `teftişlerden`, `müfettişlerin`, `kitabımızdan`, `hakkı`, and circumflex-bearing lemmas. Supply reviewed part-of-speech and stem-alternation attributes where necessary; do not assume a newly supplied lemma has all the correct exceptional attributes automatically. Record every analysis when a surface is ambiguous.

Export a surface-to-lemma index, including the suffix analysis and lemma reference. Do not add those surfaces to the sourced dictionary or increase the sourced-entry count. A missing or unsupported analysis stays unresolved.

Deliver this phase independently: it improves ordinary searches before speculative root inference is introduced.

## 3. Build a reverse index of Arabic templates

In Python, index `surface → [(Arabic root, pattern, transformation rules)]` across the existing Arabic root inventory and 43 templates. Generate this index before dictionary overrides remove display rows, so sourced patterns do not leave holes in inference coverage. Direct dictionary lookup still wins at query time.

Initially include regular forms only. The current raw templates for weak, doubled, and hamzated roots, and affected VIII patterns, are not reliable inputs for productive inference. Their known Nişanyan words remain searchable through the dictionary and inflection index. Add exceptional-root inference later, together with the missing sound rules and dedicated evidence.

The experimental Turkish triple inventory remains available for explicit root experiments. It is not an Arabic etymology inference inventory.

Preserve NFC, Turkish casing, and the existing circumflex search aliases. Keep `ş/s`, `ç/c`, `ı/i`, `ö/o`, and `ü/u` distinct. Preserve every Arabic root behind a shared Turkish reading.

## 4. Add limited Turkish borrowing correspondences

Our generator currently produces approximate Arabic readings; those are not automatically historical Turkish loanword spellings. An exact reverse index alone will therefore miss words.

Create a small, versioned set of pattern-specific surface correspondences using Nişanyan examples. Each rule must carry an identifier, examples, counterexamples, and an explicit application limit. Avoid unrestricted vowel replacement, edit-distance matching, or simply removing vowels and taking three consonants.

Keep dictionary aliases and inferred borrowing variants separate. A rule-derived spelling is hypothetical even when the root is known. Order results deterministically by exact template match, then fewer permitted transformations, with dictionary-attested root presence only a secondary ranking signal. This ordering is not a calibrated probability.

Evaluate these rules with entire roots held out, so examples from one root family cannot train a rule and also validate it. Freeze rules before evaluating the held-out set. Add known non-Arabic Nişanyan examples as negative controls.

Do not combine speculative suffix removal with speculative borrowing rules in the first release. Initially, Turkish inflection lookup applies to sourced lemmas; unfamiliar bare words get the reverse-pattern fallback. Combining those operations belongs to a later, separately evaluated phase.

## 5. Integrate through domain and IO layers

| Location                       | Responsibility                                              |
| ------------------------------ | ----------------------------------------------------------- |
| `pipeline/turkish.py`          | Build-time morphology adapter and bounded inflection export |
| `pipeline/inference.py`        | Reverse index, rule variants, collisions and provenance     |
| `pipeline/model.py`            | Typed wire contracts for analyses and index metadata        |
| `pipeline/build.py`            | Deterministic generation, shard publication and build IDs   |
| `src/model.ts`, `src/codec.ts` | Discriminated evidence types and validated JSON boundaries  |
| `src/inference.ts`             | Pure matching, precedence and candidate ordering            |
| `src/data.ts`                  | Lazy loading, caching and retries for inference shards      |
| `src/main.ts`, `src/render.ts` | Search orchestration and presentation of typed results      |

Keep the exact-word bootstrap small. Store larger inflection and hypothesis indexes as versioned, deterministically sharded JSON, requested only after ordinary lookup fails. Select the shard layout after measuring the built index. Never download all root files to answer a word query.

Include adapter version, morphology configuration, rule files and lexicon contents in the build identity. Preserve the current rejection of mixed builds, failed-request retries, and protection against an older search overwriting a newer result.

## 6. Present inference in the existing search flow

- For an inflected match, show a short path such as `teftişlerden → teftiş → f-t-ş`, with the suffix analysis available as detail. The sourced lemma and its existing dictionary forms stay green; the submitted inflection is not presented as a separately sourced entry.
- For a hypothesis, show **Varsayımsal kök**, the matched pattern, and an optional explanation of transformations. Give no invented definition to the unfamiliar input.
- Collapse identical Turkish outputs into one result while retaining alternative Arabic roots. Keep distinct dictionary families distinguishable by their actual words and meanings.
- Keep the giant search bar, fixed tab order, and green dictionary overrides. Do not restore the removed long raw-template warning.
- When no supported analysis survives, say so. Do not force a root or silently choose between tied candidates.

## 7. Validation and release order

Release in this order: evidence types and fixtures → known-lemma inflections → exact reverse-template matching → evaluated borrowing correspondences → exceptional-root rules and broader suffix composition.

Acceptance checks:

- All sourced headwords retain their roots and lookup priority; direct root searches and experimental triples retain their behavior.
- Every inflection result points to an existing Nişanyan entry and a supported suffix analysis; ambiguous analyses survive.
- Hypothetical matches never change dictionary counts, source badges, definitions, or evidence status.
- Held-out-root results report top-1/top-5 retrieval, abstention, coverage, and false suggestions on negative controls. Agree on a false-suggestion threshold before tuning; measure quality rather than inventing confidence percentages.
- Every applicable regular template round-trips to a candidate containing its original root and pattern, including collisions and slots hidden by dictionary overrides.
- Test malformed shards, mixed builds, escaped output, failed downloads and rapid successive searches.
- Measure compressed index size, additional requests and lookup latency; startup must not fetch the inference corpus.
- Run `npm run check`, `npm test`, formatting checks, and the static HTTP check.

CAMeL Tools can be reconsidered for a later Arabic-script input feature. Its analyzer consumes a morphology database and Arabic input; it does not by itself resolve Turkish borrowing spellings. It is not needed for the proposed first release. [CAMeL analyzer documentation](https://camel-tools.readthedocs.io/en/latest/api/morphology/analyzer.html)
