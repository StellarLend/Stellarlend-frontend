# Dependency Vulnerability Remediation Flow

Our pipeline validates dependencies against known issues using `pnpm audit` and `osv-scanner`. If a build fails due to an advisory:

1. **Locate the Failure**: Review the GitHub Actions console log to find the offending package name and vulnerability ID (CVE/GHSA).
2. **Attempt Remediation**: Run `pnpm update <package-name> --latest` to pull a patched version.
3. **Apply Exception Waiver**: If a fix is unavailable and the risk is analyzed as non-exploitable, document it inside `.security/waivers.yml` and add the corresponding ID to `.security/osv-config.toml`.
