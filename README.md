# 🎮 AB Control Hub

<div align="center">

**The Ultimate Web-Based Calibration & Testing Tool for PlayStation Controllers**

[Live Demo](https://ab-control-hub.site/) | [Report Bug](https://github.com/a7medmody1961/ab-control-hub/issues) | [Request Feature](https://github.com/a7medmody1961/ab-control-hub/issues)

</div>

## 📖 Overview

**AB Control Hub** is a powerful, secure, and open-source web application designed to diagnose, test, and calibrate Sony PlayStation controllers (**DualShock 4**, **DualSense**, and **DualSense Edge**).

Built with modern web technologies and the **WebHID API**, it runs entirely in your browser. It allows users to fix analog stick drift, finetune controller settings, and test hardware components without installing any third-party software or drivers.

> **Developed with ❤️ by Ahmed Badawy.**

## ✨ Key Features

### 🔌 Seamless Connectivity
* **WebHID Integration:** Connect directly via USB or Bluetooth (Chrome/Edge/Opera).
* **No Drivers Needed:** Plug and play experience.

### 🕹️ Advanced Calibration (Drift Fix)
* **Center Calibration:** Re-center analog sticks to eliminate drift.
* **Range Calibration:** Correct circularity errors and outer deadzones.
* **Finetuning (DS5/Edge):** Advanced, permanent calibration stored directly in the controller's internal memory (NVS).

### 🔍 Hardware Diagnostics & Testing
* **Visual Feedback:** Real-time visualization of analog sticks (Normal, 10x Zoom, Circularity) and button inputs.
* **Touchpad:** Visualizer for touch tracking.
* **Output Testing:**
    * **Haptics:** Test Vibration motors (Heavy/Light).
    * **Audio:** Test Controller Speaker & Microphone (DS4/DS5).
    * **LED:** Control Lightbar colors (Red, Green, Blue, Off).
    * **Adaptive Triggers (DS5):** Test resistance modes.

### ℹ️ Device Insights
* **Detailed Info:** Reads Battery Level, Firmware Version, and Serial Number.
* **Hardware Detection:** Detects Controller Color and Board Model (Experimental).

### 🛡️ Security & Privacy
* **Local Processing:** All data is processed locally in your browser. No inputs are recorded or uploaded.
* **Secure Context:** Implements strict Content Security Policy (CSP) for maximum user safety.

### 📱 Modern Experience
* **PWA Support:** Installable as a native app on Desktop and Android. **Works 100% Offline** after first load.
* **Multi-Language:** Fully localized interface in **English** and **Arabic (العربية)**.
* **Responsive:** Optimized for Desktop and Mobile screens.

## 🎮 Supported Controllers

| Controller | Button Test | Calibration | Finetuning (NVS) | Adaptive Triggers | Audio Test |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Sony DualShock 4 (V1/V2)** | ✅ | ✅ | ❌ | N/A | ✅ |
| **Sony DualSense** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Sony DualSense Edge** | ✅ | ✅ | ✅ | ✅ | ✅ |

## 🛠️ Built With

* **Core:** HTML5, JavaScript (ES6 Modules)
* **Styling:** Bootstrap 5, Custom CSS (Neon/HUD Theme)
* **APIs:** WebHID API, Gamepad API
* **Build Tools:** Gulp, Rollup

## 🚀 Getting Started (Local Development)

To run this project locally on your machine:

1.  **Clone the repo:**
    ```bash
    git clone [https://github.com/a7medmody1961/ab-control-hub.git](https://github.com/a7medmody1961/ab-control-hub.git)
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run Dev Server:**
    ```bash
    npm start
    ```
4.  **Build for Production:**
    ```bash
    npm run build
    ```

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📜 License

Distributed under the MIT License. See `LICENSE.txt` for more information.

## 👨‍💻 Author

**Ahmed Badawy**

* **Facebook:** [A7medMody196](https://www.facebook.com/A7medMody196)
* **WhatsApp:** +201110210770
* **Telegram:** [A7medmody196](https://t.me/A7medmody196)

---
<div align="center">
<sub>This tool is not affiliated with or endorsed by Sony Interactive Entertainment Inc. "PlayStation", "DualSense", and "DualShock" are registered trademarks of Sony Interactive Entertainment Inc.</sub>
</div>