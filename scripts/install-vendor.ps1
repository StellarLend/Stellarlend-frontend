Write-Host "Adding vendor path to NODE_PATH"
$vendorPath = Resolve-Path "../vendor"
# Prepend to existing NODE_PATH if set
if ($env:NODE_PATH) {
  $env:NODE_PATH = "$vendorPath;$env:NODE_PATH"
} else {
  $env:NODE_PATH = "$vendorPath"
}
Write-Host "NODE_PATH set to $env:NODE_PATH"
