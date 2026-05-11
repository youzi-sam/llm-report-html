.PHONY: build template skill all install test diagram-check rendered-diagram-check reading-aids-check code-highlight-check math-check clean schema html

BIN := bin/llm-report-html
SCHEMA := internal/schema/schema.json
SCHEMA_MANIFEST_INPUTS := $(shell find internal/schema/manifest-src -type f 2>/dev/null)
SCHEMA_GEN := internal/schema/generate-schema.mjs
TEMPLATE_SRC := template/dist/index.html
TEMPLATE_EMBED := internal/render/html/template.html
TEMPLATE_ASSETS := internal/render/html/assets
TEMPLATE_CATALOG := template/src/generated/catalog.js
TEMPLATE_INPUTS := $(shell find template/src -type f ! -path 'template/src/generated/*') template/index.html template/package.json template/package-lock.json template/vite.config.js template/scripts/build-runtime.mjs
SKILL_DIR := .claude/skills/llm-report-html

# Default: build binary AND populate skill folder.
all: build skill

build: schema template-embed
	CGO_ENABLED=0 go build -trimpath -o $(BIN) ./cmd/llm-report-html

schema: $(SCHEMA)
$(SCHEMA): $(SCHEMA_MANIFEST_INPUTS) $(SCHEMA_GEN)
	node $(SCHEMA_GEN)

template-embed: $(TEMPLATE_EMBED)
$(TEMPLATE_EMBED): $(TEMPLATE_SRC)
	cp $< $@
	rm -rf $(TEMPLATE_ASSETS)
	mkdir -p $(TEMPLATE_ASSETS)
	cp template/dist/assets/* $(TEMPLATE_ASSETS)/

template: $(TEMPLATE_SRC)
$(TEMPLATE_SRC): $(TEMPLATE_CATALOG) $(TEMPLATE_INPUTS)
	cd template && npm install --silent && npm run build --silent

$(TEMPLATE_CATALOG): $(SCHEMA) template/scripts/generate-catalog.mjs
	node template/scripts/generate-catalog.mjs

# Regenerate the skill folder from internal/skill/templates + schema + recipes.
# Generated artifacts (SKILL.md, references/, assets/recipes/) are gitignored;
# only the templates and skill-folder README/scripts are committed.
skill: build
	$(BIN) skill --output-dir $(SKILL_DIR)
	mkdir -p $(SKILL_DIR)/assets/recipes
	cp recipes/*.json $(SKILL_DIR)/assets/recipes/
	cp -R recipes/runtime $(SKILL_DIR)/assets/recipes/

install: build
	cp $(BIN) ~/.local/bin/

test: build diagram-check rendered-diagram-check reading-aids-check code-highlight-check math-check
	@for r in $$($(BIN) recipe list | awk '/^  [a-z]/ {print $$1}'); do \
	  printf '%-26s ' "recipe/$$r"; \
	  $(BIN) validate recipes/$$r.json 2>&1 | tail -1; \
	done

diagram-check: build
	cd template && node scripts/check-diagrams.mjs

rendered-diagram-check: build
	$(BIN) render template/fixtures/diagrams.json -o /tmp/llm-report-html-diagram-smoke.html --no-open
	node template/scripts/check-rendered-diagrams.mjs /tmp/llm-report-html-diagram-smoke.html

reading-aids-check: build
	$(BIN) render template/fixtures/reading-aids.json -o /tmp/llm-report-html-reading-aids-smoke.html --no-open
	node template/scripts/check-rendered-reading-aids.mjs /tmp/llm-report-html-reading-aids-smoke.html

code-highlight-check: build
	$(BIN) render template/fixtures/reading-aids.json -o /tmp/llm-report-html-code-highlight-smoke.html --no-open
	node template/scripts/check-rendered-code-highlight.mjs /tmp/llm-report-html-code-highlight-smoke.html

math-check: build
	$(BIN) render template/fixtures/math.json -o /tmp/llm-report-html-math-smoke.html --no-open
	node template/scripts/check-rendered-math.mjs /tmp/llm-report-html-math-smoke.html

html: build
	$(BIN) render recipes/calculator.json -o report.html

clean:
	rm -rf bin template/dist template/node_modules
	rm -rf template/src/generated
	rm -rf $(TEMPLATE_ASSETS)
	rm -f $(SKILL_DIR)/SKILL.md
	rm -rf $(SKILL_DIR)/references $(SKILL_DIR)/assets
