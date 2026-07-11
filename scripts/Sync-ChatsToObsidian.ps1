# Sync-ChatsToObsidian.ps1
# Automates exporting Antigravity chat logs to an Obsidian Vault as clean Markdown files.
# Supports incremental syncing and updates a central index of all chats.

$ErrorActionPreference = "Stop"

# Configuration paths
$ConfigPath = Join-Path $PSScriptRoot "obsidian_sync_config.json"
$BrainDir = "C:\Users\cheru\.gemini\antigravity\brain"

# Emoji variables defined dynamically to prevent encoding corruption in script source
$UserEmoji = [char]::ConvertFromUtf32(0x1F464)   # 👤
$RobotEmoji = [char]::ConvertFromUtf32(0x1F916)  # 🤖

# Load or initialize configuration
if (Test-Path $ConfigPath) {
    try {
        $Config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
    } catch {
        Write-Host "Warning: Configuration file was corrupted. Re-initializing..." -ForegroundColor Yellow
        $Config = [PSCustomObject]@{
            VaultPath = ""
            SyncFolder = "Antigravity_Chats"
            SyncedChats = [Ordered]@{}
        }
    }
} else {
    $Config = [PSCustomObject]@{
        VaultPath = ""
        SyncFolder = "Antigravity_Chats"
        SyncedChats = [Ordered]@{}
    }
}

# Ensure SyncedChats is a PSCustomObject
if ($null -eq $Config.SyncedChats) {
    $Config.SyncedChats = [PSCustomObject]@{}
}

# Helper: Prompt user for Vault Path if not set
if ([string]::IsNullOrWhiteSpace($Config.VaultPath)) {
    Write-Host "--- Obsidian Sync Setup ---" -ForegroundColor Cyan
    Write-Host "Please enter the absolute path to your Obsidian Vault."
    Write-Host "Example: C:\Users\cheru\Documents\Obsidian\MyVault"
    Write-Host ""
    
    $TempPath = ""
    while ([string]::IsNullOrWhiteSpace($TempPath) -or -not (Test-Path $TempPath -PathType Container)) {
        $TempPath = Read-Host "Vault Path"
        $TempPath = $TempPath.Trim().Replace('"', '').Replace("'", "") # Clean quotes if dragged-and-dropped
        if (-not (Test-Path $TempPath -PathType Container)) {
            Write-Host "Error: Directory does not exist. Please enter a valid directory path." -ForegroundColor Red
        }
    }
    $Config.VaultPath = $TempPath
    # Save configuration immediately
    $Config | ConvertTo-Json -Depth 5 | Out-File $ConfigPath -Encoding UTF8
    Write-Host "Vault Path saved to config!" -ForegroundColor Green
}

$VaultPath = $Config.VaultPath
$SyncFolderPath = Join-Path $VaultPath $Config.SyncFolder

# Ensure sync folder exists in Vault
if (-not (Test-Path $SyncFolderPath)) {
    New-Item -ItemType Directory -Path $SyncFolderPath | Out-Null
    Write-Host "Created folder: $SyncFolderPath" -ForegroundColor Green
}

# Helper: Sanitize string to be safe for filenames
function Sanitize-FileName ($name) {
    $invalidChars = [IO.Path]::GetInvalidFileNameChars()
    $sanitized = $name
    foreach ($char in $invalidChars) {
        $sanitized = $sanitized.Replace($char, '_')
    }
    # Replace whitespace sequences with a single space
    $sanitized = $sanitized -replace '\s+', ' '
    # Limit length to avoid Windows MAX_PATH issues
    if ($sanitized.Length -gt 60) {
        $sanitized = $sanitized.Substring(0, 60)
    }
    return $sanitized.Trim().Trim('_')
}

Write-Host "Scanning conversations in $BrainDir..." -ForegroundColor Cyan

$Folders = Get-ChildItem -Path $BrainDir -Directory
$ChatList = @()

foreach ($Folder in $Folders) {
    $ConversationId = $Folder.Name
    if ($ConversationId -eq "tempmediaStorage" -or $ConversationId -eq "temp") {
        continue;
    }

    $LogPath = Join-Path $Folder.FullName ".system_generated\logs\transcript.jsonl"
    if (-not (Test-Path $LogPath)) {
        continue
    }

    $LogFile = Get-Item $LogPath
    $LastModified = $LogFile.LastWriteTime.ToString("yyyy-MM-ddTHH:mm:ssZ")

    # Read and parse JSONL transcript
    $Lines = Get-Content $LogPath
    $Messages = @()
    $FirstUserMessage = ""
    $ChatDate = $LogFile.CreationTime.ToString("yyyy-MM-dd")

    foreach ($Line in $Lines) {
        if ([string]::IsNullOrWhiteSpace($Line)) { continue }
        try {
            $Entry = $Line | ConvertFrom-Json
        } catch {
            continue
        }

        # Identify User Input
        if ($Entry.source -eq "USER_EXPLICIT" -and $Entry.type -eq "USER_INPUT") {
            $RawContent = $Entry.content
            $CleanContent = $RawContent
            if ($RawContent -match "(?s)<USER_REQUEST>(.*?)</USER_REQUEST>") {
                $CleanContent = $Matches[1].Trim()
            }
            if ([string]::IsNullOrWhiteSpace($FirstUserMessage)) {
                $FirstUserMessage = $CleanContent
                if ($Entry.created_at -match "^\d{4}-\d{2}-\d{2}") {
                    $ChatDate = $Entry.created_at.Substring(0, 10)
                }
            }
            $Messages += [PSCustomObject]@{
                Role = "User"
                Content = $CleanContent
                Time = $Entry.created_at
            }
        }
        # Identify Model Response
        elseif ($Entry.source -eq "MODEL" -and $Entry.type -eq "PLANNER_RESPONSE" -and -not [string]::IsNullOrWhiteSpace($Entry.content)) {
            $Messages += [PSCustomObject]@{
                Role = "Antigravity"
                Content = $Entry.content
                Time = $Entry.created_at
            }
        }
    }

    if ($Messages.Count -eq 0) {
        continue
    }

    # Generate title
    $TitleText = ""
    if (-not [string]::IsNullOrWhiteSpace($FirstUserMessage)) {
        $FirstLine = ($FirstUserMessage -split "`n")[0].Trim()
        $FirstLine = $FirstLine -replace '<[^>]*>', '' -replace '[#*`\[\]]', ''
        if ($FirstLine.Length -gt 50) {
            $TitleText = $FirstLine.Substring(0, 47) + "..."
        } else {
            $TitleText = $FirstLine
        }
    }
    if ([string]::IsNullOrWhiteSpace($TitleText)) {
        $TitleText = "Chat Session"
    }

    # Classify categories based on title and first user request (using word boundaries to prevent false positives)
    $Categories = @()
    $TextToScan = "$TitleText `n $FirstUserMessage".ToLower()

    if ($TextToScan -match '\b(obsidian|vault|sync|markdown)\b') { $Categories += "Obsidian Sync" }
    if ($TextToScan -match '\b(supabase|firestore|firebase|database|db|migrate|migration|sql)\b') { $Categories += "Database & Migration" }
    if ($TextToScan -match '\b(kds|kitchen)\b') { $Categories += "Kitchen Display System (KDS)" }
    if ($TextToScan -match '\b(delivery|delivry|rider|partner)\b') { $Categories += "Delivery System" }
    if ($TextToScan -match '\b(menu|cart|profile|customisation|customization|page|screen|slide|ui)\b') { $Categories += "Menu & UI Customization" }
    if ($TextToScan -match '\b(scanner|payment|zepto|qr|scan)\b') { $Categories += "Payment & QR Integration" }
    if ($TextToScan -match '\b(chatbot|bot|chat-bot)\b') { $Categories += "Chatbot Integration" }
    if ($TextToScan -match '\b(loop|loops|batch|join|optimize|optimization|refactor|performance|perf)\b') { $Categories += "Code Optimization" }

    if ($Categories.Count -eq 0) {
        $Categories += "General / Other"
    }

    $SanitizedTitle = Sanitize-FileName ($TitleText -replace ' ', '_')
    $FileName = "${ChatDate}_${SanitizedTitle}_${ConversationId}.md"

    $ChatList += [PSCustomObject]@{
        Id = $ConversationId
        Title = $TitleText
        Date = $ChatDate
        FileName = $FileName
        FilePath = Join-Path $SyncFolderPath $FileName
        Messages = $Messages
        Categories = $Categories
        LastModified = $LastModified
    }
}

$SyncedCount = 0
$SkipCount = 0

foreach ($Chat in $ChatList) {
    $ChatId = $Chat.Id
    $ChatTitle = $Chat.Title
    $ChatDateVal = $Chat.Date
    $ChatFilePath = $Chat.FilePath
    $ChatLastModified = $Chat.LastModified

    # Check last sync timestamp for this conversation
    $LastSync = $null
    if ($Config.SyncedChats.PSObject.Properties[$ChatId]) {
        $LastSync = $Config.SyncedChats.$ChatId
    }

    # Find related chats sharing at least one category (except "General / Other" to keep links meaningful)
    $RelatedChats = @()
    $NonGeneralCategories = $Chat.Categories | Where-Object { $_ -ne "General / Other" }
    if ($NonGeneralCategories.Count -gt 0) {
        foreach ($OtherChat in $ChatList) {
            if ($OtherChat.Id -eq $ChatId) { continue }
            $HasSharedCategory = $false
            foreach ($Cat in $NonGeneralCategories) {
                if ($OtherChat.Categories -contains $Cat) {
                    $HasSharedCategory = $true
                    break
                }
            }
            if ($HasSharedCategory) {
                $RelatedChats += $OtherChat
            }
        }
    }

    # Write Markdown note
    $MdContent = @()
    $MdContent += "---"
    $MdContent += "title: `"$ChatTitle`""
    $MdContent += "date: $ChatDateVal"
    $MdContent += "conversation_id: $ChatId"
    $MdContent += "tags:"
    $MdContent += "  - antigravity-chats"
    foreach ($Cat in $Chat.Categories) {
        $SanitizedCat = ($Cat -replace '\s+','-').ToLower()
        $MdContent += "  - $SanitizedCat"
    }
    $MdContent += "---"
    $MdContent += ""
    $MdContent += "# $ChatTitle"
    $MdContent += ""
    $MdContent += "> [!NOTE]"
    $MdContent += "> **Sync Date:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $MdContent += '> **Conversation ID:** `' + $ChatId + '`'
    $TopicsStr = $Chat.Categories -join ', '
    $MdContent += "> **Topics:** $TopicsStr"
    $MdContent += ""

    foreach ($Msg in $Chat.Messages) {
        $FormattedTime = ""
        if ($Msg.Time -match "T(\d{2}:\d{2}:\d{2})") {
            $TimeVal = $Matches[1]
            $FormattedTime = " *($TimeVal)*"
        }

        if ($Msg.Role -eq "User") {
            $MdContent += "---"
            $MdContent += "### $UserEmoji User$FormattedTime"
            $MdContent += ""
            $MdContent += $Msg.Content
            $MdContent += ""
        } else {
            $MdContent += "### $RobotEmoji Antigravity$FormattedTime"
            $MdContent += ""
            $MdContent += $Msg.Content
            $MdContent += ""
        }
    }

    # Add Related Chats Section
    if ($RelatedChats.Count -gt 0) {
        $MdContent += "---"
        $MdContent += "## Related Chats (Similar Topics)"
        $MdContent += ""
        foreach ($Rel in ($RelatedChats | Sort-Object Date -Descending)) {
            $SharedCats = @()
            foreach ($Cat in $Chat.Categories) {
                if ($Rel.Categories -contains $Cat) {
                    $SharedCats += $Cat
                }
            }
            $RelFileName = $Rel.FileName
            $RelTitle = $Rel.Title
            $RelDate = $Rel.Date
            $SharedCatsStr = $SharedCats -join ', '
            $MdContent += "- [[Antigravity_Chats/$RelFileName|$RelTitle]] *($RelDate | $SharedCatsStr)*"
        }
        $MdContent += ""
    }

    $MdContent -join "`n" | Out-File $ChatFilePath -Encoding UTF8
    
    # Save sync status
    if (-not $Config.SyncedChats.PSObject.Properties[$ChatId]) {
        $Config.SyncedChats | Add-Member -MemberType NoteProperty -Name $ChatId -Value $ChatLastModified -Force
    } else {
        $Config.SyncedChats.$ChatId = $ChatLastModified
    }
    
    $SyncedCount++
}

# Generate central index: Antigravity_Index.md grouped by similar topics
if ($ChatList.Count -gt 0) {
    Write-Host "Updating index file grouped by topics..." -ForegroundColor Cyan
    
    $IndexContent = @()
    $IndexContent += "# Antigravity Chat History"
    $IndexContent += ""
    $IndexContent += "A central index of all synced Antigravity conversations, organized by topic."
    $IndexContent += ""

    # Get unique categories across all chats
    $AllCategories = @()
    foreach ($Chat in $ChatList) {
        foreach ($Cat in $Chat.Categories) {
            if ($AllCategories -notcontains $Cat) {
                $AllCategories += $Cat
            }
        }
    }
    # Sort categories alphabetically
    $AllCategories = $AllCategories | Sort-Object

    foreach ($Cat in $AllCategories) {
        $IndexContent += "## $Cat"
        $IndexContent += ""
        $IndexContent += "| Date | Topic / Chat Title |"
        $IndexContent += "| :--- | :--- |"
        
        $CatChats = $ChatList | Where-Object { $_.Categories -contains $Cat } | Sort-Object Date -Descending
        foreach ($Entry in $CatChats) {
            $EntryFileName = $Entry.FileName
            $EntryTitle = $Entry.Title
            $EntryDate = $Entry.Date
            $Link = "[[Antigravity_Chats/$EntryFileName|$EntryTitle]]"
            $IndexContent += "| $EntryDate | $Link |"
        }
        $IndexContent += ""
    }

    $IndexPath = Join-Path $VaultPath "Antigravity_Index.md"
    $IndexContent -join "`n" | Out-File $IndexPath -Encoding UTF8
    Write-Host "Updated Index at: $IndexPath" -ForegroundColor Green
}

# Save updated config
$Config | ConvertTo-Json -Depth 5 | Out-File $ConfigPath -Encoding UTF8

Write-Host ""
Write-Host "--- Sync Completed ---" -ForegroundColor Green
Write-Host "Synced: $SyncedCount chats" -ForegroundColor Green
Write-Host "Skipped (already up-to-date): $SkipCount chats" -ForegroundColor Gray
Write-Host "Obsidian Vault folder: $SyncFolderPath" -ForegroundColor Gray
Write-Host ""
