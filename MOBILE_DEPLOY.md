# 手機使用部署

這個版本已經補上 PWA 設定和後端健康檢查。要做到「手機自己用、不用一直開電腦」，核心是把 `C:\Users\Owner\Desktop\1\02` 這個資料夾部署到支援 Node.js 的雲端主機，例如 Render、Railway、Fly.io 或自己的 VPS。

## 最簡流程

1. 把 `02` 資料夾上傳到 GitHub 私有倉庫。
2. 在 Render 建立 Web Service，指向這個倉庫。
3. 設定：
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`
4. 部署完成後，用手機 Safari/Chrome 打開 Render 給你的 HTTPS 網址。
5. 允許定位，然後從手機相簿上傳接柯打截圖。
6. iPhone 可用 Safari 的「加入主畫面」，Android 可用 Chrome 的「安裝應用程式」或「加入主畫面」。

## 注意

- 手機定位、PWA 安裝和相機/相簿上傳都建議使用 HTTPS。
- 如果只在家裡用 `http://電腦IP:8788`，手機可以連，但電腦仍然必須開著。
- 部署到雲端後，截圖識別仍在手機瀏覽器中執行；後端主要負責地名資料、地圖/地址查詢、OCR 資源和靜態網站。
