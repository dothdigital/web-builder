# Source reconciliation — October 22, 2026

Canonical source: `https://github.com/dothdigital/web-builder`, branch `main`.

The comparison against base commit `684f33a37c892757ef9cf28976a8dea2d35b6f02`
found that both `/home/ubuntu/webtummy` and the active web snapshot
`menu-management-20261020` matched every compared tracked source file. These
server directories did not contain `.git`; their release names alone were not
proof of source identity. The background worker used the older
`distinct-section-images-20261019` snapshot, with 12 differing files. No live
services were changed during reconciliation.

The local work being consolidated includes:

- Live speech-to-text into intake fields and immediate microphone release.
- Chip inputs for services, tone, industry and service areas.
- Explicit service-area placement, multiple design references with voice notes,
  Google field help, address city/province and extra phone numbers.
- Restored branded template assets and inner-page component mappings.
- Business Classic copy constraints, portrait fitting, removal of decorative
  background text and rotating shapes, and consistent service-label casing.
- Generation page/image counters and content-direction preferences.
- An additive migration for phone-number arrays and release source manifests.

The local preview's saved draft repairs are database changes, not source files;
they are not copied to production by a Git push. Existing production sites do
not need to be regenerated to preserve their saved content.

Full workspace type checking and focused regression checks pass. Automated
render/asset checks cover all 18 templates and their inner pages. Complete
visual fidelity of Business Classic is still awaiting browser comparison with
its reference HTML; this source is not a declaration of visual approval.

Before deploying, prepare web and worker artifacts from the same reviewed Git
commit, apply the additive database migration with the normal release process,
and identify each artifact with its `deploy/source-version.json`. Never replace
or restart an active production worker to synchronize source during a build.
