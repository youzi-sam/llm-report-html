.PHONY: build template skill all install test clean schema html

BIN := bin/llm-report-html
SCHEMA := internal/schema/schema.json
SCHEMA_MANIFEST := internal/schema/manifest.json
SCHEMA_GEN := internal/schema/generate-schema.mjs
TEMPLATE_SRC := template/dist/index.html
TEMPLATE_EMBED := internal/render/html/template.html
TEMPLATE_CATALOG := template/src/generated/catalog.js
TEMPLATE_INPUTS := $(shell find template/src -type f ! -path 'template/src/generated/*') template/index.html template/package.json template/package-lock.json template/vite.config.js
SKILL_DIR := .claude/skills/llm-report-html

# Default: build binary AND populate skill folder.
all: build skill

build: schema template-embed
	CGO_ENABLED=0 go build -trimpath -o $(BIN) ./cmd/llm-report-html

schema: $(SCHEMA)
$(SCHEMA): $(SCHEMA_MANIFEST) $(SCHEMA_GEN)
	node $(SCHEMA_GEN)

template-embed: $(TEMPLATE_EMBED)
$(TEMPLATE_EMBED): $(TEMPLATE_SRC)
	cp $< $@

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

install: build
	cp $(BIN) ~/.local/bin/

test: build
	@for r in $$($(BIN) recipe list | awk '/^  [a-z]/ {print $$1}'); do \
	  printf '%-26s ' "recipe/$$r"; \
	  $(BIN) recipe show $$r | $(BIN) validate 2>&1 | tail -1; \
	done

html: build
	$(BIN) recipe show calculator | $(BIN) render -o report.html

clean:
	rm -rf bin template/dist template/node_modules
	rm -rf template/src/generated
	rm -f $(SKILL_DIR)/SKILL.md
	rm -rf $(SKILL_DIR)/references $(SKILL_DIR)/assets
