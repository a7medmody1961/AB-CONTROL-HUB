'use strict';

import { float_to_str, dec2hex32, lerp_color } from './utils.js';
import { l } from './translations.js';
import { draw_stick_position } from './stick-renderer.js';

// Cache for frequently accessed DOM elements
const domCache = {
  lx_lbl: null,
  ly_lbl: null,
  rx_lbl: null,
  ry_lbl: null,
  stickCanvas: null,
  l2_progress: null,
  r2_progress: null
};

// UI State
let hasActiveTouchPoints = false;
let trackpadBbox = undefined;

export function initUiElements() {
    domCache.lx_lbl = document.getElementById("lx-lbl");
    domCache.ly_lbl = document.getElementById("ly-lbl");
    domCache.rx_lbl = document.getElementById("rx-lbl");
    domCache.ry_lbl = document.getElementById("ry-lbl");
    domCache.stickCanvas = document.getElementById("stickCanvas");
    domCache.l2_progress = document.getElementById("l2-progress");
    domCache.r2_progress = document.getElementById("r2-progress");
    
    // Initialize progress bars if they exist
    if(domCache.l2_progress) domCache.l2_progress.style.height = '0%';
    if(domCache.r2_progress) domCache.r2_progress.style.height = '0%';
}

export async function init_svg_controller(model) {
    const svgContainer = document.getElementById('controller-svg-placeholder');
    if(!svgContainer) return;
  
    let svgFileName = (model === 'DS4') ? 'dualshock-controller.svg' : 'dualsense-controller.svg';
  
    try {
        let svgContent;
        if (window.BUNDLED_ASSETS && window.BUNDLED_ASSETS.svg && window.BUNDLED_ASSETS.svg[svgFileName]) {
          svgContent = window.BUNDLED_ASSETS.svg[svgFileName];
        } else {
          const response = await fetch(`assets/${svgFileName}`);
          if (!response.ok) throw new Error("SVG Not Found");
          svgContent = await response.text();
        }
        svgContainer.innerHTML = svgContent;
        
        const lightBlue = '#7ecbff';
        const midBlue = '#3399cc';
        const dualshock = document.getElementById('Controller');
        set_svg_group_color(dualshock, lightBlue);
        ['Button_outlines', 'Button_outlines_behind', 'L3_outline', 'R3_outline', 'Trackpad_outline'].forEach(id => {
          const group = document.getElementById(id);
          set_svg_group_color(group, midBlue);
        });
        
    } catch (e) {
        console.warn("Could not load controller image, continuing without it.", e);
        svgContainer.innerHTML = "<p style='color:white; text-align:center;'>Controller Image Not Loaded</p>";
    }
}

export function refresh_stick_pos(controller, ll_data, rr_data) {
    const c = domCache.stickCanvas;
    if(!c) return;
    
    const ctx = c.getContext("2d");
    const sz = 60;
    const hb = 20 + sz;
    const yb = 15 + sz;
    const w = c.width;
    
    ctx.clearRect(0, 0, c.width, c.height);
  
    let plx = 0, ply = 0, prx = 0, pry = 0;
  
    if (controller && controller.button_states && controller.button_states.sticks) {
        const sticks = controller.button_states.sticks;
        plx = sticks.left.x;
        ply = sticks.left.y;
        prx = sticks.right.x;
        pry = sticks.right.y;
    }
  
    const enable_zoom_center = document.getElementById("centerZoomMode")?.checked;
    const enable_circ_test = document.getElementById("checkCircularityMode")?.checked;
    
    draw_stick_position(ctx, hb, yb, sz, plx, ply, {
      circularity_data: enable_circ_test ? ll_data : null,
      enable_zoom_center,
    });
  
    draw_stick_position(ctx, w-hb, yb, sz, prx, pry, {
      circularity_data: enable_circ_test ? rr_data : null,
      enable_zoom_center,
    });
  
    const precision = enable_zoom_center ? 3 : 2;
    
    if(domCache.lx_lbl) domCache.lx_lbl.textContent = float_to_str(plx, precision);
    if(domCache.ly_lbl) domCache.ly_lbl.textContent = float_to_str(ply, precision);
    if(domCache.rx_lbl) domCache.rx_lbl.textContent = float_to_str(prx, precision);
    if(domCache.ry_lbl) domCache.ry_lbl.textContent = float_to_str(pry, precision);
  
    if (controller) {
        try {
          const model = controller.getModel();
          let l3_x, l3_y, r3_x, r3_y;
          let transform_l, transform_r;
  
          if (model === "DS4") {
              const max_offset = 25;
              const l3_cx = 295.63, l3_cy = 461.03;
              const r3_cx = 662.06, r3_cy = 419.78;
              l3_x = l3_cx + plx * max_offset; l3_y = l3_cy + ply * max_offset;
              r3_x = r3_cx + prx * max_offset; r3_y = r3_cy + pry * max_offset;
              transform_l = `translate(${l3_x - l3_cx},${l3_y - l3_cy})`;
              transform_r = `translate(${r3_x - r3_cx},${r3_y - r3_cy})`;
          } else if (model === "DS5" || model === "DS5_Edge") {
              const max_offset = 25;
              const l3_cx = 295.63, l3_cy = 461.03;
              const r3_cx = 662.06, r3_cy = 419.78;
              l3_x = l3_cx + plx * max_offset; l3_y = l3_cy + ply * max_offset;
              r3_x = r3_cx + prx * max_offset; r3_y = r3_cy + pry * max_offset;
              transform_l = `translate(${l3_x - l3_cx},${l3_y - l3_cy}) scale(0.70)`;
              transform_r = `translate(${r3_x - r3_cx},${r3_y - r3_cy}) scale(0.70)`;
          }
  
          if (transform_l) {
              const l3_group = document.querySelector('g#L3');
              if (l3_group) l3_group.setAttribute('transform', transform_l);
              const r3_group = document.querySelector('g#R3');
              if (r3_group) r3_group.setAttribute('transform', transform_r);
          }
        } catch (e) { }
    }
}

export function update_ds_button_svg(changes, BUTTON_MAP) {
    if (!changes || Object.keys(changes).length === 0) return;
  
    const pressedColor = '#FFFFFF';
    const defaultColor = 'white';
  
    // Update L2/R2 bars
    for (const trigger of ['l2', 'r2']) {
      const key = trigger + '_analog';
      if (changes.hasOwnProperty(key)) {
        const val = changes[key]; // 0-255
        const percentage = Math.round((val / 255) * 100);
        
        const progressBar = (trigger === 'l2' ? domCache.l2_progress : domCache.r2_progress) || document.getElementById(`${trigger}-progress`);
        if (progressBar) {
            progressBar.style.height = percentage + '%'; 
            progressBar.style.width = '100%';            
            progressBar.textContent = '';                
        }
  
        const valLabel = document.getElementById(`${trigger}-val`);
        if (valLabel) {
            valLabel.textContent = percentage + '%';
        }
  
        const t = val / 255;
        const color = lerp_color(defaultColor, pressedColor, t); 
        const svg = trigger.toUpperCase() + '_infill';
        const infill = document.getElementById(svg);
        set_svg_group_color(infill, color);
  
        const outline = document.getElementById(trigger.toUpperCase() + '_outline');
        if (val > 10) {
          infill?.classList.add('pressed-glow');
          outline?.classList.add('pressed-glow');
        } else {
          infill?.classList.remove('pressed-glow');
          outline?.classList.remove('pressed-glow');
        }
  
        const percentageText = document.getElementById(trigger.toUpperCase() + '_percentage');
        if (percentageText) {
          percentageText.textContent = `${percentage} %`;
          percentageText.setAttribute('opacity', percentage > 0 ? '1' : '0');
          percentageText.setAttribute('fill', percentage < 35 ? '#1a237e' : 'white');
        }
      }
    }
  
    // Update Dpad
    for (const dir of ['up', 'right', 'down', 'left']) {
      if (changes.hasOwnProperty(dir)) {
        const pressed = changes[dir];
        const group = document.getElementById(dir.charAt(0).toUpperCase() + dir.slice(1) + '_infill');
        if (group) {
            if (pressed) group.classList.add('pressed-glow');
            else group.classList.remove('pressed-glow');
        }
        
        const indicator = document.getElementById(`indicator-${dir}`);
        if (indicator) {
            if (pressed) indicator.classList.add('pressed');
            else indicator.classList.remove('pressed');
        }
      }
    }
  
    for (const btn of BUTTON_MAP) {
      if (['up', 'right', 'down', 'left'].includes(btn.name)) continue;
      if (changes.hasOwnProperty(btn.name)) {
        const pressed = changes[btn.name];
        
        if (btn.svg) {
          const group = document.getElementById(btn.svg + '_infill');
          if (group) {
              if (pressed) group.classList.add('pressed-glow');
              else group.classList.remove('pressed-glow');
          }
        }
        
        const indicator = document.getElementById(`indicator-${btn.name}`);
        if (indicator) {
            if (pressed) indicator.classList.add('pressed');
            else indicator.classList.remove('pressed');
        }
      }
    }
}

export function set_svg_group_color(group, color) {
    if (group) {
      const elements = group.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon');
      elements.forEach(el => {
        el.style.fill = color;
        el.style.stroke = color;
      });
    }
}

export function update_touchpad_circles(points) {
    const hasActivePointsNow = points.some(pt => pt.active);
    if(!hasActivePointsNow && !hasActiveTouchPoints) return;
  
    const svg = document.getElementById('controller-svg');
    const trackpad = svg?.querySelector('g#Trackpad_infill');
    if (!trackpad) return;
  
    trackpad.querySelectorAll('circle.ds-touch').forEach(c => c.remove());
    hasActiveTouchPoints = hasActivePointsNow;
    
    if (!trackpadBbox) {
        const path = trackpad.querySelector('path');
        if (path) trackpadBbox = path.getBBox();
    }
    
    if (!trackpadBbox) return;
  
    points.forEach((pt, idx) => {
      if (!pt.active) return;
      
      const RAW_W = 1920, RAW_H = 943;
      const pointRadius = trackpadBbox.width * 0.05;
      const cx = trackpadBbox.x + pointRadius + (pt.x / RAW_W) * (trackpadBbox.width - pointRadius*2);
      const cy = trackpadBbox.y + pointRadius + (pt.y / RAW_H) * (trackpadBbox.height - pointRadius*2);
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('class', 'ds-touch');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
      circle.setAttribute('r', pointRadius);
      circle.setAttribute('fill', idx === 0 ? '#2196f3' : '#e91e63');
      circle.setAttribute('fill-opacity', '0.5');
      circle.setAttribute('stroke', '#3399cc');
      circle.setAttribute('stroke-width', '4');
      trackpad.appendChild(circle);
    });
}

export function initialize_button_indicators(BUTTON_MAP) {
    const container = document.getElementById('digital-buttons-container');
    if(!container) return;
    
    container.innerHTML = ''; 
  
    const iconMap = {
      'triangle': '<i class="fas fa-play fa-rotate-270" style="font-size: 0.8em; margin-left: 2px;"></i>',
      'circle': '<i class="far fa-circle"></i>',
      'cross': '<i class="fas fa-times"></i>',
      'square': '<i class="far fa-square"></i>',
      'l1': 'L1',
      'r1': 'R1',
      'l3': 'L3',
      'r3': 'R3',
      'up': '<i class="fas fa-arrow-up"></i>',
      'down': '<i class="fas fa-arrow-down"></i>',
      'left': '<i class="fas fa-arrow-left"></i>',
      'right': '<i class="fas fa-arrow-right"></i>',
      'ps': '<i class="fab fa-playstation"></i>',
      'create': '<i class="fas fa-share-square" style="font-size: 0.9em;"></i>',
      'options': '<i class="fas fa-bars"></i>',
      'touchpad': '<i class="fas fa-mouse-pointer"></i>',
      'mute': '<i class="fas fa-microphone-slash"></i>'
    };
    
    const buttons_to_show = Object.keys(iconMap);
    
    for (const btn of BUTTON_MAP) {
      if (buttons_to_show.includes(btn.name)) {
        
        let displayName = btn.name;
        if (displayName === 'create') {
            displayName = 'Share'; 
        }
        
        const btn_name_translated = l(displayName); 
        
        const icon = iconMap[btn.name]; 
        
        const span = document.createElement('span');
        span.id = `indicator-${btn.name}`; 
        span.className = 'btn-indicator';
        span.setAttribute('title', btn_name_translated); 
        span.innerHTML = icon;
        container.appendChild(span);
      }
    }
    
    // Initialize Bootstrap tooltips
    const tooltipTriggerList = Array.from(container.querySelectorAll('[title]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
      if (typeof bootstrap !== 'undefined' && !bootstrap.Tooltip.getInstance(tooltipTriggerEl)) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
      }
    });
}

export function update_battery_status({bat_txt, changed}) {
    if(changed) {
      const el = document.getElementById("d-bat");
      if(el) el.innerHTML = bat_txt;
    }
}

export function render_nvstatus_to_dom(nv) {
    if(!nv?.status) {
      throw new Error("Invalid NVS status data", { cause: nv?.error });
    }
  
    const el = document.getElementById("d-nvstatus");
    if(!el) return;
  
    switch (nv.status) {
      case 'locked':
        el.innerHTML = "<font color='green'>" + l("locked") + "</font>";
        break;
      case 'unlocked':
        el.innerHTML = "<font color='red'>" + l("unlocked") + "</font>";
        break;
      case 'pending_reboot':
        const pendingTxt = nv.raw !== undefined ? ("0x" + dec2hex32(nv.raw)) : String(nv.code ?? '');
        el.innerHTML = "<font color='purple'>unk " + pendingTxt + "</font>";
        break;
      case 'unknown':
        const unknownTxt = nv.device === 'ds5' && nv.raw !== undefined ? ("0x" + dec2hex32(nv.raw)) : String(nv.code ?? '');
        el.innerHTML = "<font color='purple'>unk " + unknownTxt + "</font>";
        break;
      case 'error':
        el.innerHTML = "<font color='red'>" + l("error") + "</font>";
        break;
    }
}

export function render_info_to_dom(infoItems) {
    const fwInfo = document.getElementById("fwinfo");
    if (fwInfo) fwInfo.innerHTML = "";
    
    const fwInfoExtraHw = document.getElementById("fwinfoextra-hw");
    if (fwInfoExtraHw) fwInfoExtraHw.innerHTML = "";
  
    const fwInfoExtraFw = document.getElementById("fwinfoextra-fw");
    if (fwInfoExtraFw) fwInfoExtraFw.innerHTML = "";
  
    const dBoard = document.getElementById("d-board");
    if (dBoard) dBoard.textContent = ""; 
  
    if (!Array.isArray(infoItems)) return;
  
    infoItems.forEach(({key, value, addInfoIcon, severity, isExtra, cat}) => {
      if (!key) return;
  
      if (key === "Board Model" && dBoard) {
        dBoard.textContent = value;
      }
  
      let valueHtml = String(value ?? "");
      if (addInfoIcon === 'board') {
        const icon = '&nbsp;<a class="link-body-emphasis" href="#" onclick="board_model_info()">' +
        '<svg class="bi" width="1.3em" height="1.3em"><use xlink:href="#info"/></svg></a>';
        valueHtml += icon;
      } else if (addInfoIcon === 'color') {
        const icon = '&nbsp;<a class="link-body-emphasis" href="#" onclick="edge_color_info()">' +
        '<svg class="bi" width="1.3em" height="1.3em"><use xlink:href="#info"/></svg></a>';
        valueHtml += icon;
      }
  
      if (severity) {
        const colors = { danger: 'red', success: 'green' }
        const color = colors[severity] || 'black';
        valueHtml = `<font color='${color}'><b>${valueHtml}</b></font>`;
      }
  
      const key_display = l(key);
  
      if (isExtra) {
        append_info_extra(key_display, valueHtml, cat || "hw");
      } else {
        append_info(key_display, valueHtml, cat || "hw");
      }
    });
}

function append_info_extra(key, value, cat) {
    const s = '<dt class="text-muted col-sm-4 col-md-6 col-xl-5">' + key + '</dt><dd class="col-sm-8 col-md-6 col-xl-7" style="text-align: right;">' + value + '</dd>';
    const el = document.getElementById("fwinfoextra-" + cat);
    if(el) el.innerHTML += s;
}
  
function append_info(key, value, cat) {
    const s = '<dt class="text-muted col-6">' + key + '</dt><dd class="col-6" style="text-align: right;">' + value + '</dd>';
    const el = document.getElementById("fwinfo");
    if(el) el.innerHTML += s;
    append_info_extra(key, value, cat);
}

export function addToModalList(key, value, valueColorClass) {
    const listContainer = document.getElementById('modal-info-list');
    
    const li = document.createElement('li');
    li.className = "list-group-item bg-transparent d-flex justify-content-between align-items-center";
    li.style.padding = "15px 20px";
    li.style.borderBottom = "1px solid rgba(255, 255, 255, 0.1)"; 
    
    const keySpan = document.createElement('span');
    keySpan.className = "text-secondary text-uppercase fw-bold"; 
    keySpan.style.fontSize = "0.85rem";
    keySpan.style.letterSpacing = "1px";
    keySpan.innerText = key;
    
    const valueSpan = document.createElement('span');
    if (value.includes && value.includes('<')) {
        valueSpan.innerHTML = value;
    } else {
        valueSpan.className = valueColorClass;
        valueSpan.innerText = value;
    }
    
    valueSpan.style.fontFamily = "'Consolas', 'Monaco', monospace"; 
    valueSpan.style.fontSize = "1rem";
    
    li.appendChild(keySpan);
    li.appendChild(valueSpan);
    listContainer.appendChild(li);
}

export function set_edge_progress(score) {
    const el = document.getElementById("dsedge-progress");
    if(el) el.style.width = score + "%";
}