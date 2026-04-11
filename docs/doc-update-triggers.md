# Documentation Update Triggers

After completing code changes, check this table and update any affected docs. Also search `docs/` for references to affected concepts and update stale descriptions.

| Change Type                       | What to Update                                                             |
| --------------------------------- | -------------------------------------------------------------------------- |
| **New component or service**      | `AGENTS.md` repo layout + architecture section                             |
| **New/changed API interaction**   | `AGENTS.md` if pattern changes, relevant service docs                      |
| **Config file changes**           | `AGENTS.md` tech stack (if new tool), conventions if they change           |
| **CI pipeline changes**           | `docs/dagger-ci-guide.md`, `AGENTS.md` commands section                    |
| **New test pattern or tool**      | `docs/testing-strategy.md`                                                 |
| **ESLint rule changes**           | `AGENTS.md` tech stack if major, `eslint.config.js` comments               |
| **New Angular route or guard**    | `AGENTS.md` architecture section                                           |
| **Dagger function added/changed** | `docs/dagger-ci-guide.md` function table, `AGENTS.md` commands             |
| **Coverage threshold change**     | `docs/testing-strategy.md` coverage section                                |
| **Release process change**        | `docs/release-strategy.md`                                                 |
| **New dependency (major)**        | `AGENTS.md` tech stack                                                     |
| **Node/pnpm version change**      | `AGENTS.md` tech stack, `.tool-versions`, `.dagger/src/index.ts` constants |
| **New docs file created**         | `AGENTS.md` Documentation Map table                                        |
| **Git hook changes**              | `AGENTS.md` development policy, `lefthook.yml`                             |
| **Environment config changes**    | `AGENTS.md` if build configurations change                                 |
