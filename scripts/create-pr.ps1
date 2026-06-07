# Enable GUI components
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# 1. Get branch info
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$defaultTitle = (git log -1 --pretty=%B).Split([char]10)[0].Trim()

# 2. Get GitHub info from git remotes
$remoteUrl = (git remote get-url fork 2>$null)
if (-not $remoteUrl) {
    $remoteUrl = (git remote get-url origin 2>$null)
}

if (-not $remoteUrl) {
    [System.Windows.Forms.MessageBox]::Show("Error: No git remote found.", "StellarLend PR Creator", "OK", "Error")
    exit 1
}

# Parse token and repo info
$token = ""
$userLogin = "dominiccreates"
$repoOwner = "StellarLend"
$repoName = "Stellarlend-frontend"

if ($remoteUrl -match 'https://([^@]+)@github\.com/([^/]+)/([^.]+)\.git') {
    $token = $Matches[1]
    $userLogin = $Matches[2]
    $repoName = $Matches[3]
}

if (-not $token) {
    [System.Windows.Forms.MessageBox]::Show("Error: GitHub Personal Access Token not found in remote URL.", "StellarLend PR Creator", "OK", "Error")
    exit 1
}

# 3. Build UI Form
$form = New-Object System.Windows.Forms.Form
$form.Text = "StellarLend - Create Pull Request"
$form.Size = New-Object System.Drawing.Size(550, 480)
$form.StartPosition = "CenterScreen"
$form.BackColor = [System.Drawing.Color]::FromArgb(11, 15, 25) # Obsidian dark
$form.ForeColor = [System.Drawing.Color]::FromArgb(243, 244, 246)
$form.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
$form.MaximizeBox = $false
$form.MinimizeBox = $false

# Title Label
$titleLabel = New-Object System.Windows.Forms.Label
$titleLabel.Text = "PULL REQUEST TITLE"
$titleLabel.Location = New-Object System.Drawing.Point(30, 20)
$titleLabel.Size = New-Object System.Drawing.Size(490, 20)
$titleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$titleLabel.ForeColor = [System.Drawing.Color]::FromArgb(165, 180, 252) # Indigo light
$form.Controls.Add($titleLabel)

# Title Box
$titleBox = New-Object System.Windows.Forms.TextBox
$titleBox.Text = $defaultTitle
$titleBox.Location = New-Object System.Drawing.Point(30, 45)
$titleBox.Size = New-Object System.Drawing.Size(470, 30)
$titleBox.BackColor = [System.Drawing.Color]::FromArgb(31, 41, 55)
$titleBox.ForeColor = [System.Drawing.Color]::White
$titleBox.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
$form.Controls.Add($titleBox)

# Branch Info Label
$branchLabel = New-Object System.Windows.Forms.Label
$branchLabel.Text = "Branch: " + $branch + "   |   Target: main   |   Fork: " + $userLogin + "/" + $repoName
$branchLabel.Location = New-Object System.Drawing.Point(30, 85)
$branchLabel.Size = New-Object System.Drawing.Size(470, 20)
$branchLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Italic)
$branchLabel.ForeColor = [System.Drawing.Color]::FromArgb(156, 163, 175)
$form.Controls.Add($branchLabel)

# Description Label
$descLabel = New-Object System.Windows.Forms.Label
$descLabel.Text = "PULL REQUEST DESCRIPTION (MANUAL INPUT)"
$descLabel.Location = New-Object System.Drawing.Point(30, 120)
$descLabel.Size = New-Object System.Drawing.Size(490, 20)
$descLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$descLabel.ForeColor = [System.Drawing.Color]::FromArgb(165, 180, 252)
$form.Controls.Add($descLabel)

# Description Box
$descBox = New-Object System.Windows.Forms.TextBox
$descBox.Multiline = $true
$descBox.ScrollBars = [System.Windows.Forms.ScrollBars]::Vertical
$descBox.Location = New-Object System.Drawing.Point(30, 145)
$descBox.Size = New-Object System.Drawing.Size(470, 180)
$descBox.BackColor = [System.Drawing.Color]::FromArgb(31, 41, 55)
$descBox.ForeColor = [System.Drawing.Color]::White
$descBox.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
$descBox.Text = "Enforces authentication on the dashboard and account routes, redirecting unauthenticated users to the sign-in page, and preventing logged-in users from accessing auth pages."
$form.Controls.Add($descBox)

# Action Button
$btn = New-Object System.Windows.Forms.Button
$btn.Text = "Push & Create Pull Request"
$btn.Location = New-Object System.Drawing.Point(30, 350)
$btn.Size = New-Object System.Drawing.Size(470, 45)
$btn.BackColor = [System.Drawing.Color]::FromArgb(79, 70, 229) # Rich Indigo
$btn.ForeColor = [System.Drawing.Color]::White
$btn.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btn.FlatAppearance.BorderSize = 0
$btn.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$btn.Cursor = [System.Windows.Forms.Cursors]::Hand

$btn.Add_Click({
    $btn.Enabled = $false
    $btn.Text = "Pushing to GitHub & Opening PR..."
    $form.Cursor = [System.Windows.Forms.Cursors]::Wait
    
    # Run the push and creation
    try {
        # 1. Push
        git push -u fork $branch
        
        # 2. Create PR
        $headBranch = $userLogin + ":" + $branch
        $body = @{
            title = $titleBox.Text
            body = $descBox.Text
            head = $headBranch
            base = "main"
        } | ConvertTo-Json
        
        $headers = @{
            "Authorization" = "Bearer " + $token
            "Accept" = "application/vnd.github+json"
            "X-GitHub-Api-Version" = "2022-11-28"
        }
        
        $response = Invoke-RestMethod -Uri ("https://api.github.com/repos/" + $repoOwner + "/" + $repoName + "/pulls") -Method Post -Headers $headers -Body $body -ContentType "application/json"
        
        $prUrl = $response.html_url
        
        # Open in default browser
        Start-Process $prUrl
        
        [System.Windows.Forms.MessageBox]::Show("Pull Request created successfully!`n`nOpened in your browser:`n" + $prUrl, "Success", "OK", "Information")
        $form.Close()
    }
    catch {
        [System.Windows.Forms.MessageBox]::Show("Error creating Pull Request: " + $_.Exception.Message, "Error", "OK", "Error")
        $btn.Enabled = $true
        $btn.Text = "Push & Create Pull Request"
        $form.Cursor = [System.Windows.Forms.Cursors]::Default
    }
})

$form.Controls.Add($btn)

# Show the Form
$form.ShowDialog() | Out-Null
