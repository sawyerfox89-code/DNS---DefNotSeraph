# Contributing to XOTrix

Thank you for helping improve XOTrix. Contributions should be focused, verifiable, and consistent with the project’s browser-only architecture.

## Development setup

Clone the repository and serve it from the project root:

```bash
git clone https://github.com/vincenzo-afk/XOTrix.git
cd XOTrix
python3 -m http.server 8000
```

Open `http://localhost:8000` in a modern browser. The project has no package manager, build step, backend, or required environment variables.

## Validation

Before opening a pull request, run:

```bash
node --check app.js
test -f index.html && test -f style.css && test -f app.js && test -f LICENSE
```

Also manually test the affected behavior in a browser. For gameplay changes, check the relevant game modes, reset and undo behavior, replay navigation, bot turns, local persistence, responsive layout, and keyboard interaction.

## Change guidelines

Keep changes small and coherent. Preserve the three-file static structure unless a change has a clear architectural reason. Avoid adding dependencies when browser APIs or existing code are sufficient. Do not add claims to the README unless they are implemented and verifiable in the repository.

Use branches named `feature/short-description`, `fix/short-description`, or `docs/short-description`. Use clear, imperative commit messages; Conventional Commit-style prefixes such as `feat:`, `fix:`, `docs:`, and `chore:` are recommended.

## Pull requests

A pull request should describe the problem, summarize the implementation, list the validation performed, and call out any accessibility, compatibility, or breaking-change considerations. Include screenshots or a short recording when a visual change is central to the review.

Keep unrelated formatting or generated files out of the pull request. Do not include credentials, personal data, browser storage exports, or secrets.

## Review expectations

Pull requests are reviewed for correctness, clarity, browser compatibility, accessibility, and consistency with the existing visual language. Maintainers may request changes before merging.

## Questions

Use [GitHub Issues](https://github.com/vincenzo-afk/XOTrix/issues) for reproducible bugs and feature proposals. For security concerns, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
