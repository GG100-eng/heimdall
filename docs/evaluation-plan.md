# Heimdall: ranking evaluation

**Status: proposed evaluation. No results reported yet.**

The decision is whether AI ranking improves the usefulness of a finite feed enough to justify its cost, delay and mistakes.

## Compare three approaches

1. **Chronological:** show the newest posts first.
2. **Keywords:** match a fixed list derived from the user's stated goal, with recency as the tie-breaker.
3. **AI ranking:** assess relevance to the same goal and return an ordered list with a short reason for each selection.

Use the same candidate posts and the same selection limit for all three. Keep goal-specific results separate so a strong result on one goal cannot hide a weak result on another.

## Build the evaluation set

Start with 50–100 public posts and a few specific goals. Include useful posts, near misses, stale opportunities, duplicates and interesting distractions. Store the source URL, capture time and the exact text available to the ranker.

Have the person who owns the goal label relevance before seeing the rankings. A second reviewer can check a sample and record disagreements. Keep a held-out set that is not used to tune the prompt or keyword list.

| Label | Meaning |
| --- | --- |
| 0 — exclude | Irrelevant, misleading, stale or unusable for this goal |
| 1 — related | On topic, with no clear value for the current goal |
| 2 — useful | Helps with a decision, task or understanding tied to the goal |
| 3 — important | A strong opportunity or piece of information the user would regret missing |

Record serendipity separately. An interesting discovery should not automatically count as a relevant result. Incomplete or uncertain source material should be flagged for review before it enters the scored set.

## Measure the result

For the first comparison, set the selection limit to ten and report:

| Measure | Definition |
| --- | --- |
| Useful selections | Posts labelled 2 or 3 among the selected ten |
| Important coverage | Selected posts labelled 3 divided by all posts labelled 3 in the candidate set |
| Bad inclusions | Selected posts labelled 0, with the reason each is harmful or distracting |
| Explanation support | Whether each stated reason follows from the source and the user's goal |
| Latency | Time from submitting candidates to receiving a usable ranked list |
| Cost | Actual model and retrieval cost per refresh, with the assumptions stated |

Use “not applicable” when there are no important posts in a candidate set. Report the underlying counts alongside percentages.

If fewer than ten posts are useful, allow a shorter feed. Record its length and coverage so returning fewer posts cannot conceal important misses.

## Review failure cases

Inspect the actual posts behind the numbers. Distinguish between misunderstood goals, keyword bait, expired opportunities, duplicate content, unsupported explanations and missing context.

For each change to the ranker, record the prompt and model version, the failure it targets, and the before/after result on the unchanged held-out set. Keep the source text treated as content to assess; instructions inside a post must not change the ranking task.

The frontend also needs explicit checks for an empty result, an invalid response and a stale feed. Its current snapshot fallback keeps content visible, but does not prove that the content is current.

## Make the product decision

Before running the held-out comparison, agree the acceptable trade-off between useful selections and important misses. Set cost and latency limits for the intended refresh frequency. Record those limits before seeing the results.

Keep the simpler approach if the AI ranker does not provide a useful improvement. If it does, follow with a small repeated-use trial: did people find relevant information, return voluntarily, and act on anything they found?

Publish the failures and the resulting product changes alongside the scores. The evaluation should inform what gets built next.
