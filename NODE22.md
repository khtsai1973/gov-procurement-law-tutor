# 在 Windows 使用 Node.js 22（與 Node 24 並存）

您目前的 `OpenJS.NodeJS.LTS` 已是 **v24**，與 Prisma 可能不相容。請安裝 **Node 22** 並只在這個專案使用它。

## 方式 A：fnm（建議，可並存多版本）

```powershell
winget install Schniz.fnm
```

### 第一次必須設定 PowerShell（否則 `fnm use` 會報錯）

在專案目錄執行一次：

```powershell
cd C:\Users\sport\gov-procurement-law-tutor
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup-fnm.ps1
```

或手動在目前視窗執行（立即生效）：

```powershell
fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
```

**關閉並重開 PowerShell** 後：

```powershell
fnm install 22
fnm use 22
node -v
```

應顯示 `v22.x.x`。再進入專案：

```powershell
cd C:\Users\sport\gov-procurement-law-tutor
powershell -NoProfile -ExecutionPolicy Bypass -File .\reinstall.ps1
npm run dev
```

之後每次開新終端機若要使用 22：

```powershell
fnm use 22
```

可在專案目錄建立 `.node-version`（內容 `22`），fnm 會自動切換。

## 方式 B：直接安裝 Node 22 MSI

1. 開啟 https://nodejs.org/dist/v22.15.1/
2. 下載 `node-v22.15.1-x64.msi` 並安裝
3. 確認 PATH 中 **Node 22 的資料夾在 Node 24 之前**，或暫時只保留 22：

```powershell
where.exe node
node -v
```

## 方式 C：winget 指定 22 版（若來源仍有舊版）

```powershell
winget show OpenJS.NodeJS.LTS --versions
winget install OpenJS.NodeJS.LTS --version 22.15.1
```

若列表沒有 22.x，請改用方式 A 或 B。
