JSON_FILE := data.json
ENV_VAR_NAME := FRIENDS_CONFIG

.PHONY: help print-env run

help:
	@echo "Available commands:"
	@echo "  make print-env   - Prints the minified line to the console (for copying)"

print-env:
	@echo "$(ENV_VAR_NAME)='$$(deno eval 'console.log(JSON.stringify(JSON.parse(Deno.readTextFileSync("$(JSON_FILE)"))))')'"

run:
	@deno run --env-file --allow-env --allow-net main.ts