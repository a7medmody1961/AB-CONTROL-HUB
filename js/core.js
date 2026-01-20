'use strict';

import { sleep, float_to_str, dec2hex, dec2hex32, initAnalyticsApi, la, createCookie, readCookie } from './utils.js';
import { initControllerManager } from './controller-manager.js';
import ControllerFactory from './controllers/controller-factory.js';
import { lang_init, l } from './translations.js';
import { loadAllTemplates } from './template-loader.js';
import { CIRCULARITY_DATA_SIZE } from './stick-renderer.js';
import { ds5_finetune, isFinetuneVisible, finetune_handle_controller_input } from './modals/finetune-modal.js';
import { calibrate_stick_centers, auto_calibrate_stick_centers } from './modals/calib-center-modal.js';
import { calibrate_range } from './modals/calib-range-modal.js';

// New Modular Imports
import { initAndroidBridge, requestUsbPermission } from './android-bridge.js';
import * as UI from './ui-renderer.js';

// Application State - manages app-wide state and UI
const app = {
  // Button disable state management
  disable_btn: 0,
  last_disable_btn: 0,

  shownRangeCalibrationWarning: false,

  // Language and UI state
  lang_orig_text: {},
  lang_cur: {},
  lang_disabled: true,
  lang_cur_direction: "ltr",

  // Session tracking
  gj: 0,
  gu: 0,

  // Controller Info
  currentControllerInfo: [],
  
  // Android Bridge Flag
  isAndroid: false
};

const ll_data = new Array(CIRCULARITY_DATA_SIZE);
const rr_data = new Array(CIRCULARITY_DATA_SIZE);

let controller = null;

function gboot() {
  app.gu = crypto.randomUUID();

  // Initialize Android Bridge with callbacks to access Core functions
  initAndroidBridge({
      setAndroidFlag: (val) => { app.isAndroid = val; },
      getController: () => controller,
      handleInputReport: (device, reportId, dataView) => {
          // Wrapper to match previous logic
           const handler = device.oninputreport;
           if (handler) {
               handler({ 
                   data: new DataView(dataView.buffer), 
                   device: device, 
                   reportId: reportId 
               });
           }
      },
      setupDeviceUI: setupDeviceUI,
      resetConnectUI: resetConnectUI,
      disconnect: disconnect
  });

  async function initializeApp() {
    UI.initUiElements();

    window.addEventListener("error", (event) => {
      console.error(event.error?.stack || event.message);
      show_popup(event.error?.message || event.message);
    });

    window.addEventListener("unhandledrejection", async (event) => {
      console.error("Unhandled rejection:", event.reason?.stack || event.reason);
      close_all_modals();

      let errorMessage = "An unexpected error occurred";
      if (event.reason) {
        if (event.reason.message) {
          errorMessage = `<strong>Error:</strong> ${event.reason.message}`;
        } else if (typeof event.reason === 'string') {
          errorMessage = `<strong>Error:</strong> ${event.reason}`;
        }
        let allStackTraces = '';
        if (event.reason.stack) {
          const stackTrace = event.reason.stack.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
          allStackTraces += `<strong>Main Error Stack:</strong><br>${stackTrace}`;
        }
        if (allStackTraces) {
          errorMessage += `
            <br>
            <details style="margin-top: 0px;">
              <summary style="cursor: pointer; color: #666;">Details</summary>
              <div style="font-family: monospace; font-size: 0.85em; margin-top: 8px; padding: 8px; background-color: #f8f9fa; border-radius: 4px; overflow-x: auto;">
                ${allStackTraces}
              </div>
            </details>
          `;
        }
      }
      errorAlert(errorMessage);
      event.preventDefault();
    });

    await loadAllTemplates();

    initAnalyticsApi(app);
    lang_init(app, handleLanguageChange, show_welcome_modal);
    
    // Cookie consent check
    if (!readCookie('cookie_consent')) {
      setDisplay('cookie-consent', true);
    }

    // Modal exposure for global access
    window.acceptCookies = () => {
      createCookie('cookie_consent', 'true', 365);
      setDisplay('cookie-consent', false);
    };

    document.querySelectorAll("input[name='displayMode']").forEach(el => {
        el.addEventListener('change', on_stick_mode_change);
    });

    const edgeModalCheckbox = document.getElementById('edgeModalDontShowAgain');
    if (edgeModalCheckbox) {
        edgeModalCheckbox.addEventListener('change', function() {
            localStorage.setItem('edgeModalDontShowAgain', this.checked.toString());
        });
    }
    
    const colorPicker = document.getElementById('ledColorPicker');
    if (colorPicker) {
        colorPicker.addEventListener('input', function() {
            const hex = this.value;
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            
            if (controller && controller.currentController) {
                controller.currentController.setLightbarColor(r, g, b);
            }
        });
    }

    refresh_stick_pos();

    const defaultButtons = [
        {name: 'l2'}, {name: 'r2'}, 
        {name: 'up'}, {name: 'down'}, {name: 'left'}, {name: 'right'}, 
        {name: 'square'}, {name: 'cross'}, {name: 'circle'}, {name: 'triangle'}, 
        {name: 'l1'}, {name: 'r1'}, 
        {name: 'l3'}, {name: 'r3'},
        {name: 'share'}, {name: 'options'}, {name: 'ps'}, {name: 'touchpad'}
    ];
    UI.initialize_button_indicators(defaultButtons);

    const l2_progress = document.getElementById('l2-progress');
    const r2_progress = document.getElementById('r2-progress');
    if(l2_progress) l2_progress.style.height = '0%';
    if(r2_progress) r2_progress.style.height = '0%';
    
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }

  if (!("hid" in navigator) && !app.isAndroid) {
    setDisplay('missinghid', true);
    return;
  }

  // Initial SVG load
  UI.init_svg_controller('DS4');

  if (!app.isAndroid) {
      navigator.hid.addEventListener("disconnect", handleDisconnectedDevice);
  }
}

function setDisplay(id, show) {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? 'block' : 'none';
}

function toggleElement(id, show) {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? '' : 'none';
}

function resetConnectUI() {
    const btnConnect = document.getElementById("btnconnect-overlay");
    if (btnConnect) btnConnect.disabled = false;
}

window.test_vibration = (duration) => {
  if (controller && controller.isConnected()) {
    controller.setVibration({ heavyLeft: 180, lightRight: 180, duration });
  }
};

window.test_speaker = async () => {
  if (!controller || !controller.isConnected()) {
    warningAlert(l("Please connect a controller first"));
    return;
  }

  if (controller && controller.isConnected()) {
    try {
      if (controller.getModel().startsWith("DS5")) {
        await controller.setSpeakerTone(1000, () => {}, "speaker");
      } else if (controller.getModel() === "DS4") {
        await controller.setSpeakerTone("headphones");
      } else {
        infoAlert(l("Speaker test only supported on DualSense or DualShock 4 controllers"));
      }
    } catch (e) {
      alert(e.message);
    }
  }
};

window.test_mic = () => {
    if (!controller || !controller.isConnected()) {
      warningAlert(l("Please connect a controller first"));
      return;
    }

    if (controller && controller.isConnected()) {
        if (controller.getModel().startsWith("DS5") || controller.getModel() === "DS4") {
            infoAlert(l("Microphone test initiated - check your OS audio settings for input signal"));
        } else {
            infoAlert(l("Microphone test only supported on PlayStation controllers"));
        }
    }
};

async function connect() {
  app.gj = crypto.randomUUID();
  initAnalyticsApi(app); 

  controller = initControllerManager({ handleNvStatusUpdate });
  controller.setInputHandler(handleControllerInput);

  la("begin");
  reset_circularity_mode();
  clearAllAlerts();
  await sleep(200);

  const btnConnect = document.getElementById("btnconnect-overlay");
  
  if (btnConnect) btnConnect.disabled = true;
  await sleep(100);

  try {
    if (app.isAndroid) {
        requestUsbPermission();
    } else {
        const supportedModels = ControllerFactory.getSupportedModels();
        const requestParams = { filters: supportedModels };
        let devices = await navigator.hid.getDevices();
        if (devices.length == 0) {
          devices = await navigator.hid.requestDevice(requestParams);
        }
        if (devices.length == 0) {
          throw new Error("No device selected");
        }

        if (devices.length > 1) {
          infoAlert(l("Please connect only one controller at time."));
          throw new Error("Multiple devices connected");
        }

        const [device] = devices;
        if(device.opened) {
          console.log("Device already opened, closing it before re-opening.");
          await device.close();
          await sleep(500);
        }
        await device.open();

        la("connect", {"p": device.productId, "v": device.vendorId});
        device.oninputreport = continue_connection; 
        
        await setupDeviceUI(device);

        if (controller) {
            const isDS5 = controller.getModel().startsWith("DS5"); 
            const audioGroup = document.getElementById("audio-test-group");
            if (audioGroup) {
                audioGroup.style.display = isDS5 ? 'block' : 'none';
            }
            const triggerGroup = document.getElementById("trigger-test-group");
            if (triggerGroup) {
                triggerGroup.style.display = isDS5 ? 'block' : 'none';
            }
        }
    }

  } catch(error) {
    console.error("Connection failed", error);
    resetConnectUI();
    await disconnect();
  }
}

async function setupDeviceUI(device) {
  app.connectionTime = Date.now();
    if (!controller) {
         controller = initControllerManager({ handleNvStatusUpdate });
         controller.setInputHandler(handleControllerInput);
    }
    
    function applyDeviceUI({ showInfo, showFinetune, showInfoTab, showFourStepCalib, showQuickCalib }) {
      toggleElement("infoshowall", showInfo);
      toggleElement("ds5finetune", showFinetune);
      toggleElement("info-tab", showInfoTab);
      toggleElement("four-step-center-calib", showFourStepCalib);
      toggleElement("quick-center-calib", showQuickCalib);
    }

    let controllerInstance = null;
    let info = null;

    try {
      controllerInstance = ControllerFactory.createControllerInstance(device);
      controller.setControllerInstance(controllerInstance);

      info = await controllerInstance.getInfo();

      if (info && info.infoItems) {
          app.currentControllerInfo = info.infoItems;
      }

      if (controllerInstance.initializeCurrentOutputState) {
        await controllerInstance.initializeCurrentOutputState();
      }
    } catch (error) {
      const contextMessage = device 
        ? `${l("Connected invalid device")}: ${dec2hex(device.vendorId)}:${dec2hex(device.productId)}`
        : l("Failed to connect to device");
        throw new Error(contextMessage, { cause: error });
    }

    if(!info?.ok) {
      if(info) console.error(JSON.stringify(info, null, 2));
      throw new Error(`${l("Connected invalid device")}: ${l("Error")}  1`, { cause: info?.error });
    }

    const ui = ControllerFactory.getUIConfig(device.productId);
    applyDeviceUI(ui);

    console.log("Setting input report handler.");
    device.oninputreport = controller.getInputHandler();

    const deviceName = ControllerFactory.getDeviceName(device.productId);
    document.getElementById("devname").textContent = deviceName + " (" + dec2hex(device.vendorId) + ":" + dec2hex(device.productId) + ")";

    setDisplay("connection-overlay", false);
    const onlineHeader = document.getElementById("online-header");
    if(onlineHeader) onlineHeader.style.display = 'flex';
    
    const svgContainer = document.getElementById("controller-svg-container");
    if(svgContainer) svgContainer.classList.remove('disconnected-svg');

    setDisplay("mainmenu", true);
    toggleElement("resetBtn", true);

    const nvStatusEl = document.getElementById("d-nvstatus");
    if(nvStatusEl) nvStatusEl.textContent = l("Unknown");
    
    const triggerEl = document.querySelector('#controller-tab');
    if(triggerEl) bootstrap.Tab.getOrCreateInstance(triggerEl).show();

    const model = controllerInstance.getModel();

    await UI.init_svg_controller(model);

    UI.initialize_button_indicators(controller.getInputConfig().buttonMap);

    if (model == "DS5_Edge" && info?.pending_reboot) {
      infoAlert(l("A reboot is needed to continue using this DualSense Edge. Please disconnect and reconnect your controller."));
      await disconnect();
      return;
    }

    UI.render_info_to_dom(info.infoItems);

    if (info.nv) {
      UI.render_nvstatus_to_dom(info.nv);
      if (info.nv.locked === false) {
        await nvslock();
      }
    }

    if (typeof info.disable_bits === 'number' && info.disable_bits) {
      if (app.isAndroid) {
          console.log("Android: Ignoring Clone/Disable Flags");
          app.disable_btn = 0; 
      } else {
          app.disable_btn |= info.disable_bits;
      }
    }
    if(app.disable_btn != 0) update_disable_btn();

    if (model == "DS4" && info?.rare) {
      show_popup("Wow, this is a rare/weird controller! Please write me an email at ds4@the.al or contact me on Discord (the_al)");
    }

    if(model == "DS5_Edge") {
      show_edge_modal();
    }
    
    resetConnectUI();
}

async function continue_connection(event) {
    if (!controller || controller.isConnected()) return; 
}

async function disconnect() {
  la("disconnect");
  if(!controller?.isConnected()) {
    controller = null;
    resetConnectUI();
    return;
  }
  app.gj = 0;
  app.disable_btn = 0;
  update_disable_btn();

  await controller.disconnect();
  controller = null;
  close_all_modals();
  
  setDisplay("connection-overlay", true);
  const onlineHeader = document.getElementById("online-header");
  if(onlineHeader) onlineHeader.style.display = 'none';

  const svgContainer = document.getElementById("controller-svg-container");
  if(svgContainer) svgContainer.classList.add('disconnected-svg');
  
  resetConnectUI();
}

function disconnectSync() {
  disconnect().catch(error => {
    throw new Error("Failed to disconnect", { cause: error });
  });
}

async function handleDisconnectedDevice(e) {
  la("disconnected");
  console.log("Disconnected: " + e.device.productName)
  await disconnect();
}

async function refresh_nvstatus() {
  if (!controller.isConnected()) {
    return null;
  }

  return await controller.queryNvStatus();
}

window.showControllerInfo = function() {
    const listContainer = document.getElementById('modal-info-list');
    listContainer.innerHTML = ''; 

    // إضافة الترجمة للنص الافتراضي
    const devName = document.getElementById('devname').innerText.replace(/\(.*?\)/, '').trim() || l("Unknown Device");
    const devBat = document.getElementById('d-bat').innerText || "--";
    
    // استخدام l() لترجمة العناوين الثابتة
    UI.addToModalList(l("Device Name"), devName, "text-white");
    UI.addToModalList(l("Battery Level"), devBat, devBat.includes("%") ? "text-success" : "text-warning");

    if (app.currentControllerInfo && app.currentControllerInfo.length > 0) {
        app.currentControllerInfo.forEach(item => {
            if (item.key === 'Name' || item.key === 'Battery') return;

            let colorClass = "text-info";
            if (item.key.includes('Version')) colorClass = "text-warning"; 
            if (item.key.includes('MAC') || item.key.includes('ID')) colorClass = "text-white-50 small"; 

            // l(item.key) ترجمة مفاتيح البيانات القادمة من الدراع باستخدام
            UI.addToModalList(l(item.key), item.value, colorClass);
        });
    } else {
        // ترجمة حالة عدم وجود معلومات
        UI.addToModalList(l("Status"), l("No additional info available"), "text-muted");
    }

    const infoModal = new bootstrap.Modal(document.getElementById('controllerInfoModal'));
    infoModal.show();
}

function show_welcome_modal() {
  return;
}
 
function collectCircularityData(stickStates, leftData, rightData) {
  const { left, right  } = stickStates || {};
  const MAX_N = CIRCULARITY_DATA_SIZE;

  for(const [stick, data] of [[left, leftData], [right, rightData]]) {
    if (!stick) return;

    const { x, y } = stick;
    const distance = Math.sqrt(x * x + y * y);
    const angleIndex = (parseInt(Math.round(Math.atan2(y, x) * MAX_N / 2.0 / Math.PI)) + MAX_N) % MAX_N;
    const oldValue = data[angleIndex] ?? 0;
    data[angleIndex] = Math.max(oldValue, distance);
  }
}

function clear_circularity() {
  ll_data.fill(0);
  rr_data.fill(0);
}

function reset_circularity_mode() {
  clear_circularity();
  const normalMode = document.getElementById("normalMode");
  if(normalMode) normalMode.checked = true;
  refresh_stick_pos();
}

function refresh_stick_pos() {
    UI.refresh_stick_pos(controller, ll_data, rr_data);
}

function resetStickDiagrams() {
  clear_circularity();
  refresh_stick_pos();
}

function switchTo10xZoomMode() {
  const el = document.getElementById("centerZoomMode");
  if(el) el.checked = true;
  resetStickDiagrams();
}

function switchToRangeMode() {
  const el = document.getElementById("checkCircularityMode");
  if(el) el.checked = true;
  resetStickDiagrams();
}

const on_stick_mode_change = () => resetStickDiagrams();

const throttled_refresh_sticks = (() => {
  let delay = null;
  return function(changes) {
    if (!changes.sticks) return;
    if (delay) return;

    refresh_stick_pos();
    delay = setTimeout(() => {
      delay = null;
      refresh_stick_pos();
    }, 20);
  };
})();

const update_stick_graphics = (changes) => throttled_refresh_sticks(changes);

function get_current_main_tab() {
  const mainTabs = document.getElementById('mainTabs');
  const activeBtn = mainTabs?.querySelector('.nav-link.active');
  return activeBtn?.id || 'controller-tab';
}

function get_current_test_tab() {
  const testsList = document.getElementById('tests-list');
  const activeBtn = testsList?.querySelector('.list-group-item.active');
  return activeBtn?.id || 'haptic-test-tab';
}

function detectFailedRangeCalibration(changes) {
  return; 
}


// Callback function to handle UI updates after controller input processing
function handleControllerInput({ changes, inputConfig, touchPoints, batteryStatus }) {
  // Handle Touchpad Visualization
  if (touchPoints && touchPoints.length > 0) {
    touchPoints.forEach((point, index) => {
      const el = document.getElementById(`touch-point-${index}`);
      const visualizer = document.getElementById('touchpad-visualizer');
      if (el && visualizer) {
        if (point.active) {
          el.style.display = 'block';
          const xPercent = (point.x / 1919) * 100;
          const yPercent = (point.y / 941) * 100;
          el.style.left = `${xPercent}%`;
          el.style.top = `${yPercent}%`;
        } else {
          el.style.display = 'none';
        }
      }
    });
  }

  const { buttonMap } = inputConfig;

  const current_active_tab = get_current_main_tab();
  collectCircularityData(changes.sticks, ll_data, rr_data);

  switch (current_active_tab) {
    case 'controller-tab': // Main Home tab
    case 'calibration-tab': 
      if(isFinetuneVisible()) {
        finetune_handle_controller_input(changes);
      } else {
        update_stick_graphics(changes);
        UI.update_ds_button_svg(changes, buttonMap);
        UI.update_touchpad_circles(touchPoints);
        detectFailedRangeCalibration(changes);
      }
      break;

    case 'tests-tab':
      handle_test_input(changes);
      break;
  }

  UI.update_battery_status(batteryStatus);
}

function handle_test_input(/* changes */) {
  const current_test_tab = get_current_test_tab();

  switch (current_test_tab) {
    case 'haptic-test-tab':
      const l2 = controller.button_states.l2_analog || 0;
      const r2 = controller.button_states.r2_analog || 0;
      if (l2 || r2) {
      }
      break;
    default:
      console.log("Unknown test tab:", current_test_tab);
      break;
  }
}

function update_disable_btn() {
  const { disable_btn, last_disable_btn } = app;
  
  if (app.isAndroid) {
      document.querySelectorAll(".ds-btn").forEach(el => el.disabled = false);
      return;
  }

  if(disable_btn == last_disable_btn)
    return;

  if(disable_btn == 0) {
    document.querySelectorAll(".ds-btn").forEach(el => el.disabled = false);
    app.last_disable_btn = 0;
    return;
  }

  document.querySelectorAll(".ds-btn").forEach(el => el.disabled = true);

  if(disable_btn & 1 && !(last_disable_btn & 1)) {
    show_popup(l("The device appears to be a clone. All calibration functionality is disabled."));
  } else if(disable_btn & 2 && !(last_disable_btn & 2)) {
    show_popup(l("This DualSense controller has outdated firmware.") + "<br>" + l("Please update the firmware and try again."), true);
  }
  app.last_disable_btn = disable_btn;
}

async function handleLanguageChange() {
  if(!controller) return;

  const { infoItems } = await controller.getDeviceInfo();
  UI.render_info_to_dom(infoItems);
}

function handleNvStatusUpdate(nv) {
  UI.render_nvstatus_to_dom(nv);
}

async function flash_all_changes() {
  const isEdge = controller.getModel() == "DS5_Edge";
  const progressCallback = isEdge ? UI.set_edge_progress : null;
  const modalEl = document.getElementById('edgeProgressModal');
  const edgeProgressModal = isEdge && modalEl ? bootstrap.Modal.getOrCreateInstance(modalEl) : null;
  
  if(edgeProgressModal) edgeProgressModal.show();

  const result = await controller.flash(progressCallback);
  if(edgeProgressModal) edgeProgressModal.hide();

  if (result?.success) {
    if(result.isHtml) {
      show_popup(result.message, result.isHtml);
    } else {
      successAlert(result.message);
    }
  }
}

async function reboot_controller() {
  await controller.reset();
}

async function nvsunlock() {
  await controller.nvsUnlock();
}

async function nvslock() {
  return await controller.nvsLock();
}

function close_all_modals() {
  document.querySelectorAll('.modal.show').forEach(el => {
      const modal = bootstrap.Modal.getInstance(el);
      if (modal) modal.hide();
  });
}

function show_popup(text, is_html = false) {
  const el = document.getElementById("popupBody");
  if (!el) return;
  
  if(is_html) {
    el.innerHTML = text;
  } else {
    el.textContent = text;
  }
  const modalEl = document.getElementById('popupModal');
  if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function show_faq_modal() {
  la("faq_modal");
  const modalEl = document.getElementById('faqModal');
  if(modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function show_donate_modal() {
  la("donate_modal");
  const modalEl = document.getElementById('donateModal');
  if(modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function show_edge_modal() {
  const dontShowAgain = localStorage.getItem('edgeModalDontShowAgain');
  if (dontShowAgain === 'true') {
    return;
  }

  la("edge_modal");
  const modalEl = document.getElementById('edgeModal');
  if(modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function show_info_tab() {
  la("info_modal");
  const el = document.getElementById('info-tab');
  if(el) bootstrap.Tab.getOrCreateInstance(el).show();
}

function discord_popup() {
  la("discord_popup");
  show_popup(l("My handle on discord is: the_al"));
}

function edge_color_info() {
  la("cm_info");
  const text = l("Color detection thanks to") + ' romek77 from Poland.';
  show_popup(text, true);
}

function board_model_info() {
  la("bm_info");
  const l1 = l("This feature is experimental.");
  const l2 = l("Please let me know if the board model of your controller is not detected correctly.");
  const l3 = l("Board model detection thanks to") + ' <a href="https://battlebeavercustoms.com/">Battle Beaver Customs</a>.';
  show_popup(l3 + "<br><br>" + l1 + " " + l2, true);
}

// Alert Management Functions
let alertCounter = 0;

function pushAlert(message, type = 'info', duration = 0, dismissible = true) {
  const alertContainer = document.getElementById('alert-container');
  if (!alertContainer) {
  console.error('Alert container not found');
  return null;
  }

  const alertId = `alert-${++alertCounter}`;
  const alertDiv = document.createElement('div');
  alertDiv.id = alertId;
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.setAttribute('role', 'alert');
  alertDiv.innerHTML = `
    ${message}
    ${dismissible ? '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>' : ''}
  `;

  alertContainer.appendChild(alertDiv);

  if (duration > 0) {
    setTimeout(() => {
      dismissAlert(alertId);
    }, duration);
  }

  return alertId;
}

function dismissAlert(alertId) {
  const alertElement = document.getElementById(alertId);
  if (alertElement) {
    const bsAlert = new bootstrap.Alert(alertElement);
    bsAlert.close();
  }
}

function clearAllAlerts() {
  const alertContainer = document.getElementById('alert-container');
  if (alertContainer) {
    const alerts = alertContainer.querySelectorAll('.alert');
    alerts.forEach(alert => {
      const bsAlert = new bootstrap.Alert(alert);
      bsAlert.close();
    });
  }
}

function successAlert(message, duration = 1_500) {
  return pushAlert(message, 'success', duration, false);
}

function errorAlert(message, duration = 15_000) {
  return pushAlert(message, 'danger', /* duration */);
}

function warningAlert(message, duration = 8_000) {
  return pushAlert(message, 'warning', duration);
}

function infoAlert(message, duration = 5_000) {
  return pushAlert(message, 'info', duration, false);
}

// Export functions to global scope for HTML onclick handlers
window.gboot = gboot;
window.connect = connect;
window.showControllerInfo = showControllerInfo;
window.disconnect = disconnectSync;
window.show_faq_modal = show_faq_modal;
window.show_info_tab = show_info_tab;
window.calibrate_range = () => {
  if (!controller || !controller.isConnected()) {
    warningAlert(l("Please connect a controller first"));
    return;
  }
  
  calibrate_range(
    controller,
    { ll_data, rr_data },
    (success, message) => {
      if (success) {
        resetStickDiagrams();
        successAlert(message);
        switchToRangeMode();
        app.shownRangeCalibrationWarning = false;
      }
    }
  );
};

window.calibrate_stick_centers = () => {
  if (!controller || !controller.isConnected()) {
    warningAlert(l("Please connect a controller first"));
    return;
  }

  calibrate_stick_centers(
    controller,
    (success, message) => {
      if (success) {
        resetStickDiagrams();
        successAlert(message);
        switchTo10xZoomMode();
      }
    }
  );
};

window.auto_calibrate_stick_centers = () => {
  if (!controller || !controller.isConnected()) {
    warningAlert(l("Please connect a controller first"));
    return;
  }

  auto_calibrate_stick_centers(
    controller,
    (success, message) => {
      if (success) {
        resetStickDiagrams();
        successAlert(message);
        switchTo10xZoomMode();
      }
    }
  );
};
window.ds5_finetune = () => ds5_finetune(
  controller,
  { ll_data, rr_data, clear_circularity },
  (success) => success && switchToRangeMode()
);
window.flash_all_changes = flash_all_changes;
window.reboot_controller = reboot_controller;
window.refresh_nvstatus = refresh_nvstatus;
window.nvsunlock = nvsunlock;
window.nvslock = nvslock;
window.show_donate_modal = show_donate_modal;
window.board_model_info = board_model_info;
window.edge_color_info = edge_color_info;

window.test_vibration = (duration = 150) => {
  if (!controller || !controller.isConnected()) {
    warningAlert(l("Please connect a controller first"));
    return;
  }
  console.log("Testing vibration...");
  controller.setVibration({ heavyLeft: 255, lightRight: 255, duration });
}

window.test_led = (color) => {
  if (!controller || !controller.isConnected()) {
    warningAlert(l("Please connect a controller first"));
    return;
  }

  console.log(`Testing LED: ${color}`);
  if (controller.currentController && controller.currentController.setLightbarColor) {
      if (color === 'red') controller.currentController.setLightbarColor(255, 0, 0);
      if (color === 'green') controller.currentController.setLightbarColor(0, 255, 0);
      if (color === 'blue') controller.currentController.setLightbarColor(0, 0, 255);
      if (color === 'off') controller.currentController.setLightbarColor(0, 0, 0);
  }
}

window.test_trigger = (side, preset) => {
  if (!controller || !controller.isConnected()) {
    warningAlert(l("Please connect a controller first"));
    return;
  }
  
const model = controller.getModel();
  if (!model.startsWith("DS5")) {
    warningAlert(l("Adaptive Triggers are only supported on PS5 controllers (DualSense)."));
    return;
  }

  console.log(`Testing trigger ${side}: ${preset}`);
  
  const params = {
    left: side === 'left' ? preset : 'off',
    right: side === 'right' ? preset : 'off'
  };
  
  controller.setAdaptiveTriggerPreset(params);
}

gboot();