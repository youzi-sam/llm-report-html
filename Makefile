.PHONY: build template skill all install test clean

BIN := bin/llm-report-html
TEMPLATE_SRC := template/dist/index.html
TEMPLATE_EMBED := internal/render/html/template.html
SKILL_DIR := .claude/skills/llm-report-html

# Default: build binary AND populate skill folder.
all: build skill

build: template-embed
	CGO_ENABLED=0 go build -trimpath -o $(BIN) ./cmd/llm-report-html

template-embed: $(TEMPLATE_EMBED)
$(TEMPLATE_EMBED): $(TEMPLATE_SRC)
	cp $< $@

template: $(TEMPLATE_SRC)
$(TEMPLATE_SRC):
	cd template && npm install --silent && npx vite build

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

clean:
	rm -rf bin template/dist template/node_modules
	rm -f $(SKILL_DIR)/SKILL.md
	rm -rf $(SKILL_DIR)/references $(SKILL_DIR)/assets
