# firewall-node Release Process

## 1. Before the release

Ensure that all tests are passing on main branch and that the code is ready for release.

## 2. Create a GitHub release

Create a new release in the [GitHub UI](https://github.com/AikidoSec/firewall-node/releases/new).
Use the version number without the "v" prefix (e.g. "1.0.0") as the tag and release title.
Write a clean release description intended for users, summarizing the changes in this release and optional links to relevant docs.

## 3. Monitor release workflow

On creation of the release, a GitHub Actions workflow will be triggered to build and publish the package to npm.
Monitor [the workflow](https://github.com/AikidoSec/firewall-node/actions/workflows/build-and-release.yml) for any errors and ensure that the release is published successfully.
Sometimes tests may fail, restart them if they do and monitor until they pass.

## 4. After the release

Update the [Zen Demo Node.js](https://github.com/Aikido-demo-apps/zen-demo-nodejs) to use the new version and ensure that it works correctly with the new release (CJS & ESM instances).
Also update the [Aikido Docs](https://help.aikido.dev) if any documentation in the repository has changed.
