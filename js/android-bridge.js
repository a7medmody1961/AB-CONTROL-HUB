/**
 * Android Bridge
 * Handles communication between the Web App and the Android Wrapper (Kotlin/Java)
 */

class AndroidBridge {
    constructor() {
        this.isAndroid = typeof window.AndroidBridge !== 'undefined';
        this.pendingFeatureReports = new Map();
        
        // ربط الدوال التي يستدعيها الأندرويد
        window.onAndroidInputReport = this.handleInputReport.bind(this);
        window.onAndroidDeviceConnected = this.handleDeviceConnected.bind(this);
        window.onAndroidFeatureReport = this.handleFeatureReportResponse.bind(this);
        window.onAndroidDeviceDisconnected = this.handleDeviceDisconnected.bind(this);
        
        this.onInputReportCallback = null;
        this.onDeviceConnectedCallback = null;
    }

    requestPermission(vendorId, productId) {
        if (this.isAndroid) {
            window.AndroidBridge.requestPermission(vendorId || 0, productId || 0);
        }
    }

    sendOutputReport(data) {
        if (this.isAndroid) {
            const base64 = this.arrayBufferToBase64(data);
            window.AndroidBridge.sendOutputReport(base64);
        }
    }

    sendFeatureReport(reportId, data) {
         if (this.isAndroid) {
            const base64 = this.arrayBufferToBase64(data);
            window.AndroidBridge.sendFeatureReport(reportId, base64);
        }
    }

    requestFeatureReport(reportId, length) {
        if (!this.isAndroid) return Promise.reject("Not running on Android");
        return new Promise((resolve, reject) => {
            this.pendingFeatureReports.set(reportId, { resolve, reject });
            window.AndroidBridge.getFeatureReport(reportId, length);
            setTimeout(() => {
                if (this.pendingFeatureReports.has(reportId)) {
                    this.pendingFeatureReports.delete(reportId);
                    // لا نرفض الوعد لتجنب توقف التطبيق، بل نعيد مصفوفة فارغة
                    resolve(new DataView(new ArrayBuffer(0))); 
                }
            }, 3000); 
        });
    }

    handleInputReport(base64Data) {
        if (this.onInputReportCallback) {
            try {
                const rawBytes = this.base64ToArrayBuffer(base64Data); // Uint8Array
                
                if (rawBytes.length > 0) {
                    // في الأندرويد نرسل المصفوفة كاملة لأن الـ Offsets في ملفات الـ controller مصممة لذلك
                    const reportId = rawBytes[0];
                    const dataView = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
                    
                    this.onInputReportCallback({ reportId: reportId, data: dataView });
                }
            } catch (e) {
                console.warn("Error parsing input report:", e);
            }
        }
    }

    handleDeviceConnected(vid, pid) {
        console.log(`Android Bridge: Device Connected ${vid.toString(16)}:${pid.toString(16)}`);
        if (this.onDeviceConnectedCallback) {
            this.onDeviceConnectedCallback({ vendorId: vid, productId: pid });
        }
    }

    handleDeviceDisconnected() {
        console.log("Android Bridge: Device Disconnected");
        // هنا ننادي على دالة الـ disconnect اللي مبعوتة من core.js
        if (window.androidDisconnectHandler) {
            window.androidDisconnectHandler();
        }
    }

    handleFeatureReportResponse(reportId, base64Data) {
        if (this.pendingFeatureReports.has(reportId)) {
            const { resolve } = this.pendingFeatureReports.get(reportId);
            try {
                if (base64Data) {
                    const data = this.base64ToArrayBuffer(base64Data);
                    resolve(new DataView(data.buffer));
                } else {
                    resolve(new DataView(new ArrayBuffer(0)));
                }
            } catch(e) {
                 resolve(new DataView(new ArrayBuffer(0)));
            }
            this.pendingFeatureReports.delete(reportId);
        }
    }

    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    base64ToArrayBuffer(base64) {
        const binary_string = window.atob(base64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes;
    }

    setInputReportListener(callback) {
        this.onInputReportCallback = callback;
    }

    setDeviceConnectedListener(callback) {
        this.onDeviceConnectedCallback = callback;
    }
}

export const androidBridge = new AndroidBridge();

// ==========================================
// EXPORTS FOR core.js
// ==========================================

export function requestUsbPermission(vid, pid) {
    return androidBridge.requestPermission(vid, pid);
}

export function initAndroidBridge(callbacks) {
    if (callbacks.setAndroidFlag) {
        callbacks.setAndroidFlag(androidBridge.isAndroid);
    }

    // الربط لحل مشكلة الـ Disconnect التلقائي
    window.androidDisconnectHandler = callbacks.disconnect;

    androidBridge.setInputReportListener((report) => {
        const ctrl = callbacks.getController();
        
        if (ctrl && ctrl.device) {
             if (callbacks.handleInputReport) {
                 callbacks.handleInputReport(ctrl.device, report.reportId, report.data); 
            }
        }
    });
    
    androidBridge.setDeviceConnectedListener((deviceInfo) => {
        const fakeDevice = {
            opened: true,
            vendorId: deviceInfo.vendorId,
            productId: deviceInfo.productId,
            productName: "Android Controller",
            collections: [],
            oninputreport: null,
            open: async () => {},
            close: async () => {},
            sendReport: (id, data) => androidBridge.sendOutputReport(data),
            sendFeatureReport: (id, data) => androidBridge.sendFeatureReport(id, data),
            receiveFeatureReport: (id) => androidBridge.requestFeatureReport(id, 64)
        };
        
        if(callbacks.setupDeviceUI) {
            callbacks.setupDeviceUI(fakeDevice);
        }
    });
}