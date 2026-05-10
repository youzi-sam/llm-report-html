# llm-report-html — Agent skill

This folder is the project's primary deliverable. The contents below are **generated** from `internal/skill/templates/` + `internal/schema/schema.json`.

**To populate / refresh**:
```bash
make skill          # regenerates SKILL.md, references/, assets/recipes/
```

After regeneration:
- `SKILL.md` — entry; gitignored
- `references/*.md` — Agent on-demand references; gitignored
- `assets/recipes/*.json` — vetted starter templates (mirror of `/recipes/`); gitignored
- `scripts/install-binary.sh` — bootstrap helper; **committed**

**To install globally** (so the skill is discoverable in any project):
```bash
ln -s "$(git rev-parse --show-toplevel)/.claude/skills/llm-report-html" \
      ~/.claude/skills/llm-report-html
```

The skill's only runtime dependency is the `llm-report-html` binary on `$PATH`. See `scripts/install-binary.sh`.
