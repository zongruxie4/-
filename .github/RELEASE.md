# Creating a Release for Nanobrowser

This guide explains how to create a new release for Nanobrowser with automated asset building.

## Automated Release Process

When you create a new release on GitHub, our GitHub Actions workflow will automatically:

1. Build source code packages (zip and tar.gz) respecting .gitignore
2. Build the Chrome extension package (nanobrowser.zip)
3. Attach all three assets to your GitHub release

## Steps to Create a Release

1. **Navigate to your repository**
   - Go to `https://github.com/YOUR_USERNAME/nanobrowser`

2. **Access the Releases section**
   - Click on "Releases" in the right sidebar

3. **Create a new release**
   - Click the "Draft a new release" button

4. **Set up your release**
   - **Choose a tag**: Create a new tag following semantic versioning (e.g., v1.0.0)
   - **Release title**: Give your release a descriptive name
   - **Description**: Write detailed release notes explaining what's new, fixed, or changed
   - **DO NOT** manually upload assets - they will be built and attached automatically

5. **Publish the release**
   - Click "Publish release"

6. **Wait for the workflow to complete**
   - The GitHub Actions workflow will automatically build and attach:
     - nanobrowser-source.zip
     - nanobrowser-source.tar.gz
     - nanobrowser.zip (Chrome extension package)

## Best Practices for Releases

1. **Use Semantic Versioning** (MAJOR.MINOR.PATCH):
   - MAJOR: incompatible API changes
   - MINOR: add functionality in a backward-compatible manner
   - PATCH: backward-compatible bug fixes

2. **Write comprehensive release notes**:
   - List new features
   - Document bug fixes
   - Mention any breaking changes
   - Include upgrade instructions if needed

3. **Verify the workflow completed successfully**:
   - Check the "Actions" tab to ensure the workflow ran without errors
   - Verify all three assets are attached to your release 