# pi-recipes-action

Validate a [Pi recipe](https://pi.recipes) in CI with the official
`recipes check` validator — a thin, drop-in GitHub Action wrapping
[`@introspection-ai/pi-recipes`](https://www.npmjs.com/package/@introspection-ai/pi-recipes).

By default it validates against the **latest published** checker on every run, so
new validation rules are caught the moment they ship — no version bump to your
recipe required. Pin the checker version when you want reproducible CI instead.

```yaml
name: recipe validation
on: [push, pull_request]
permissions:
  contents: read
jobs:
  recipe-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: introspection-org/pi-recipes-action@v1
```

That's the whole workflow. The action runs `recipes check . --profile ci` and
fails the job on any validation error.

## What it checks

`recipes check` is the same validator that backs the `recipes` CLI and the
`pi-recipe-check` crate. It validates the `package.json#pi` manifest, agent YAML
(required fields, `from` inheritance, name conflicts), MCP tool include/exclude
policy, evals pinning, and dependency-lockfile rules. See the
[pi-recipes docs](https://github.com/introspection-org/pi-recipes) for the full
rule set.

## Usage

### Minimal

```yaml
- uses: actions/checkout@v4
- uses: introspection-org/pi-recipes-action@v1
```

### Pin the checker for reproducible CI

By default the action floats to the newest published checker (`version: latest`).
Pin it if you'd rather opt out of automatic rule updates:

```yaml
- uses: introspection-org/pi-recipes-action@v1
  with:
    version: 0.10.4
```

### Stricter publish-profile gate

Run the strictest profile (e.g. on release tags), which escalates advisory
checks such as a missing lockfile to errors:

```yaml
- uses: introspection-org/pi-recipes-action@v1
  with:
    profile: publish
```

### A recipe in a subdirectory / monorepo

```yaml
- uses: introspection-org/pi-recipes-action@v1
  with:
    recipe-dir: recipes/my-recipe
```

### Validate several recipes in one repo

```yaml
jobs:
  recipe-check:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        recipe: [recipes/a, recipes/b, recipes/c]
    steps:
      - uses: actions/checkout@v4
      - uses: introspection-org/pi-recipes-action@v1
        with:
          recipe-dir: ${{ matrix.recipe }}
```

## Inputs

| Input           | Default                 | Description                                                                 |
| --------------- | ----------------------- | --------------------------------------------------------------------------- |
| `recipe-dir`    | `.`                     | Path to the recipe directory to validate.                                   |
| `profile`       | `ci`                    | Validation profile: `local`, `ci`, or `publish`. Higher profiles escalate advisory checks (e.g. missing lockfile) to errors. |
| `version`       | `latest`                | Version of `@introspection-ai/pi-recipes` to run. `latest` always uses the newest published checker; pin an exact version for reproducible CI. |
| `node-version`  | `24`                    | Node.js version used to run the checker.                                    |
| `upload-report` | `true`                  | Upload the JSON diagnostics report as a build artifact (`recipe-check-report`), even on failure. |

## Report artifact

When `upload-report` is `true`, the action writes the machine-readable report
(`recipes check … --json`) to `recipe-check-report.json` and uploads it as the
`recipe-check-report` artifact — available on both passing and failing runs for
inspection or downstream tooling.

## Versioning

Pin to the major tag for automatic non-breaking updates:

```yaml
uses: introspection-org/pi-recipes-action@v1        # recommended: latest v1.x
uses: introspection-org/pi-recipes-action@v1.2.3    # exact release
uses: introspection-org/pi-recipes-action@<sha>     # fully locked
```

The `v1` tag is a moving pointer maintained at the newest `v1.x` release.
Note that pinning the **action** (`@v1`) is independent of pinning the
**checker** (`version:` input): `@v1` keeps the action stable while `version`
controls how fresh the validation rules are.

## Run the same check locally

CI and local validation share one command. In a recipe repo:

```bash
npm install         # activates the .githooks pre-commit hook via `prepare`
npm run check       # recipes check . --profile ci

# or with no install:
npx -y -p @introspection-ai/pi-recipes recipes check . --profile ci
```

Recipe repos wire `recipes check` into a `.githooks/pre-commit` hook so the same
validation runs before every commit. This action is the CI backstop that makes
the check non-optional for every contributor.

## License

Apache-2.0
