# Fix openrouter.ts - Remove legacy prompt definitions
$inputFile = "server\openrouter.ts"
$outputFile = "server\openrouter_fixed.ts"

# Read all lines
$lines = Get-Content $inputFile

# Find line numbers
$startRemove = -1
$endRemove = -1

for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^// LEGACY PROMPTS - TO BE REMOVED") {
        $startRemove = $i
    }
    if ($lines[$i] -match "^const clinicalAnalysisSchema = z\.object") {
        $endRemove = $i
        break
    }
}

Write-Host "Start remove: line $startRemove"
Write-Host "End remove: line $endRemove"

if ($startRemove -ge 0 -and $endRemove -gt $startRemove) {
    # Keep lines before startRemove and from endRemove onwards
    $outputLines = @()
    if ($startRemove -gt 0) {
        $outputLines += $lines[0..($startRemove-1)]
    }
    $outputLines += ""
    $outputLines += $lines[$endRemove..($lines.Count-1)]

    # Write to new file
    $outputLines | Out-File $outputFile -Encoding utf8

    Write-Host "Done! Created $outputFile"
    Write-Host "Lines removed: $($endRemove - $startRemove)"
} else {
    Write-Host "ERROR: Could not find markers"
}
